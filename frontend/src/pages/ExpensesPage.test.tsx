import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { ExpensesPage } from "./ExpensesPage";

type Category = { id: number; name: string };
type Expense = { id: number; amount: string; spent_on: string; note: string | null; category: Category };

const food = { id: 1, name: "Food" };
const rent = { id: 2, name: "Rent" };

function localToday() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// In-memory fake so create/delete affect the list like the real API.
function fakeApi(categories: Category[], initial: Expense[]) {
  const rows = [...initial];
  let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1;
  const posted: unknown[] = [];
  server.use(
    http.get("/api/categories", () => HttpResponse.json(categories)),
    http.get("/api/expenses", () => HttpResponse.json(rows)),
    http.post("/api/expenses", async ({ request }) => {
      const body = (await request.json()) as { category_id: number; amount: string; spent_on: string; note: string | null };
      posted.push(body);
      const category = categories.find((c) => c.id === body.category_id)!;
      const row = { id: nextId++, amount: body.amount, spent_on: body.spent_on, note: body.note, category };
      rows.unshift(row);
      return HttpResponse.json(row, { status: 201 });
    }),
    http.delete("/api/expenses/:id", ({ params }) => {
      rows.splice(rows.findIndex((r) => r.id === Number(params.id)), 1);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { posted };
}

function renderPage() {
  const router = createMemoryRouter([{ path: "/", element: <ExpensesPage /> }], { initialEntries: ["/"] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("ExpensesPage", () => {
  it("lists expenses with category, amount, date and note", async () => {
    fakeApi([food, rent], [{ id: 10, amount: "12.50", spent_on: "2026-10-05", note: "Lunch", category: food }]);
    renderPage();

    const row = (await screen.findByText("Lunch")).closest("li")!;
    expect(row).toHaveTextContent("Food");
    expect(row).toHaveTextContent("12.50");
    expect(row).toHaveTextContent("2026-10-05");
  });

  it("creates an expense with today's date by default and shows it", async () => {
    const { posted } = fakeApi([food, rent], []);
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("option", { name: "Food" });

    await user.selectOptions(screen.getByLabelText(/category/i), "1");
    await user.type(screen.getByLabelText(/amount/i), "12.50");
    await user.type(screen.getByLabelText(/note/i), "Lunch");
    await user.click(screen.getByRole("button", { name: /add expense/i }));

    expect(await screen.findByText("Lunch")).toBeInTheDocument();
    expect(posted).toEqual([{ category_id: 1, amount: "12.50", spent_on: localToday(), note: "Lunch" }]);
    expect(screen.getByLabelText(/amount/i)).toHaveValue("");
  });

  it("rejects a non-positive amount without calling the API", async () => {
    const { posted } = fakeApi([food], []);
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("option", { name: "Food" });

    await user.selectOptions(screen.getByLabelText(/category/i), "1");
    await user.type(screen.getByLabelText(/amount/i), "0");
    await user.click(screen.getByRole("button", { name: /add expense/i }));

    expect(await screen.findByText(/greater than 0/i)).toBeInTheDocument();
    expect(posted).toEqual([]);
  });

  it("deletes an expense", async () => {
    fakeApi(
      [food, rent],
      [
        { id: 10, amount: "12.50", spent_on: "2026-10-05", note: "Lunch", category: food },
        { id: 11, amount: "900.00", spent_on: "2026-10-01", note: null, category: rent },
      ],
    );
    renderPage();
    const user = userEvent.setup();
    const lunch = (await screen.findByText("Lunch")).closest("li")!;

    await user.click(within(lunch).getByRole("button", { name: /delete/i }));

    await screen.findByText("900.00");
    expect(screen.queryByText("Lunch")).not.toBeInTheDocument();
  });

  it("tells the user to create a category first when there are none", async () => {
    fakeApi([], []);
    renderPage();

    expect(await screen.findByText(/create a category first/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add expense/i })).not.toBeInTheDocument();
  });
});
