import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { EditCategoryPage } from "./EditCategoryPage";

const food = { id: 1, name: "Food", color: "amber", icon: "🍔", kind: "spending" };
const rent = { id: 2, name: "Rent", color: "sky", icon: "🏠", kind: "spending" };

function fakeApi({ inUse = false } = {}) {
  const rows = [food, rent];
  const put: unknown[] = [];
  const deleted: number[] = [];
  server.use(
    http.get("/api/categories", () => HttpResponse.json(rows)),
    http.put("/api/categories/:id", async ({ params, request }) => {
      const id = Number(params.id);
      const body = (await request.json()) as { name: string };
      put.push({ id, ...body });
      if (rows.some((r) => r.name === body.name && r.id !== id)) {
        return HttpResponse.json({ detail: "Category name taken" }, { status: 409 });
      }
      return HttpResponse.json({ id, ...body });
    }),
    http.delete("/api/categories/:id", ({ params }) => {
      deleted.push(Number(params.id));
      if (inUse) return HttpResponse.json({ detail: "Category has transactions" }, { status: 409 });
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { put, deleted };
}

function renderPage(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/categories/:id/edit", element: <EditCategoryPage /> },
      { path: "/categories", element: <p>categories tab</p> },
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

describe("EditCategoryPage", () => {
  it("starts with the category's values and explains what changing the kind does", async () => {
    fakeApi();
    renderPage("/categories/1/edit");

    expect(await screen.findByLabelText("Name")).toHaveValue("Food");
    expect(screen.getByLabelText("Emoji")).toHaveValue("🍔");
    expect(screen.getByRole("radio", { name: "Amber" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Spending" })).toBeChecked();
    expect(screen.getByText("Changing the kind also changes past months in the summary.")).toBeInTheDocument();
  });

  it("saves the name, emoji, color and kind, refreshes transactions and returns to Categories", async () => {
    const { put } = fakeApi();
    const { queryClient } = renderPage("/categories/1/edit");
    queryClient.setQueryData(["transactions"], []);
    queryClient.setQueryData(["summary", 2026, 10], []);
    const user = userEvent.setup();

    const name = await screen.findByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Groceries");
    const emoji = screen.getByLabelText("Emoji");
    await user.clear(emoji);
    await user.type(emoji, "🛒");
    await user.click(screen.getByRole("radio", { name: "Sky" }));
    await user.click(screen.getByRole("radio", { name: "Transfer" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("categories tab")).toBeInTheDocument();
    expect(put).toEqual([{ id: 1, name: "Groceries", icon: "🛒", color: "sky", kind: "transfer" }]);
    // Transaction rows show the category, and the summary depends on its kind.
    expect(queryClient.getQueryState(["transactions"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["summary", 2026, 10])?.isInvalidated).toBe(true);
  });

  it("shows the server message when the name is taken", async () => {
    fakeApi();
    renderPage("/categories/1/edit");
    const user = userEvent.setup();

    const name = await screen.findByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Rent");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Category name taken");
  });

  it("says when the category doesn't exist", async () => {
    fakeApi();
    renderPage("/categories/99/edit");

    expect(await screen.findByText("Category not found")).toBeInTheDocument();
  });

  it("asks before deleting; Cancel keeps the category", async () => {
    const { deleted } = fakeApi();
    renderPage("/categories/1/edit");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete category" }));
    expect(screen.getByText("Delete this category? This can't be undone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete category" })).toBeInTheDocument();
    expect(deleted).toEqual([]);
  });

  it("deletes after confirmation and returns to Categories", async () => {
    const { deleted } = fakeApi();
    renderPage("/categories/1/edit");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete category" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("categories tab")).toBeInTheDocument();
    expect(deleted).toEqual([1]);
  });

  it("explains why a category with transactions can't be deleted, and Cancel clears it", async () => {
    fakeApi({ inUse: true });
    renderPage("/categories/1/edit");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete category" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This category still has transactions; move or delete them first.",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
