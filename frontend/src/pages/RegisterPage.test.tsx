import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { RegisterPage } from "./RegisterPage";

function renderRegister() {
  const router = createMemoryRouter(
    [
      { path: "/register", element: <RegisterPage /> },
      { path: "/", element: <div>home</div> },
    ],
    { initialEntries: ["/register"] },
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
  await user.click(screen.getByRole("button", { name: /create account/i }));
}

describe("RegisterPage", () => {
  it("rejects passwords shorter than 8 characters without calling the API", async () => {
    let called = false;
    server.use(
      http.post("/api/auth/register", () => {
        called = true;
        return HttpResponse.json({ id: 1, email: "chris@example.com" }, { status: 201 });
      }),
    );
    renderRegister();

    await fillAndSubmit("chris@example.com", "short");

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("shows the server message on 409", async () => {
    server.use(
      http.post("/api/auth/register", () =>
        HttpResponse.json({ detail: "Email already registered" }, { status: 409 }),
      ),
    );
    renderRegister();

    await fillAndSubmit("chris@example.com", "longenough");

    expect(await screen.findByRole("alert")).toHaveTextContent("Email already registered");
  });

  it("posts the new account and navigates home on success", async () => {
    let body: unknown;
    server.use(
      http.post("/api/auth/register", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 1, email: "chris@example.com" }, { status: 201 });
      }),
    );
    const { queryClient } = renderRegister();

    await fillAndSubmit("chris@example.com", "longenough");

    expect(await screen.findByText("home")).toBeInTheDocument();
    expect(body).toEqual({ email: "chris@example.com", password: "longenough" });
    expect(queryClient.getQueryData(["me"])).toEqual({ id: 1, email: "chris@example.com" });
  });
});
