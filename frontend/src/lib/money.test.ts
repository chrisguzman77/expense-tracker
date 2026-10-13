import { describe, expect, it } from "vitest";
import { formatAmount, formatCents, formatUsd, sharePercent, sumAmounts, toCents } from "./money";

describe("toCents", () => {
  it("converts decimal strings to integer cents, including negatives", () => {
    expect(toCents("0")).toBe(0);
    expect(toCents("12.5")).toBe(1250);
    expect(toCents("12.50")).toBe(1250);
    expect(toCents("-12.5")).toBe(-1250);
    expect(toCents("-0.05")).toBe(-5);
  });
});

describe("formatAmount", () => {
  it("normalizes decimal strings to two places", () => {
    expect(formatAmount("0")).toBe("0.00");
    expect(formatAmount("12.5")).toBe("12.50");
    expect(formatAmount("12.50")).toBe("12.50");
    expect(formatAmount("1234567890.99")).toBe("1234567890.99");
    expect(formatAmount("-0.5")).toBe("-0.50");
  });
});

describe("sumAmounts", () => {
  it("adds decimal strings exactly, without float error", () => {
    expect(sumAmounts(["0.10", "0.20"])).toBe("0.30");
    expect(sumAmounts(["12.50", "0", "900.00"])).toBe("912.50");
    expect(sumAmounts([])).toBe("0.00");
    expect(sumAmounts(["-12.50", "2.00"])).toBe("-10.50");
  });
});

describe("formatUsd / formatCents", () => {
  it("adds a dollar sign and thousands separators", () => {
    expect(formatUsd("1284.5")).toBe("$1,284.50");
    expect(formatUsd("0")).toBe("$0.00");
    expect(formatUsd("999.99")).toBe("$999.99");
    expect(formatUsd("1234567890.99")).toBe("$1,234,567,890.99");
    expect(formatCents(123456)).toBe("$1,234.56");
  });

  it("puts the minus sign before the dollar sign", () => {
    expect(formatUsd("-12.5")).toBe("-$12.50");
    expect(formatUsd("-0.05")).toBe("-$0.05");
  });
});

describe("sharePercent", () => {
  it("rounds to a whole percent and handles a zero total", () => {
    expect(sharePercent(1, 3)).toBe(33);
    expect(sharePercent(2, 3)).toBe(67);
    expect(sharePercent(90000, 91250)).toBe(99);
    expect(sharePercent(0, 0)).toBe(0);
  });
});
