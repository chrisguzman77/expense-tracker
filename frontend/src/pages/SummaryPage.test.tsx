import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { SummaryPage } from "./SummaryPage";

function currentMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function fakeSummary() {
  const requested: { year: string | null; month: string | null }[] = [];
  server.use(
    http.get("/api/summary", ({ request }) => {
      const url = new URL(request.url);
      requested.push({ year: url.searchParams.get("year"), month: url.searchParams.get("month") });
      return HttpResponse.json([
        { category_id: 1, name: "Rent", total: "900.00" },
        { category_id: 2, name: "Food", total: "12.50" },
        { category_id: 3, name: "Travel", total: "0" },
      ]);
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

describe("SummaryPage", () => {
  it("defaults to the current month and shows per-category totals and a grand total", async () => {
    const requested = fakeSummary();
    renderPage();

    const table = await screen.findByRole("table", { name: /summary/i });
    const rows = within(table).getAllByRole("row").map((r) => r.textContent);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Rent.*900\.00/),
        expect.stringMatching(/Food.*12\.50/),
        expect.stringMatching(/Travel.*0\.00/),
        expect.stringMatching(/Total.*912\.50/),
      ]),
    );
    const { year, month } = currentMonth();
    expect(requested).toEqual([{ year: String(year), month: String(month) }]);
  });

  it("refetches when the month changes", async () => {
    const requested = fakeSummary();
    renderPage();
    await screen.findByRole("table", { name: /summary/i });

    fireEvent.change(screen.getByLabelText(/month/i), { target: { value: "2025-03" } });

    await screen.findByDisplayValue("2025-03");
    await expect.poll(() => requested.at(-1)).toEqual({ year: "2025", month: "3" });
  });
});
