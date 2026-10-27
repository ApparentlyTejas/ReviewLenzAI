import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";

afterEach(() => {
  cleanup();
});

describe("ConfirmDeleteButton", () => {
  it("does not call onConfirm until the confirm step is clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDeleteButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("calls onConfirm when the confirm step is clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDeleteButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("returns to the initial state when cancel is clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDeleteButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("supports custom labels", () => {
    render(<ConfirmDeleteButton onConfirm={vi.fn()} label="Disconnect" confirmLabel="Disconnect" />);
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
  });
});
