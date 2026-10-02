import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { RequireAuth } from "../auth/RequireAuth";
import { server } from "../test/server";
import { HomePage } from "./HomePage";

function renderHome() {
  const router = createMemoryRouter(
    [
      { element: <RequireAuth />, children: [{ path: "/", element: <HomePage /> }] },
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

describe("HomePage", () => {
  it("shows the signed-in user's email", async () => {
    server.use(http.get("/api/auth/me", () => HttpResponse.json({ id: 1, email: "chris@example.com" })));

    renderHome();

    expect(await screen.findByText(/chris@example.com/)).toBeInTheDocument();
  });

  it("logs out, clears cached auth, and goes to /login", async () => {
    let loggedOut = false;
    server.use(
      http.get("/api/auth/me", () => HttpResponse.json({ id: 1, email: "chris@example.com" })),
      http.post("/api/auth/logout", () => {
        loggedOut = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { queryClient } = renderHome();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /log out/i }));

    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(loggedOut).toBe(true);
    expect(queryClient.getQueryData(["me"])).toBeUndefined();
  });
});
