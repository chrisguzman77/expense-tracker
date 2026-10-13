import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup(); // RTL only auto-cleans with vitest globals enabled
  server.resetHandlers();
  // Theme and the breakdown card persist to localStorage; keep tests independent.
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterAll(() => server.close());
