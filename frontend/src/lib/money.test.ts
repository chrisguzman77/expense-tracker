import { describe, expect, it } from "vitest";
import { formatAmount, sumAmounts } from "./money";

describe("formatAmount", () => {
  it("normalizes decimal strings to two places", () => {
    expect(formatAmount("0")).toBe("0.00");
    expect(formatAmount("12.5")).toBe("12.50");
    expect(formatAmount("12.50")).toBe("12.50");
    expect(formatAmount("1234567890.99")).toBe("1234567890.99");
  });
});

describe("sumAmounts", () => {
  it("adds decimal strings exactly, without float error", () => {
    expect(sumAmounts(["0.10", "0.20"])).toBe("0.30");
    expect(sumAmounts(["12.50", "0", "900.00"])).toBe("912.50");
    expect(sumAmounts([])).toBe("0.00");
  });
});
