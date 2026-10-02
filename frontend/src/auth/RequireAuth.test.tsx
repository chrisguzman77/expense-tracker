import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { RequireAuth } from "./RequireAuth";

function renderProtected() {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [{ path: "/", element: <div>secret dashboard</div> }],
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
}

describe("RequireAuth", () => {
  it("renders the protected route when /api/auth/me returns a user", async () => {
    server.use(http.get("/api/auth/me", () => HttpResponse.json({ id: 1, email: "a@b.c" })));

    renderProtected();

    expect(await screen.findByText("secret dashboard")).toBeInTheDocument();
  });

  it("redirects to /login when /api/auth/me returns 401", async () => {
    server.use(
      http.get("/api/auth/me", () =>
        HttpResponse.json({ detail: "Not Authenticated" }, { status: 401 }),
      ),
    );

    renderProtected();

    expect(await screen.findByText("login page")).toBeInTheDocument();
  });
});
