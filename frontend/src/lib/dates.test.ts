import { describe, expect, it } from "vitest";
import { addDays, currentMonthValue, dayLabel, formatLocal, longDate, monthLabel, monthName, shiftMonth } from "./dates";

describe("local date helpers", () => {
  it("formats a Date as a local YYYY-MM-DD string", () => {
    expect(formatLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("labels days relative to today", () => {
    expect(dayLabel("2026-10-12", "2026-10-12")).toBe("Today");
    expect(dayLabel("2026-10-10", "2026-10-12")).toBe("Oct 10");
    expect(dayLabel("2025-03-05", "2026-10-12")).toBe("Mar 5, 2025");
  });

  it("writes a long date for the detail screen", () => {
    expect(longDate("2026-10-10")).toBe("Saturday, October 10, 2026");
  });
});

describe("month helpers", () => {
  it("returns the current month as YYYY-MM", () => {
    expect(currentMonthValue()).toMatch(/^\d{4}-\d{2}$/);
  });

  it("shifts months across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-10", 0)).toBe("2026-10");
  });

  it("labels months", () => {
    expect(monthLabel("2026-10")).toBe("October 2026");
    expect(monthName("2026-10")).toBe("October");
  });
});
