import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TransactionAmount } from "./TransactionAmount";

describe("TransactionAmount", () => {
  it("shows money out like a price, without a minus sign", () => {
    render(<TransactionAmount amount="-1284.5" />);
    expect(screen.getByText("$1,284.50")).not.toHaveClass("text-income");
  });

  it("shows money in with a plus sign in the income color", () => {
    render(<TransactionAmount amount="20" />);
    expect(screen.getByText("+$20.00")).toHaveClass("text-income");
  });
});
