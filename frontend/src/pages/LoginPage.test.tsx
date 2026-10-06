import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { LoginPage } from "./LoginPage";

function renderLogin() {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <LoginPage /> },
      { path: "/", element: <div>home</div> },
    ],
    { initialEntries: ["/login"] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient };
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email/i), email);
  await user.type(screen.getByLabelText(/password/i), password);
  await user.click(screen.getByRole("button", { name: /log in/i }));
}

describe("LoginPage", () => {
  it("posts credentials and navigates home on success", async () => {
    let body: unknown;
    server.use(
      http.post("/api/auth/login", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 1, email: "chris@example.com" });
      }),
    );
    const { queryClient } = renderLogin();

    await fillAndSubmit("chris@example.com", "hunter22");

    expect(await screen.findByText("home")).toBeInTheDocument();
    expect(body).toEqual({ email: "chris@example.com", password: "hunter22" });
    expect(queryClient.getQueryData(["me"])).toEqual({ id: 1, email: "chris@example.com" });
  });

  it("shows the server message on 401", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json({ detail: "Invalid credentials" }, { status: 401 }),
      ),
    );
    renderLogin();

    await fillAndSubmit("chris@example.com", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
    expect(screen.queryByText("home")).not.toBeInTheDocument();
  });
});
