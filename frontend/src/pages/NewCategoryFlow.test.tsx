import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { NewCategoryPage } from "./NewCategoryPage";
import { NewTransactionPage } from "./NewTransactionPage";

// Crosses both screens with one QueryClient: per-page tests each start from a
// fresh fetch and cannot see a stale cached category list.
describe("creating a category from the new-transaction screen", () => {
  it("comes back with the new category selected and saves the transaction under it", async () => {
    const categories = [
      { id: 1, name: "Food", color: "amber", icon: "🍔", kind: "spending" },
      { id: 2, name: "Rent", color: "sky", icon: "🏠", kind: "spending" },
    ];
    const wallet = { id: 1, name: "Wallet", type: "cash" };
    const posted: { category_id: number }[] = [];
    server.use(
      http.get("/api/categories", () => HttpResponse.json(categories)),
      http.get("/api/accounts", () => HttpResponse.json([wallet])),
      http.post("/api/categories", async ({ request }) => {
        const row = { id: 7, ...((await request.json()) as { name: string; color: string; icon: string; kind: string }) };
        categories.push(row);
        return HttpResponse.json(row, { status: 201 });
      }),
      http.post("/api/transactions", async ({ request }) => {
        const body = (await request.json()) as { category_id: number };
        posted.push(body);
        return HttpResponse.json(
          { id: 50, ...body, category: categories.find((c) => c.id === body.category_id), account: wallet },
          { status: 201 },
        );
      }),
    );
    const router = createMemoryRouter(
      [
        { path: "/", element: <p>transactions list</p> },
        { path: "/transactions/new", element: <NewTransactionPage /> },
        { path: "/categories/new", element: <NewCategoryPage /> },
      ],
      { initialEntries: ["/transactions/new"] },
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Amount"), "7.25");
    await user.click(screen.getByRole("button", { name: "+ New category" }));
    await user.type(await screen.findByLabelText("Name"), "Travel");
    await user.click(screen.getByRole("button", { name: "Add category" }));

    expect(await screen.findByDisplayValue("7.25")).toBeInTheDocument();
    const select = screen.getByLabelText("Category") as HTMLSelectElement;
    expect(select).toHaveValue("7");
    expect(select.selectedOptions[0].textContent).toContain("Travel");

    await user.click(screen.getByRole("button", { name: "Add transaction" }));
    expect(await screen.findByText("transactions list")).toBeInTheDocument();
    expect(posted).toEqual([expect.objectContaining({ category_id: 7 })]);
  });
});
