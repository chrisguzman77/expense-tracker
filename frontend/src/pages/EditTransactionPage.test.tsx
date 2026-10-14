import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { EditTransactionPage } from "./EditTransactionPage";

const food = { id: 1, name: "Food", color: "amber", icon: "🍔", kind: "spending" };
const rent = { id: 2, name: "Rent", color: "sky", icon: "🏠", kind: "spending" };
const wallet = { id: 1, name: "Wallet", type: "cash" };
const card = { id: 2, name: "Chase Freedom", type: "credit_card" };
const lunch = { id: 10, amount: "-12.50", occurred_on: "2026-10-10", note: "Lunch", category: food, account: wallet };
const refund = { id: 11, amount: "20.00", occurred_on: "2026-10-11", note: null, category: food, account: card };

function fakeApi({ failWith }: { failWith?: string } = {}) {
  const put: unknown[] = [];
  server.use(
    http.get("/api/transactions", () => HttpResponse.json([lunch, refund])),
    http.get("/api/accounts", () => HttpResponse.json([wallet, card])),
    http.get("/api/categories", () => HttpResponse.json([food, rent])),
    http.put("/api/transactions/:id", async ({ params, request }) => {
      const body = (await request.json()) as { account_id: number; category_id: number };
      put.push({ id: Number(params.id), ...body });
      if (failWith) return HttpResponse.json({ detail: failWith }, { status: 404 });
      const category = [food, rent].find((c) => c.id === body.category_id)!;
      const account = [wallet, card].find((a) => a.id === body.account_id)!;
      return HttpResponse.json({ id: Number(params.id), ...body, category, account });
    }),
  );
  return { put };
}

function renderPage(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/transactions/:id/edit", element: <EditTransactionPage /> },
      { path: "/transactions/:id", element: <p>detail screen</p> },
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

describe("EditTransactionPage", () => {
  it("starts with the transaction's values, money out without a minus sign", async () => {
    fakeApi();
    renderPage("/transactions/10/edit");

    expect(await screen.findByLabelText("Amount")).toHaveValue("12.50");
    expect(screen.getByRole("radio", { name: "Money out" })).toBeChecked();
    expect(screen.getByLabelText("Account")).toHaveValue("1");
    expect(screen.getByLabelText("Category")).toHaveValue("1");
    expect(screen.getByLabelText("Date")).toHaveValue("2026-10-10");
    expect(screen.getByLabelText("Note")).toHaveValue("Lunch");
  });

  it("starts on money in for a positive amount", async () => {
    fakeApi();
    renderPage("/transactions/11/edit");

    expect(await screen.findByLabelText("Amount")).toHaveValue("20.00");
    expect(screen.getByRole("radio", { name: "Money in" })).toBeChecked();
    expect(screen.getByLabelText("Note")).toHaveValue("");
  });

  it("keeps the stored sign when only the note changes", async () => {
    const { put } = fakeApi();
    renderPage("/transactions/10/edit");
    const user = userEvent.setup();

    const note = await screen.findByLabelText("Note");
    await user.clear(note);
    await user.type(note, "Dinner");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("detail screen")).toBeInTheDocument();
    expect(put).toEqual([
      { id: 10, account_id: 1, category_id: 1, amount: "-12.50", occurred_on: "2026-10-10", note: "Dinner" },
    ]);
  });

  it("saves every field with PUT, refreshes the summary and returns to the transaction", async () => {
    const { put } = fakeApi();
    const { queryClient } = renderPage("/transactions/10/edit");
    queryClient.setQueryData(["summary", 2026, 10], []);
    const user = userEvent.setup();

    const amount = await screen.findByLabelText("Amount");
    await user.click(screen.getByRole("radio", { name: "Money in" }));
    await user.clear(amount);
    await user.type(amount, "15");
    await user.selectOptions(screen.getByLabelText("Account"), "2");
    await user.selectOptions(screen.getByLabelText("Category"), "2");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("detail screen")).toBeInTheDocument();
    expect(put).toEqual([
      { id: 10, account_id: 2, category_id: 2, amount: "15", occurred_on: "2026-10-10", note: "Lunch" },
    ]);
    expect(queryClient.getQueryState(["summary", 2026, 10])?.isInvalidated).toBe(true);
  });

  it("has no new-category shortcut", async () => {
    fakeApi();
    renderPage("/transactions/10/edit");

    await screen.findByLabelText("Amount");
    expect(screen.queryByRole("button", { name: "+ New category" })).not.toBeInTheDocument();
  });

  it("shows the server message when saving fails", async () => {
    fakeApi({ failWith: "Category not found" });
    renderPage("/transactions/10/edit");
    const user = userEvent.setup();

    await screen.findByLabelText("Amount");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Category not found");
  });

  it("says when the transaction doesn't exist", async () => {
    fakeApi();
    renderPage("/transactions/99/edit");

    expect(await screen.findByText("Transaction not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/");
  });

  it("shows an error when a list fails to load", async () => {
    server.use(
      http.get("/api/transactions", () => HttpResponse.json({ detail: "Server error" }, { status: 500 })),
      http.get("/api/accounts", () => HttpResponse.json([])),
      http.get("/api/categories", () => HttpResponse.json([])),
    );
    renderPage("/transactions/10/edit");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument();
  });
});
