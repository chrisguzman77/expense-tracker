import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { EditAccountPage } from "./EditAccountPage";

const wells = { id: 1, name: "Wells Fargo", type: "checking" };
const card = { id: 2, name: "Chase Freedom", type: "credit_card" };

function fakeApi() {
  const rows = [card, wells];
  const put: unknown[] = [];
  server.use(
    http.get("/api/accounts", () => HttpResponse.json(rows)),
    http.put("/api/accounts/:id", async ({ params, request }) => {
      const id = Number(params.id);
      const body = (await request.json()) as { name: string; type: string };
      put.push({ id, ...body });
      if (rows.some((r) => r.name === body.name && r.id !== id)) {
        return HttpResponse.json({ detail: "Account name taken" }, { status: 409 });
      }
      return HttpResponse.json({ id, ...body });
    }),
  );
  return { put };
}

function renderPage(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/accounts/:id/edit", element: <EditAccountPage /> },
      { path: "/accounts/:id", element: <p>account screen</p> },
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

describe("EditAccountPage", () => {
  it("starts with the account's name and type", async () => {
    fakeApi();
    renderPage("/accounts/1/edit");

    expect(await screen.findByLabelText("Name")).toHaveValue("Wells Fargo");
    expect(screen.getByRole("radio", { name: "Checking" })).toBeChecked();
  });

  it("saves the name and type, refreshes transactions and returns to the account", async () => {
    const { put } = fakeApi();
    const { queryClient } = renderPage("/accounts/1/edit");
    queryClient.setQueryData(["transactions"], []);
    const user = userEvent.setup();

    const name = await screen.findByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Wells Fargo savings");
    await user.click(screen.getByRole("radio", { name: "Savings" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("account screen")).toBeInTheDocument();
    expect(put).toEqual([{ id: 1, name: "Wells Fargo savings", type: "savings" }]);
    // Transaction rows show the account's name.
    expect(queryClient.getQueryState(["transactions"])?.isInvalidated).toBe(true);
  });

  it("shows the server message when the name is taken", async () => {
    fakeApi();
    renderPage("/accounts/1/edit");
    const user = userEvent.setup();

    const name = await screen.findByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Chase Freedom");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Account name taken");
  });

  it("says when the account doesn't exist", async () => {
    fakeApi();
    renderPage("/accounts/99/edit");

    expect(await screen.findByText("Account not found")).toBeInTheDocument();
  });
});
