import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { NewCategoryPage } from "./NewCategoryPage";
import { NewExpensePage } from "./NewExpensePage";

// Crosses both screens with one QueryClient: per-page tests each start from a
// fresh fetch and cannot see a stale cached category list.
describe("creating a category from the new-expense screen", () => {
  it("comes back with the new category selected and saves the expense under it", async () => {
    const categories = [
      { id: 1, name: "Food", color: "amber", icon: "🍔" },
      { id: 2, name: "Rent", color: "sky", icon: "🏠" },
    ];
    const posted: { category_id: number }[] = [];
    server.use(
      http.get("/api/categories", () => HttpResponse.json(categories)),
      http.post("/api/categories", async ({ request }) => {
        const row = { id: 7, ...((await request.json()) as { name: string; color: string; icon: string }) };
        categories.push(row);
        return HttpResponse.json(row, { status: 201 });
      }),
      http.post("/api/expenses", async ({ request }) => {
        const body = (await request.json()) as { category_id: number };
        posted.push(body);
        return HttpResponse.json(
          { id: 50, ...body, category: categories.find((c) => c.id === body.category_id) },
          { status: 201 },
        );
      }),
    );
    const router = createMemoryRouter(
      [
        { path: "/", element: <p>expenses list</p> },
        { path: "/expenses/new", element: <NewExpensePage /> },
        { path: "/categories/new", element: <NewCategoryPage /> },
      ],
      { initialEntries: ["/expenses/new"] },
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

    await user.click(screen.getByRole("button", { name: "Add expense" }));
    expect(await screen.findByText("expenses list")).toBeInTheDocument();
    expect(posted).toEqual([expect.objectContaining({ category_id: 7 })]);
  });
});
