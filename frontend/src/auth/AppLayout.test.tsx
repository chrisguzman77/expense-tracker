import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { GradientHeader } from "../components/GradientHeader";
import { server } from "../test/server";
import { AppLayout } from "./AppLayout";
import { RequireAuth } from "./RequireAuth";

function renderLayout() {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                path: "/",
                element: (
                  <GradientHeader>
                    <p>home content</p>
                  </GradientHeader>
                ),
              },
              { path: "/categories", element: <p>categories content</p> },
            ],
          },
          { path: "/settings", element: <p>settings screen</p> },
        ],
      },
      { path: "/login", element: <p>login page</p> },
    ],
    { initialEntries: ["/"] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const me = () => http.get("/api/auth/me", () => HttpResponse.json({ id: 1, email: "chris@example.com" }));

describe("AppLayout", () => {
  it("renders the child route with a tab bar", async () => {
    server.use(me());
    renderLayout();

    expect(await screen.findByText("home content")).toBeInTheDocument();
    const tabs = screen.getByRole("navigation", { name: "Tab bar" });
    expect(within(tabs).getAllByRole("link").map((l) => l.textContent)).toEqual(["Transactions", "Summary", "Categories", "Accounts"]);
  });

  it("switches tabs from the tab bar", async () => {
    server.use(me());
    renderLayout();
    await screen.findByText("home content");

    await userEvent.setup().click(within(screen.getByRole("navigation", { name: "Tab bar" })).getByRole("link", { name: "Categories" }));

    expect(await screen.findByText("categories content")).toBeInTheDocument();
  });

  it("opens settings from the header's gear button", async () => {
    server.use(me());
    renderLayout();

    await userEvent.setup().click(await screen.findByRole("link", { name: "Settings" }));

    expect(await screen.findByText("settings screen")).toBeInTheDocument();
  });

  it("puts the same tabs in the header for wide screens", async () => {
    server.use(me());
    renderLayout();

    const top = await screen.findByRole("navigation", { name: "Top navigation" });
    expect(within(top).getAllByRole("link").map((l) => l.textContent)).toEqual(["Transactions", "Summary", "Categories", "Accounts"]);
  });
});
