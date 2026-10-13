import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryChip } from "./CategoryChip";

describe("CategoryChip", () => {
  it("shows the emoji, is decorative, and records its color", () => {
    const { container } = render(<CategoryChip category={{ name: "Food", icon: "🍔", color: "amber" }} />);
    const chip = container.firstElementChild!;
    expect(chip).toHaveTextContent("🍔");
    expect(chip).toHaveAttribute("aria-hidden", "true");
    expect(chip).toHaveAttribute("data-color", "amber");
  });
});
