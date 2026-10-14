import { describe, expect, it } from "vitest";
import { ACCOUNT_TYPES, accountTypeIcon, accountTypeLabel } from "./accountTypes";

describe("account types", () => {
  it("has a label and an icon for each type the API accepts", () => {
    // The Record type in accountTypes.ts also makes tsc fail if the generated
    // API union and this list drift apart.
    expect(ACCOUNT_TYPES).toEqual(["checking", "savings", "credit_card", "cash"]);
    expect(ACCOUNT_TYPES.map(accountTypeLabel)).toEqual(["Checking", "Savings", "Credit card", "Cash"]);
    expect(ACCOUNT_TYPES.map(accountTypeIcon)).toEqual(["🏦", "🐷", "💳", "💵"]);
  });
});
