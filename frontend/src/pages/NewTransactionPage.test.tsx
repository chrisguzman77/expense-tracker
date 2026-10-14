import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, type InitialEntry, RouterProvider, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { localToday } from "../lib/dates";
import { server } from "../test/server";
import { NewTransactionPage } from "./NewTransactionPage";

const food = { id: 1, name: "Food", color: "amber", icon: "🍔" };
const rent = { id: 2, name: "Rent", color: "sky", icon: "🏠" };
const wallet = { id: 1, name: "Wallet", type: "cash" };
const card = { id: 2, name: "Chase Freedom", type: "credit_card" };

function fakeApi(categories: (typeof food)[], accounts: (typeof wallet)[] = [wallet]) {
  const posted: unknown[] = [];
  server.use(
    http.get("/api/categories", () => HttpResponse.json(categories)),
    http.get("/api/accounts", () => HttpResponse.json(accounts)),
    http.post("/api/transactions", async ({ request }) => {
      const body = (await request.json()) as { account_id: number; category_id: number };
      posted.push(body);
      const category = categories.find((c) => c.id === body.category_id)!;
      const account = accounts.find((a) => a.id === body.account_id)!;
      return HttpResponse.json({ id: 50, ...body, category, account }, { status: 201 });
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

function renderPage(entry: InitialEntry = "/transactions/new") {
  const router = createMemoryRouter(
    [
      { path: "/", element: <p>transactions list</p> },
      { path: "/transactions/new", element: <NewTransactionPage /> },
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

describe("NewTransactionPage", () => {
  it("adds money out by default, in the only account and first category, then returns to the list", async () => {
    const { posted } = fakeApi([food, rent]);
    const { queryClient } = renderPage();
    queryClient.setQueryData(["summary", 2026, 10], []);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Amount"), "12.50");
    await user.type(screen.getByLabelText("Note"), "Lunch");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    expect(await screen.findByText("transactions list")).toBeInTheDocument();
    expect(posted).toEqual([
      { account_id: 1, category_id: 1, amount: "-12.50", occurred_on: localToday(), note: "Lunch" },
    ]);
    // The breakdown card and Summary tab must refetch their totals.
    expect(queryClient.getQueryState(["summary", 2026, 10])?.isInvalidated).toBe(true);
  });

  it("sends a positive amount for money in", async () => {
    const { posted } = fakeApi([food]);
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("radio", { name: "Money in" }));
    await user.type(screen.getByLabelText("Amount"), "20");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    await screen.findByText("transactions list");
    expect(posted).toEqual([expect.objectContaining({ amount: "20" })]);
  });

  it("makes you pick an account when there are several", async () => {
    const { posted } = fakeApi([food], [wallet, card]);
    renderPage();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Amount"), "5");
    expect(screen.getByLabelText("Account")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));
    expect(await screen.findByText("Pick an account")).toBeInTheDocument();
    expect(posted).toEqual([]);

    await user.selectOptions(screen.getByLabelText("Account"), "2");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));
    await screen.findByText("transactions list");
    expect(posted).toEqual([expect.objectContaining({ account_id: 2 })]);
  });

  it("rejects a non-positive amount without calling the API", async () => {
    const { posted } = fakeApi([food]);
    renderPage();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Amount"), "0");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

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
      pathname: "/transactions/new",
      state: {
        draft: { direction: "in", amount: "7.25", note: "Tea", occurred_on: localToday(), category_id: "1", account_id: "1" },
        categoryId: 2,
      },
    });

    expect(await screen.findByLabelText("Amount")).toHaveValue("7.25");
    expect(screen.getByLabelText("Note")).toHaveValue("Tea");
    expect(screen.getByLabelText("Category")).toHaveValue("2");
    expect(screen.getByRole("radio", { name: "Money in" })).toBeChecked();
  });

  it("asks for a category first when there are none", async () => {
    fakeApi([]);
    renderPage();

    expect(await screen.findByText(/create a category first/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ New category" })).toHaveAttribute("href", "/categories/new");
    expect(screen.queryByRole("button", { name: "Add transaction" })).not.toBeInTheDocument();
  });

  it("asks for an account first when there are none", async () => {
    fakeApi([food], []);
    renderPage();

    expect(await screen.findByText("Add an account first.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ New account" })).toHaveAttribute("href", "/accounts/new");
    expect(screen.queryByRole("button", { name: "Add transaction" })).not.toBeInTheDocument();
  });
});
