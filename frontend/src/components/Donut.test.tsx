import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Donut } from "./Donut";

function segmentsIn(container: HTMLElement) {
  return Array.from(container.querySelectorAll("circle[data-segment]"));
}

describe("Donut", () => {
  it("is hidden from assistive technology", () => {
    const { container } = render(<Donut segments={[{ key: 1, color: "red", cents: 100 }]} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("draws one arc per positive segment, sized by share of the total", () => {
    const { container } = render(
      <Donut
        size={120}
        thickness={20}
        segments={[
          { key: 1, color: "red", cents: 300 },
          { key: 2, color: "blue", cents: 100 },
          { key: 3, color: "green", cents: 0 },
        ]}
      />,
    );
    const circumference = 2 * Math.PI * 50;
    const [first, second] = segmentsIn(container);
    expect(segmentsIn(container)).toHaveLength(2);
    expect(Number(first.getAttribute("stroke-dasharray")!.split(" ")[0])).toBeCloseTo(circumference * 0.75);
    expect(Number(second.getAttribute("stroke-dasharray")!.split(" ")[0])).toBeCloseTo(circumference * 0.25);
    expect(Number(second.getAttribute("stroke-dashoffset"))).toBeCloseTo(-circumference * 0.75);
  });

  it("draws only the track when there is nothing to show", () => {
    const { container } = render(<Donut segments={[]} />);
    expect(segmentsIn(container)).toHaveLength(0);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
  });
});
