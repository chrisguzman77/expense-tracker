import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { currentMonthValue, monthLabel, shiftMonth } from "../lib/dates";
import { server } from "../test/server";
import { SummaryPage } from "./SummaryPage";

type Row = { category_id: number; name: string; color: string; icon: string; total: string };

const spending: Row[] = [
  { category_id: 1, name: "Rent", color: "sky", icon: "🏠", total: "900.00" },
  { category_id: 2, name: "Food", color: "amber", icon: "🍔", total: "12.50" },
  { category_id: 3, name: "Travel", color: "teal", icon: "✈️", total: "0" },
];

function fakeSummary(rows: Row[]) {
  const requested: string[] = [];
  server.use(
    http.get("/api/summary", ({ request }) => {
      const url = new URL(request.url);
      requested.push(`${url.searchParams.get("year")}-${url.searchParams.get("month")}`);
      return HttpResponse.json(rows);
    }),
  );
  return requested;
}

function renderPage() {
  const router = createMemoryRouter([{ path: "/summary", element: <SummaryPage /> }], {
    initialEntries: ["/summary"],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const asParam = (value: string) => {
  const [y, m] = value.split("-").map(Number);
  return `${y}-${m}`;
};

describe("SummaryPage", () => {
  it("opens on the current month with its total and categories ranked", async () => {
    const requested = fakeSummary(spending);
    renderPage();

    expect(screen.getByRole("heading", { name: monthLabel(currentMonthValue()) })).toBeInTheDocument();
    expect(await screen.findByText("$912.50")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Categories this month" });
    const rows = within(list).getAllByRole("listitem").map((li) => li.textContent);
    // Chips are aria-hidden but their emoji still count toward textContent.
    expect(rows).toEqual(["🏠Rent$900.0099%", "🍔Food$12.501%", "✈️Travel$0.00"]);
    expect(requested).toEqual([asParam(currentMonthValue())]);
  });

  it("steps back a month and can't go past the current month", async () => {
    const requested = fakeSummary(spending);
    renderPage();
    const user = userEvent.setup();
    await screen.findByText("$912.50");

    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Previous month" }));

    const previous = shiftMonth(currentMonthValue(), -1);
    expect(await screen.findByRole("heading", { name: monthLabel(previous) })).toBeInTheDocument();
    await expect.poll(() => requested.at(-1)).toBe(asParam(previous));
    expect(screen.getByRole("button", { name: "Next month" })).toBeEnabled();
  });

  it("says when nothing was spent that month", async () => {
    fakeSummary([{ category_id: 3, name: "Travel", color: "teal", icon: "✈️", total: "0" }]);
    renderPage();

    expect(await screen.findByText(`No spending in ${monthLabel(currentMonthValue())}`)).toBeInTheDocument();
  });

  it("computes shares from spending only, so a refund can't push a category past 100%", async () => {
    fakeSummary([
      { category_id: 2, name: "Food", color: "amber", icon: "🍔", total: "50.00" },
      { category_id: 4, name: "Clothes", color: "rose", icon: "👕", total: "-20.00" },
    ]);
    renderPage();

    expect(await screen.findByText("$30.00")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Categories this month" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "🍔Food$50.00100%",
      "👕Clothes-$20.00",
    ]);
  });

  it("lists a month that only has refunds", async () => {
    fakeSummary([{ category_id: 4, name: "Clothes", color: "rose", icon: "👕", total: "-20.00" }]);
    renderPage();

    expect(await screen.findByRole("list", { name: "Categories this month" })).toHaveTextContent("Clothes-$20.00");
  });
});
