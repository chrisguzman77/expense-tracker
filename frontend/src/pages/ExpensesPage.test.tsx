import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider, useParams } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { localToday } from "../lib/dates";
import { server } from "../test/server";
import { ExpensesPage } from "./ExpensesPage";

type Category = { id: number; name: string; color: string; icon: string };
type Expense = { id: number; amount: string; spent_on: string; note: string | null; category: Category };
type SummaryRow = { category_id: number; name: string; color: string; icon: string; total: string };

const food = { id: 1, name: "Food", color: "amber", icon: "🍔" };
const rent = { id: 2, name: "Rent", color: "sky", icon: "🏠" };

const row = (c: Category, total: string): SummaryRow => ({ category_id: c.id, name: c.name, color: c.color, icon: c.icon, total });

function fakeApi(expenses: Expense[], summary: SummaryRow[]) {
  server.use(
    http.get("/api/expenses", () => HttpResponse.json(expenses)),
    http.get("/api/summary", () => HttpResponse.json(summary)),
  );
}

function Detail() {
  return <p>detail of {useParams().id}</p>;
}

function renderPage() {
  const routes = [
    { path: "/", element: <ExpensesPage /> },
    { path: "/expenses/new", element: <p>new expense screen</p> },
    { path: "/expenses/:id", element: <Detail /> },
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

describe("ExpensesPage", () => {
  it("shows this month's total in the header", async () => {
    fakeApi([], [row(rent, "900.00"), row(food, "12.50")]);
    renderPage();

    expect(await screen.findByText("$912.50")).toBeInTheDocument();
  });

  it("groups expenses under date headings, newest first", async () => {
    fakeApi(
      [
        { id: 11, amount: "12.50", spent_on: localToday(), note: "Lunch", category: food },
        { id: 10, amount: "900.00", spent_on: "2025-03-05", note: null, category: rent },
      ],
      [],
    );
    renderPage();

    const today = await screen.findByRole("region", { name: "Today" });
    expect(within(today).getByRole("link", { name: /lunch/i })).toHaveTextContent(/Food.*Lunch.*\$12\.50/);
    const older = screen.getByRole("region", { name: "Mar 5, 2025" });
    expect(within(older).getByRole("link", { name: /rent/i })).toHaveTextContent("$900.00");
  });

  it("opens an expense's detail screen when its row is tapped", async () => {
    fakeApi([{ id: 11, amount: "12.50", spent_on: localToday(), note: "Lunch", category: food }], []);
    renderPage();

    await userEvent.setup().click(await screen.findByRole("link", { name: /lunch/i }));

    expect(await screen.findByText("detail of 11")).toBeInTheDocument();
  });

  it("opens the new expense screen from the + button", async () => {
    fakeApi([], []);
    renderPage();

    await userEvent.setup().click(await screen.findByRole("link", { name: "Add expense" }));

    expect(await screen.findByText("new expense screen")).toBeInTheDocument();
  });

  it("says when there are no expenses", async () => {
    fakeApi([], []);
    renderPage();

    expect(await screen.findByText(/no expenses yet/i)).toBeInTheDocument();
  });

  describe("breakdown card", () => {
    it("lists the top categories with amounts, largest first", async () => {
      fakeApi([], [row(rent, "900.00"), row(food, "12.50"), row({ id: 3, name: "Travel", color: "teal", icon: "✈️" }, "0")]);
      renderPage();

      const legend = await screen.findByRole("list", { name: "Top categories" });
      expect(within(legend).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Rent$900.00", "Food$12.50"]);
    });

    it("links to Summary when there are more than four categories", async () => {
      const cats = [1, 2, 3, 4, 5, 6].map((id) => ({ id, name: `Cat${id}`, color: "slate", icon: "🏷️" }));
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
