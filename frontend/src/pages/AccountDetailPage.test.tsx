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

function fakeApi({ inUse = false, transactions = [] as object[] } = {}) {
  const deleted: number[] = [];
  const requested: (string | null)[] = [];
  server.use(
    http.get("/api/accounts", () => HttpResponse.json([wells])),
    http.get("/api/transactions", ({ request }) => {
      requested.push(new URL(request.url).searchParams.get("account_id"));
      return HttpResponse.json(transactions);
    }),
    http.delete("/api/accounts/:id", ({ params }) => {
      deleted.push(Number(params.id));
      if (inUse) return HttpResponse.json({ detail: "Account has transactions" }, { status: 409 });
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { deleted, requested };
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
  it("opens the edit screen", async () => {
    fakeApi();
    renderPage("/accounts/1");

    await userEvent.setup().click(await screen.findByRole("button", { name: "Edit account" }));

    expect(await screen.findByText("edit screen")).toBeInTheDocument();
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

  it("asks for confirmation; cancelling keeps the account", async () => {
    const { deleted } = fakeApi();
    renderPage("/accounts/1");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete account" }));
    expect(screen.getByText(/delete this account\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();
    expect(deleted).toEqual([]);
  });

  it("deletes after confirmation and returns to the Accounts tab", async () => {
    const { deleted } = fakeApi();
    renderPage("/accounts/1");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete account" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("accounts tab")).toBeInTheDocument();
    expect(deleted).toEqual([1]);
  });

  it("explains why an account with transactions can't be deleted, and Cancel clears it", async () => {
    fakeApi({ inUse: true });
    renderPage("/accounts/1");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete account" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This account still has transactions; delete them first.",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says when the account doesn't exist", async () => {
    fakeApi();
    renderPage("/accounts/999");

    expect(await screen.findByText("Account not found")).toBeInTheDocument();
  });
});
