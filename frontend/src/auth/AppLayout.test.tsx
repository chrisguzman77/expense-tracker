import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
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
              { path: "/", element: <div>home content</div> },
              { path: "/categories", element: <div>categories content</div> },
            ],
          },
        ],
      },
      { path: "/login", element: <div>login page</div> },
    ],
    { initialEntries: ["/"] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient };
}

const me = () => http.get("/api/auth/me", () => HttpResponse.json({ id: 1, email: "chris@example.com" }));

describe("AppLayout", () => {
  it("shows the signed-in user's email and the child route", async () => {
    server.use(me());

    renderLayout();

    expect(await screen.findByText(/chris@example.com/)).toBeInTheDocument();
    expect(screen.getByText("home content")).toBeInTheDocument();
  });

  it("navigates between sections", async () => {
    server.use(me());
    renderLayout();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("link", { name: /categories/i }));

    expect(await screen.findByText("categories content")).toBeInTheDocument();
  });

  it("logs out, clears cached auth, and goes to /login", async () => {
    let loggedOut = false;
    server.use(
      me(),
      http.post("/api/auth/logout", () => {
        loggedOut = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { queryClient } = renderLayout();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /log out/i }));

    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(loggedOut).toBe(true);
    expect(queryClient.getQueryData(["me"])).toBeUndefined();
  });
});
