# 4. Money is a decimal string end to end

- **Date:** 2026-09-10 (PR #3); frontend arithmetic 2026-10-06 (PR #10)
- **Status:** Accepted

## Context

Binary floating point cannot represent most cents exactly (`0.1 + 0.2 != 0.3`). Money that
passes through floats eventually shows wrong totals.

## Decision

- Postgres stores amounts as `NUMERIC(12,2)`; Python handles them as `Decimal`.
- The API serializes amounts as JSON **strings** (`"12.50"`), never numbers.
- The frontend keeps amounts as strings. Form input is validated by shape (up to 10 digits,
  up to 2 decimals, greater than zero). Totals are computed on integer cents in
  `frontend/src/lib/money.ts`, never with floats.

## Alternatives considered

- **JSON numbers.** Convenient, but JavaScript parses them as floats.
- **Integer cents in the API.** Exact, but every client must remember to divide by 100 and the
  API becomes harder to read.

## Consequences

- No rounding errors anywhere in the stack.
- The generated type for request bodies is `number | string`; the frontend always sends strings.
