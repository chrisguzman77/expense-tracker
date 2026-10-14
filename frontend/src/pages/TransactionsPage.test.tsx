import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider, useParams } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { localToday } from "../lib/dates";
import { server } from "../test/server";
import { TransactionsPage } from "./TransactionsPage";

type Category = { id: number; name: string; color: string; icon: string; kind: string };
type Account = { id: number; name: string; type: string };
type Transaction = {
  id: number;
  amount: string;
  occurred_on: string;
  note: string | null;
  category: Category;
  account: Account;
};
type SummaryRow = { category_id: number; name: string; color: string; icon: string; total: string };

const food = { id: 1, name: "Food", color: "amber", icon: "🍔", kind: "spending" };
const rent = { id: 2, name: "Rent", color: "sky", icon: "🏠", kind: "spending" };
const paycheck = { id: 3, name: "Paycheck", color: "emerald", icon: "💰", kind: "income" };
const wallet = { id: 1, name: "Wallet", type: "cash" };

const row = (c: Category, total: string): SummaryRow => ({ category_id: c.id, name: c.name, color: c.color, icon: c.icon, total });

function fakeApi(transactions: Transaction[], summary: SummaryRow[]) {
  server.use(
    http.get("/api/transactions", () => HttpResponse.json(transactions)),
    http.get("/api/summary", () => HttpResponse.json(summary)),
  );
}

function Detail() {
  return <p>detail of {useParams().id}</p>;
}

function renderPage() {
  const routes = [
    { path: "/", element: <TransactionsPage /> },
    { path: "/transactions/new", element: <p>new transaction screen</p> },
    { path: "/transactions/:id", element: <Detail /> },
    { path: "/summary", element: <p>summary tab</p> },
  ];
  const router = createMemoryRouter(routes, { initialEntries: ["/"] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return render(ui);
}

describe("TransactionsPage", () => {
  it("shows this month's total in the header", async () => {
    fakeApi([], [row(rent, "900.00"), row(food, "12.50")]);
    renderPage();

    expect(await screen.findByText("$912.50")).toBeInTheDocument();
  });

  it("groups transactions under date headings, newest first", async () => {
    fakeApi(
      [
        { id: 11, amount: "-12.50", occurred_on: localToday(), note: "Lunch", category: food, account: wallet },
        { id: 10, amount: "-900.00", occurred_on: "2025-03-05", note: null, category: rent, account: wallet },
      ],
      [],
    );
    renderPage();

    const today = await screen.findByRole("region", { name: "Today" });
    expect(within(today).getByRole("link", { name: /lunch/i })).toHaveTextContent(/Food.*Wallet · Lunch.*\$12\.50/);
    const older = screen.getByRole("region", { name: "Mar 5, 2025" });
    expect(within(older).getByRole("link", { name: /rent/i })).toHaveTextContent("$900.00");
  });

  it("shows money in with a plus sign", async () => {
    fakeApi(
      [{ id: 12, amount: "2000.00", occurred_on: localToday(), note: null, category: paycheck, account: wallet }],
      [],
    );
    renderPage();

    expect(await screen.findByRole("link", { name: /paycheck/i })).toHaveTextContent("+$2,000.00");
  });

  it("opens a transaction's detail screen when its row is tapped", async () => {
    fakeApi(
      [{ id: 11, amount: "-12.50", occurred_on: localToday(), note: "Lunch", category: food, account: wallet }],
      [],
    );
    renderPage();

    await userEvent.setup().click(await screen.findByRole("link", { name: /lunch/i }));

    expect(await screen.findByText("detail of 11")).toBeInTheDocument();
  });

  it("opens the new transaction screen from the + button", async () => {
    fakeApi([], []);
    renderPage();

    await userEvent.setup().click(await screen.findByRole("link", { name: "Add transaction" }));

    expect(await screen.findByText("new transaction screen")).toBeInTheDocument();
  });

  it("says when there are no transactions", async () => {
    fakeApi([], []);
    renderPage();

    expect(await screen.findByText(/no transactions yet/i)).toBeInTheDocument();
  });

  describe("breakdown card", () => {
    it("lists the top categories with amounts, largest first", async () => {
      fakeApi([], [row(rent, "900.00"), row(food, "12.50"), row({ id: 3, name: "Travel", color: "teal", icon: "✈️", kind: "spending" }, "0")]);
      renderPage();

      const legend = await screen.findByRole("list", { name: "Top categories" });
      expect(within(legend).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Rent$900.00", "Food$12.50"]);
    });

    it("links to Summary when there are more than four categories", async () => {
      const cats = [1, 2, 3, 4, 5, 6].map((id) => ({ id, name: `Cat${id}`, color: "slate", icon: "🏷️", kind: "spending" }));
      fakeApi([], cats.map((c, i) => row(c, `${60 - i * 10}.00`)));
      renderPage();

      const more = await screen.findByRole("link", { name: "+ 2 more" });
      await userEvent.setup().click(more);
      expect(await screen.findByText("summary tab")).toBeInTheDocument();
    });

    it("collapses to one line and remembers that across visits", async () => {
      fakeApi([], [row(rent, "900.00"), row(food, "12.50")]);
      const { unmount } = renderPage();
      const user = userEvent.setup();

      await user.click(await screen.findByRole("button", { name: "Hide breakdown" }));

      expect(screen.queryByRole("list", { name: "Top categories" })).not.toBeInTheDocument();
      expect(screen.getByText(/Top: Rent/)).toHaveTextContent("Top: Rent $900.00");
      expect(localStorage.getItem("breakdown-collapsed")).toBe("true");

      unmount();
      renderPage();
      expect(await screen.findByRole("button", { name: "Show breakdown" })).toHaveAttribute("aria-expanded", "false");

      await user.click(screen.getByRole("button", { name: "Show breakdown" }));
      expect(await screen.findByRole("list", { name: "Top categories" })).toBeInTheDocument();
    });

    it("says when nothing has been spent this month", async () => {
      fakeApi([], [row(food, "0")]);
      renderPage();

      expect(await screen.findByText("No spending yet this month")).toBeInTheDocument();
    });
  });
});
