import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { ExpenseDetailPage } from "./ExpenseDetailPage";

const food = { id: 1, name: "Food", color: "amber", icon: "🍔" };

function fakeApi() {
  const rows = [{ id: 10, amount: "12.50", spent_on: "2026-10-10", note: "Lunch", category: food }];
  const deleted: number[] = [];
  server.use(
    http.get("/api/expenses", () => HttpResponse.json(rows)),
    http.delete("/api/expenses/:id", ({ params }) => {
      deleted.push(Number(params.id));
      rows.splice(rows.findIndex((r) => r.id === Number(params.id)), 1);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { deleted };
}

function renderPage(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/", element: <p>expenses list</p> },
      { path: "/expenses/:id", element: <ExpenseDetailPage /> },
    ],
    { initialEntries: [path] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient };
}

describe("ExpenseDetailPage", () => {
  it("shows the expense", async () => {
    fakeApi();
    renderPage("/expenses/10");

    expect(await screen.findByText("$12.50")).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("Saturday, October 10, 2026")).toBeInTheDocument();
    expect(screen.getByText("Lunch")).toBeInTheDocument();
  });

  it("asks for confirmation; cancelling keeps the expense", async () => {
    const { deleted } = fakeApi();
    renderPage("/expenses/10");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete expense" }));
    expect(screen.getByText(/delete this expense\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete expense" })).toBeInTheDocument();
    expect(deleted).toEqual([]);
  });

  it("deletes after confirmation, refreshes the summary and returns to the list", async () => {
    const { deleted } = fakeApi();
    const { queryClient } = renderPage("/expenses/10");
    queryClient.setQueryData(["summary", 2026, 10], []);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete expense" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("expenses list")).toBeInTheDocument();
    expect(deleted).toEqual([10]);
    expect(queryClient.getQueryState(["summary", 2026, 10])?.isInvalidated).toBe(true);
  });

  it("says when the expense doesn't exist", async () => {
    fakeApi();
    renderPage("/expenses/999");

    expect(await screen.findByText("Expense not found")).toBeInTheDocument();
  });
});
