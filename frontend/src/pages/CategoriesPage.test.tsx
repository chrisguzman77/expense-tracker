import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { CategoriesPage } from "./CategoriesPage";

type Category = { id: number; name: string };

// A tiny in-memory backend so list/create/delete interact like the real API.
function fakeCategories(initial: Category[]) {
  const rows = [...initial];
  let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1;
  server.use(
    http.get("/api/categories", () => HttpResponse.json(rows)),
    http.post("/api/categories", async ({ request }) => {
      const { name } = (await request.json()) as { name: string };
      if (rows.some((r) => r.name === name)) {
        return HttpResponse.json({ detail: "Category name taken" }, { status: 409 });
      }
      const row = { id: nextId++, name };
      rows.push(row);
      return HttpResponse.json(row, { status: 201 });
    }),
    http.delete("/api/categories/:id", ({ params }) => {
      const id = Number(params.id);
      if (id === 99) return HttpResponse.json({ detail: "Category has expenses" }, { status: 409 });
      const i = rows.findIndex((r) => r.id === id);
      rows.splice(i, 1);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return rows;
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

describe("CategoriesPage", () => {
  it("lists the user's categories", async () => {
    fakeCategories([
      { id: 1, name: "Food" },
      { id: 2, name: "Rent" },
    ]);
    renderPage();

    const list = await screen.findByRole("list", { name: /categories/i });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("Food"), expect.stringContaining("Rent")]),
    );
  });

  it("creates a category and shows it in the list", async () => {
    fakeCategories([{ id: 1, name: "Food" }]);
    renderPage();
    const user = userEvent.setup();
    await screen.findByText("Food");

    await user.type(screen.getByLabelText(/new category/i), "Travel");
    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(await screen.findByText("Travel")).toBeInTheDocument();
    expect(screen.getByLabelText(/new category/i)).toHaveValue("");
  });

  it("shows the server message when the name is taken", async () => {
    fakeCategories([{ id: 1, name: "Food" }]);
    renderPage();
    const user = userEvent.setup();
    await screen.findByText("Food");

    await user.type(screen.getByLabelText(/new category/i), "Food");
    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Category name taken");
  });

  it("deletes an empty category", async () => {
    fakeCategories([
      { id: 1, name: "Food" },
      { id: 2, name: "Rent" },
    ]);
    renderPage();
    const user = userEvent.setup();
    const rent = (await screen.findByText("Rent")).closest("li")!;

    await user.click(within(rent).getByRole("button", { name: /delete/i }));

    await screen.findByText("Food");
    expect(screen.queryByText("Rent")).not.toBeInTheDocument();
  });

  it("shows the server message when deleting a category with expenses", async () => {
    fakeCategories([{ id: 99, name: "Food" }]);
    renderPage();
    const user = userEvent.setup();
    const food = (await screen.findByText("Food")).closest("li")!;

    await user.click(within(food).getByRole("button", { name: /delete/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Category has expenses");
    expect(screen.getByText("Food")).toBeInTheDocument();
  });
});
