import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, type InitialEntry, RouterProvider, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { NewCategoryPage } from "./NewCategoryPage";

function StateProbe({ label }: { label: string }) {
  return (
    <p>
      {label} {JSON.stringify(useLocation().state)}
    </p>
  );
}

function renderPage(entry: InitialEntry) {
  server.use(
    http.post("/api/categories", async ({ request }) => {
      const body = (await request.json()) as object;
      return HttpResponse.json({ id: 7, ...body }, { status: 201 });
    }),
  );
  const router = createMemoryRouter(
    [
      { path: "/categories/new", element: <NewCategoryPage /> },
      { path: "/expenses/new", element: <StateProbe label="expense form" /> },
      { path: "/categories", element: <StateProbe label="categories tab" /> },
    ],
    { initialEntries: [entry] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

async function createTravel() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Name"), "Travel");
  await user.click(screen.getByRole("button", { name: "Add category" }));
}

describe("NewCategoryPage", () => {
  it("returns to the expense form with the draft and the new category selected", async () => {
    renderPage({ pathname: "/categories/new", state: { draft: { amount: "7.25" } } });

    await createTravel();

    const probe = await screen.findByText(/expense form/);
    expect(JSON.parse(probe.textContent!.replace("expense form ", ""))).toEqual({
      draft: { amount: "7.25" },
      categoryId: 7,
    });
  });

  it("goes back to the expense form, keeping the draft", async () => {
    renderPage({ pathname: "/categories/new", state: { draft: { amount: "7.25" } } });

    await userEvent.setup().click(screen.getByRole("link", { name: /back/i }));

    expect((await screen.findByText(/expense form/)).textContent).toContain('"amount":"7.25"');
  });

  it("returns to the Categories tab when opened without a draft", async () => {
    renderPage("/categories/new");

    await createTravel();

    expect(await screen.findByText(/categories tab/)).toBeInTheDocument();
  });
});
