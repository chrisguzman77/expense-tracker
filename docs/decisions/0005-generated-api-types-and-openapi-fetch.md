# 5. Generated API types and openapi-fetch

- **Date:** 2026-10-01 (PR #4); drift check 2026-10-07 (PR #14)
- **Status:** Accepted

## Context

The frontend calls a FastAPI backend that already publishes an OpenAPI schema. Hand-written
TypeScript types for requests and responses would drift from the real API.

## Decision

- `npm run gen:api` runs openapi-typescript against the backend's schema and writes
  `frontend/src/api/schema.d.ts`, which is committed and never edited by hand.
- All requests go through `openapi-fetch`, which types paths, parameters and bodies from that
  file. A small `unwrap` helper turns error responses into a thrown `ApiError`, which is what
  TanStack Query expects.
- CI regenerates the types from `app.openapi()` (no server or database needed) and fails if
  the committed file differs.
- TypeScript is pinned to `~5.9` because openapi-typescript requires TypeScript 5.

## Alternatives considered

- **Hand-written types.** No tooling, but silently wrong after any API change.
- **A hand-rolled fetch wrapper typed from the generated file.** More to learn from, but
  reimplements what openapi-fetch already does.

## Consequences

- An API change that isn't followed by `gen:api` fails CI instead of failing in the browser.
- The fetch function is resolved at call time so test interceptors (MSW) see every request.
