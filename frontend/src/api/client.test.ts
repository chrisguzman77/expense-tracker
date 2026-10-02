import { describe, expect, it, vi } from "vitest";
import { api, ApiError, unwrap } from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api client", () => {
  it("requests same-origin /api paths with cookies", async () => {
    const fetchMock = vi.fn<(input: Request) => Promise<Response>>(async () =>
      jsonResponse(200, { id: 1, email: "a@b.c" }),
    );
    const { data } = await api.GET("/api/auth/me", { fetch: fetchMock });

    expect(data).toEqual({ id: 1, email: "a@b.c" });
    const request = fetchMock.mock.calls[0][0];
    expect(new URL(request.url).pathname).toBe("/api/auth/me");
    expect(request.credentials).toBe("same-origin");
  });
});

describe("unwrap", () => {
  it("returns data on success", async () => {
    const result = await unwrap(
      Promise.resolve({ data: { id: 1 }, error: undefined, response: jsonResponse(200, {}) }),
    );
    expect(result).toEqual({ id: 1 });
  });

  it("throws ApiError with status and detail on failure", async () => {
    const promise = unwrap(
      Promise.resolve({
        data: undefined,
        error: { detail: "Not authenticated" },
        response: jsonResponse(401, {}),
      }),
    );

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ status: 401, message: "Not authenticated" });
  });
});
