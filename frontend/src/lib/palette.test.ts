import { describe, expect, it } from "vitest";
import css from "../index.css?raw";
import { CATEGORY_COLORS, colorLabel, colorVar } from "./palette";

describe("palette", () => {
  it("has exactly the ten colors the API accepts", () => {
    // The Record type in palette.ts also makes tsc fail if the generated API
    // union and this list drift apart.
    expect(CATEGORY_COLORS).toEqual([
      "amber", "emerald", "sky", "violet", "rose", "orange", "teal", "indigo", "lime", "slate",
    ]);
  });

  it("defines a light and a dark CSS variable for every color", () => {
    expect(css).toContain("--app-bg"); // guard: an empty read would pass the loop below
    for (const color of CATEGORY_COLORS) {
      expect(css.match(new RegExp(`--cat-${color}:`, "g")), color).toHaveLength(2);
    }
  });

  it("maps names to CSS variables, falling back to slate", () => {
    expect(colorVar("teal")).toBe("var(--cat-teal)");
    expect(colorVar("chartreuse")).toBe("var(--cat-slate)");
    expect(colorLabel("emerald")).toBe("Emerald");
  });
});
