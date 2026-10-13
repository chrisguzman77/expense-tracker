import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { SettingsPage } from "./SettingsPage";

function renderSettings() {
  const router = createMemoryRouter(
    [
      { path: "/settings", element: <SettingsPage /> },
      { path: "/login", element: <p>login page</p> },
    ],
    { initialEntries: ["/settings"] },
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

describe("SettingsPage", () => {
  it("shows the signed-in email", async () => {
    server.use(me());
    renderSettings();

    expect(await screen.findByText("chris@example.com")).toBeInTheDocument();
  });

  it("defaults the theme to System and applies and remembers a choice", async () => {
    server.use(me());
    renderSettings();
    const user = userEvent.setup();

    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");

    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("logs out, clears cached data, and goes to /login", async () => {
    let loggedOut = false;
    server.use(
      me(),
      http.post("/api/auth/logout", () => {
        loggedOut = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { queryClient } = renderSettings();
    await screen.findByText("chris@example.com");

    await userEvent.setup().click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(loggedOut).toBe(true);
    expect(queryClient.getQueryData(["me"])).toBeUndefined();
  });
});
