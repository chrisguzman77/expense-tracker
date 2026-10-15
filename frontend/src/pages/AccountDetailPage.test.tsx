import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { AccountDetailPage } from "./AccountDetailPage";

const wells = { id: 1, name: "Wells Fargo", type: "checking" };

const food = { id: 1, name: "Food", color: "amber", icon: "🍔", kind: "spending" };

function fakeApi({ transactions = [] as object[] } = {}) {
  const requested: (string | null)[] = [];
  server.use(
    http.get("/api/accounts", () => HttpResponse.json([wells])),
    http.get("/api/transactions", ({ request }) => {
      requested.push(new URL(request.url).searchParams.get("account_id"));
      return HttpResponse.json(transactions);
    }),
  );
  return { requested };
}

function renderPage(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/accounts/:id", element: <AccountDetailPage /> },
      { path: "/accounts/:id/edit", element: <p>edit screen</p> },
      { path: "/accounts", element: <p>accounts tab</p> },
    ],
    { initialEntries: [path] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("AccountDetailPage", () => {
  it("opens the edit screen from the header", async () => {
    fakeApi();
    renderPage("/accounts/1");

    await userEvent.setup().click(await screen.findByRole("link", { name: "Edit" }));

    expect(await screen.findByText("edit screen")).toBeInTheDocument();
  });

  it("has no Delete button", async () => {
    fakeApi();
    renderPage("/accounts/1");

    await screen.findByText("Wells Fargo");
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("lists the account's transactions", async () => {
    const { requested } = fakeApi({
      transactions: [{ id: 10, amount: "-12.50", occurred_on: "2026-10-10", note: "Lunch", category: food, account: wells }],
    });
    renderPage("/accounts/1");

    expect(await screen.findByRole("link", { name: /lunch/i })).toHaveTextContent("$12.50");
    expect(requested).toEqual(["1"]);
  });

  it("says when the account has no transactions", async () => {
    fakeApi();
    renderPage("/accounts/1");

    expect(await screen.findByText("No transactions in this account yet.")).toBeInTheDocument();
  });

  it("shows the account's name and type", async () => {
    fakeApi();
    renderPage("/accounts/1");

    expect(await screen.findByText("Wells Fargo")).toBeInTheDocument();
    expect(screen.getByText("Checking")).toBeInTheDocument();
  });

  it("says when the account doesn't exist", async () => {
    fakeApi();
    renderPage("/accounts/999");

    expect(await screen.findByText("Account not found")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
  });
});
