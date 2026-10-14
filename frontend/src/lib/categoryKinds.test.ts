import { describe, expect, it } from "vitest";
import { CATEGORY_KINDS, kindLabel } from "./categoryKinds";

describe("category kinds", () => {
  it("lists the kinds the API accepts, spending first", () => {
    expect(CATEGORY_KINDS).toEqual(["spending", "income", "transfer"]);
    expect(CATEGORY_KINDS.map(kindLabel)).toEqual(["Spending", "Income", "Transfer"]);
  });
});
