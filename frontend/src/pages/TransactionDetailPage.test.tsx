import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { TransactionDetailPage } from "./TransactionDetailPage";

const food = { id: 1, name: "Food", color: "amber", icon: "🍔", kind: "spending" };

function fakeApi() {
  const rows = [{ id: 10, amount: "-12.50", occurred_on: "2026-10-10", note: "Lunch", category: food, account: { id: 1, name: "Wallet", type: "cash" } }];
  const deleted: number[] = [];
  server.use(
    http.get("/api/transactions", () => HttpResponse.json(rows)),
    http.delete("/api/transactions/:id", ({ params }) => {
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
      { path: "/", element: <p>transactions list</p> },
      { path: "/transactions/:id", element: <TransactionDetailPage /> },
      { path: "/transactions/:id/edit", element: <p>edit screen</p> },
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

describe("TransactionDetailPage", () => {
  it("shows the transaction", async () => {
    fakeApi();
    renderPage("/transactions/10");

    expect(await screen.findByText("$12.50")).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("Saturday, October 10, 2026")).toBeInTheDocument();
    expect(screen.getByText("Wallet")).toBeInTheDocument();
    expect(screen.getByText("Lunch")).toBeInTheDocument();
  });

  it("asks for confirmation; cancelling keeps the transaction", async () => {
    const { deleted } = fakeApi();
    renderPage("/transactions/10");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete transaction" }));
    expect(screen.getByText(/delete this transaction\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete transaction" })).toBeInTheDocument();
    expect(deleted).toEqual([]);
  });

  it("deletes after confirmation, refreshes the summary and returns to the list", async () => {
    const { deleted } = fakeApi();
    const { queryClient } = renderPage("/transactions/10");
    queryClient.setQueryData(["summary", 2026, 10], []);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete transaction" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("transactions list")).toBeInTheDocument();
    expect(deleted).toEqual([10]);
    expect(queryClient.getQueryState(["summary", 2026, 10])?.isInvalidated).toBe(true);
  });

  it("says when the transaction doesn't exist", async () => {
    fakeApi();
    renderPage("/transactions/999");

    expect(await screen.findByText("Transaction not found")).toBeInTheDocument();
  });

  it("opens the edit screen", async () => {
    fakeApi();
    renderPage("/transactions/10");

    await userEvent.setup().click(await screen.findByRole("button", { name: "Edit transaction" }));

    expect(await screen.findByText("edit screen")).toBeInTheDocument();
  });
});
