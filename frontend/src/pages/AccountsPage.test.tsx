import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { AccountsPage } from "./AccountsPage";

const wells = { id: 1, name: "Wells Fargo", type: "checking" };
const chase = { id: 2, name: "Chase Freedom", type: "credit_card" };

function renderPage(accounts: object[]) {
  server.use(http.get("/api/accounts", () => HttpResponse.json(accounts)));
  const router = createMemoryRouter([{ path: "/accounts", element: <AccountsPage /> }], {
    initialEntries: ["/accounts"],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("AccountsPage", () => {
  it("lists accounts with their type, each linking to its screen", async () => {
    renderPage([chase, wells]);

    const list = await screen.findByRole("list", { name: "Accounts" });
    const links = within(list).getAllByRole("link");
    // Icons are aria-hidden but their emoji still count toward textContent.
    expect(links.map((link) => link.textContent)).toEqual(["💳Chase FreedomCredit card", "🏦Wells FargoChecking"]);
    expect(links[0]).toHaveAttribute("href", "/accounts/2");
  });

  it("says when there are no accounts", async () => {
    renderPage([]);

    expect(await screen.findByText("No accounts yet.")).toBeInTheDocument();
  });

  it("links to the new account screen from the + button", async () => {
    renderPage([]);

    expect(await screen.findByRole("link", { name: "Add account" })).toHaveAttribute("href", "/accounts/new");
  });
});
