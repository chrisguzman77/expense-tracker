import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, type InitialEntry, RouterProvider, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { localToday } from "../lib/dates";
import { server } from "../test/server";
import { NewExpensePage } from "./NewExpensePage";

const food = { id: 1, name: "Food", color: "amber", icon: "🍔" };
const rent = { id: 2, name: "Rent", color: "sky", icon: "🏠" };

function fakeApi(categories: (typeof food)[]) {
  const posted: unknown[] = [];
  server.use(
    http.get("/api/categories", () => HttpResponse.json(categories)),
    http.post("/api/expenses", async ({ request }) => {
      const body = (await request.json()) as { category_id: number; amount: string; spent_on: string; note: string | null };
      posted.push(body);
      const category = categories.find((c) => c.id === body.category_id)!;
      return HttpResponse.json({ id: 50, ...body, category }, { status: 201 });
    }),
  );
  return { posted };
}

function StateProbe({ label }: { label: string }) {
  return (
    <p>
      {label} {JSON.stringify(useLocation().state)}
    </p>
  );
}

function renderPage(entry: InitialEntry = "/expenses/new") {
  const router = createMemoryRouter(
    [
      { path: "/", element: <p>expenses list</p> },
      { path: "/expenses/new", element: <NewExpensePage /> },
      { path: "/categories/new", element: <StateProbe label="new category screen" /> },
    ],
    { initialEntries: [entry] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient };
}

describe("NewExpensePage", () => {
  it("adds an expense with today's date and the first category by default, then returns to the list", async () => {
    const { posted } = fakeApi([food, rent]);
    const { queryClient } = renderPage();
    queryClient.setQueryData(["summary", 2026, 10], []);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Amount"), "12.50");
    await user.type(screen.getByLabelText("Note"), "Lunch");
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    expect(await screen.findByText("expenses list")).toBeInTheDocument();
    expect(posted).toEqual([{ category_id: 1, amount: "12.50", spent_on: localToday(), note: "Lunch" }]);
    // The breakdown card and Summary tab must refetch their totals.
    expect(queryClient.getQueryState(["summary", 2026, 10])?.isInvalidated).toBe(true);
  });

  it("rejects a non-positive amount without calling the API", async () => {
    const { posted } = fakeApi([food]);
    renderPage();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Amount"), "0");
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    expect(await screen.findByText(/greater than 0/i)).toBeInTheDocument();
    expect(posted).toEqual([]);
  });

  it("carries the draft to the new category screen", async () => {
    fakeApi([food, rent]);
    renderPage();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Amount"), "7.25");
    await user.click(screen.getByRole("button", { name: "+ New category" }));

    const probe = await screen.findByText(/new category screen/);
    expect(probe.textContent).toContain('"amount":"7.25"');
  });

  it("restores a draft and pre-selects a just-created category", async () => {
    fakeApi([food, rent]);
    renderPage({
      pathname: "/expenses/new",
      state: { draft: { amount: "7.25", note: "Tea", spent_on: localToday(), category_id: "1" }, categoryId: 2 },
    });

    expect(await screen.findByLabelText("Amount")).toHaveValue("7.25");
    expect(screen.getByLabelText("Note")).toHaveValue("Tea");
    expect(screen.getByLabelText("Category")).toHaveValue("2");
  });

  it("asks for a category first when there are none", async () => {
    fakeApi([]);
    renderPage();

    expect(await screen.findByText(/create a category first/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ New category" })).toHaveAttribute("href", "/categories/new");
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
  });
});
