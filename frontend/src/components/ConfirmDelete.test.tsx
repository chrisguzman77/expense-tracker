import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDelete } from "./ConfirmDelete";

function renderIt({ pending = false, error }: { pending?: boolean; error?: string } = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDelete
      label="Delete thing"
      question="Delete this thing? This can't be undone."
      onConfirm={onConfirm}
      onCancel={onCancel}
      pending={pending}
      error={error}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDelete", () => {
  it("shows only the button until it is pressed", () => {
    renderIt();

    expect(screen.getByRole("button", { name: "Delete thing" })).toBeInTheDocument();
    expect(screen.queryByText("Delete this thing? This can't be undone.")).not.toBeInTheDocument();
  });

  it("asks first, then Delete calls onConfirm", async () => {
    const { onConfirm } = renderIt();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete thing" }));
    expect(screen.getByText("Delete this thing? This can't be undone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Cancel hides the question and calls onCancel", async () => {
    const { onConfirm, onCancel } = renderIt();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete thing" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete thing" })).toBeInTheDocument();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows the error", () => {
    renderIt({ error: "Nope" });

    expect(screen.getByRole("alert")).toHaveTextContent("Nope");
  });

  it("disables Delete and Cancel while pending", async () => {
    renderIt({ pending: true });

    await userEvent.setup().click(screen.getByRole("button", { name: "Delete thing" }));

    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
