import createClient from "openapi-fetch";
import type { paths } from "./schema";

// Same-origin on purpose: the JWT lives in an httpOnly cookie, so the browser
// attaches it automatically. Vite proxies /api in dev; nginx does in prod.
export const api = createClient<paths>({
  baseUrl: window.location.origin,
  credentials: "same-origin",
  // Resolve fetch at call time rather than at import time so request
  // interceptors (MSW in tests) installed later still see our requests.
  fetch: (input) => globalThis.fetch(input),
});

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type FetchResult<T> = {
  data?: T;
  error?: unknown;
  response: Response;
};

// openapi-fetch never throws on non-2xx. TanStack Query needs a thrown error,
// so this converts { data, error, response } into data-or-throw.
export async function unwrap<T>(promise: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await promise;
  if (error !== undefined || data === undefined) {
    throw new ApiError(response.status, errorMessage(error, response));
  }
  return data;
}

function errorMessage(error: unknown, response: Response): string {
  if (typeof error === "object" && error !== null && "detail" in error) {
    const detail = (error as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return response.statusText || `Request failed with status ${response.status}`;
}

// For endpoints that return 204 No Content: nothing to return, still throw on error.
export async function unwrapVoid(promise: Promise<FetchResult<unknown>>): Promise<void> {
  const { error, response } = await promise;
  if (error !== undefined) {
    throw new ApiError(response.status, errorMessage(error, response));
  }
}
