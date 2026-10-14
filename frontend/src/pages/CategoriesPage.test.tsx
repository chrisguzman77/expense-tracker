import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { CategoriesPage } from "./CategoriesPage";

type Category = { id: number; name: string; color: string; icon: string; kind: string };

// A tiny in-memory backend so list/create/delete interact like the real API.
function fakeCategories(initial: Category[]) {
  const rows = [...initial];
  let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1;
  const posted: unknown[] = [];
  server.use(
    http.get("/api/categories", () => HttpResponse.json(rows)),
    http.post("/api/categories", async ({ request }) => {
      const body = (await request.json()) as { name: string; color: string; icon: string; kind: string };
      posted.push(body);
      if (rows.some((r) => r.name === body.name)) {
        return HttpResponse.json({ detail: "Category name taken" }, { status: 409 });
      }
      const row = { id: nextId++, ...body };
      rows.push(row);
      return HttpResponse.json(row, { status: 201 });
    }),
    http.delete("/api/categories/:id", ({ params }) => {
      const id = Number(params.id);
      if (id === 99) return HttpResponse.json({ detail: "Category has transactions" }, { status: 409 });
      rows.splice(rows.findIndex((r) => r.id === id), 1);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { posted };
}

function renderPage() {
  const router = createMemoryRouter([{ path: "/categories", element: <CategoriesPage /> }], {
    initialEntries: ["/categories"],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const food = { id: 1, name: "Food", color: "amber", icon: "🍔", kind: "spending" };
const rent = { id: 2, name: "Rent", color: "sky", icon: "🏠", kind: "spending" };

describe("CategoriesPage", () => {
  it("lists the user's categories", async () => {
    fakeCategories([food, rent]);
    renderPage();

    const list = await screen.findByRole("list", { name: "Categories" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Food"),
      expect.stringContaining("Rent"),
    ]);
  });

  it("creates a category with a name, emoji and color", async () => {
    const { posted } = fakeCategories([food]);
    renderPage();
    const user = userEvent.setup();
    await screen.findByText("Food");

    await user.type(screen.getByLabelText("Name"), "Travel");
    await user.clear(screen.getByLabelText("Emoji"));
    await user.type(screen.getByLabelText("Emoji"), "✈️");
    await user.click(screen.getByRole("radio", { name: "Teal" }));
    await user.click(screen.getByRole("button", { name: "Add category" }));

    const list = screen.getByRole("list", { name: "Categories" });
    expect(await within(list).findByText("Travel")).toBeInTheDocument();
    expect(posted).toEqual([{ name: "Travel", icon: "✈️", color: "teal", kind: "spending" }]);
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("Emoji")).toHaveValue("🏷️");
  });

  it("creates an income category", async () => {
    const { posted } = fakeCategories([food]);
    renderPage();
    const user = userEvent.setup();
    await screen.findByText("Food");

    await user.type(screen.getByLabelText("Name"), "Paycheck");
    await user.click(screen.getByRole("radio", { name: "Income" }));
    await user.click(screen.getByRole("button", { name: "Add category" }));

    await screen.findByText("Paycheck");
    expect(posted).toEqual([{ name: "Paycheck", icon: "🏷️", color: "amber", kind: "income" }]);
  });

  it("labels income and transfer categories, not spending ones", async () => {
    fakeCategories([
      food,
      { id: 3, name: "Paycheck", color: "emerald", icon: "💰", kind: "income" },
      { id: 4, name: "Card payment", color: "slate", icon: "💳", kind: "transfer" },
    ]);
    renderPage();

    const list = await screen.findByRole("list", { name: "Categories" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "🍔Food",
      "💰PaycheckIncome",
      "💳Card paymentTransfer",
    ]);
  });

  it("rejects an emoji field longer than 16 characters without calling the API", async () => {
    const { posted } = fakeCategories([food]);
    renderPage();
    const user = userEvent.setup();
    await screen.findByText("Food");

    await user.type(screen.getByLabelText("Name"), "Long");
    await user.clear(screen.getByLabelText("Emoji"));
    await user.type(screen.getByLabelText("Emoji"), "x".repeat(17));
    await user.click(screen.getByRole("button", { name: "Add category" }));

    expect(await screen.findByText(/at most 16/i)).toBeInTheDocument();
    expect(posted).toEqual([]);
  });

  // Behavior guard: the limit counts code points like the backend, so 16 emoji
  // (32 UTF-16 units) are accepted. Holds whichever way the schema implements it.
  it("accepts 16 multi-unit emoji", async () => {
    const { posted } = fakeCategories([food]);
    renderPage();
    const user = userEvent.setup();
    await screen.findByText("Food");

    await user.type(screen.getByLabelText("Name"), "Many");
    await user.clear(screen.getByLabelText("Emoji"));
    await user.type(screen.getByLabelText("Emoji"), "🍔".repeat(16));
    await user.click(screen.getByRole("button", { name: "Add category" }));

    await screen.findByText("Many");
    expect(posted).toEqual([{ name: "Many", icon: "🍔".repeat(16), color: "amber", kind: "spending" }]);
  });

  it("shows the server message when the name is taken", async () => {
    fakeCategories([food]);
    renderPage();
    const user = userEvent.setup();
    await screen.findByText("Food");

    await user.type(screen.getByLabelText("Name"), "Food");
    await user.click(screen.getByRole("button", { name: "Add category" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Category name taken");
  });

  it("deletes an empty category", async () => {
    fakeCategories([food, rent]);
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete Rent" }));

    await screen.findByText("Food");
    expect(screen.queryByText("Rent")).not.toBeInTheDocument();
  });

  it("shows the server message when deleting a category with transactions", async () => {
    fakeCategories([{ ...food, id: 99 }]);
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete Food" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Category has transactions");
    expect(screen.getByText("Food")).toBeInTheDocument();
  });
});
