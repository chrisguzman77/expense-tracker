import { MutationObserver, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { RequireAuth } from "../auth/RequireAuth";
import { server } from "../test/server";
import { loginMutationKey } from "./auth";
import { ApiError } from "./client";
import { useTransactions } from "./transactions";
import { createQueryClient } from "./queryClient";

function TransactionCount() {
  const transactions = useTransactions();
  return <p>{transactions.data ? `${transactions.data.length} transactions` : "loading"}</p>;
}

function renderProtected() {
  const router = createMemoryRouter(
    [
      { element: <RequireAuth />, children: [{ path: "/", element: <TransactionCount /> }] },
      { path: "/login", element: <p>login page</p> },
    ],
    { initialEntries: ["/"] },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const unauthorized = () => HttpResponse.json({ detail: "Invalid or expired" }, { status: 401 });
const pause = () => new Promise((resolve) => setTimeout(resolve, 100));

function failMutation(queryClient: ReturnType<typeof createQueryClient>, mutationKey?: readonly string[]) {
  const observer = new MutationObserver(queryClient, {
    mutationKey,
    mutationFn: () => Promise.reject(new ApiError(401, "Invalid credentials")),
  });
  return observer.mutate().catch(() => undefined);
}

describe("createQueryClient", () => {
  it("sends the user to the login screen when a data request returns 401", async () => {
    let meCalls = 0;
    server.use(
      http.get("/api/auth/me", () => {
        meCalls += 1;
        return meCalls === 1 ? HttpResponse.json({ id: 1, email: "chris@example.com" }) : unauthorized();
      }),
      http.get("/api/transactions", unauthorized),
    );

    renderProtected();

    // No retries on 401: with the default 3 retries this would take ~7s and time out.
    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(meCalls).toBe(2);
  });

  it("does not loop when /me itself returns 401", async () => {
    let meCalls = 0;
    server.use(
      http.get("/api/auth/me", () => {
        meCalls += 1;
        return unauthorized();
      }),
    );

    renderProtected();

    expect(await screen.findByText("login page")).toBeInTheDocument();
    await pause();
    expect(meCalls).toBe(1);
  });

  it("drops cached data when another mutation returns 401", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["categories"], []);

    await failMutation(queryClient);

    expect(queryClient.getQueryData(["categories"])).toBeUndefined();
  });

  it("keeps cached data when the login itself returns 401", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["categories"], []);

    await failMutation(queryClient, loginMutationKey);

    expect(queryClient.getQueryData(["categories"])).toEqual([]);
  });
});
