import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { NewAccountPage } from "./NewAccountPage";

function renderPage() {
  const posted: unknown[] = [];
  server.use(
    http.post("/api/accounts", async ({ request }) => {
      const body = (await request.json()) as { name: string; type: string };
      posted.push(body);
      if (body.name === "Taken") return HttpResponse.json({ detail: "Account name taken" }, { status: 409 });
      return HttpResponse.json({ id: 5, ...body }, { status: 201 });
    }),
  );
  const router = createMemoryRouter(
    [
      { path: "/accounts/new", element: <NewAccountPage /> },
      { path: "/accounts", element: <p>accounts tab</p> },
    ],
    { initialEntries: ["/accounts/new"] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { posted };
}

describe("NewAccountPage", () => {
  it("creates an account with a name and type, then returns to the Accounts tab", async () => {
    const { posted } = renderPage();
    const user = userEvent.setup();

    expect(screen.getByRole("radio", { name: "Checking" })).toBeChecked();
    await user.type(screen.getByLabelText("Name"), "Chase Freedom");
    await user.click(screen.getByRole("radio", { name: "Credit card" }));
    await user.click(screen.getByRole("button", { name: "Add account" }));

    expect(await screen.findByText("accounts tab")).toBeInTheDocument();
    expect(posted).toEqual([{ name: "Chase Freedom", type: "credit_card" }]);
  });

  it("requires a name without calling the API", async () => {
    const { posted } = renderPage();

    await userEvent.setup().click(screen.getByRole("button", { name: "Add account" }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(posted).toEqual([]);
  });

  it("shows the server message when the name is taken", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Name"), "Taken");
    await user.click(screen.getByRole("button", { name: "Add account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Account name taken");
  });
});
