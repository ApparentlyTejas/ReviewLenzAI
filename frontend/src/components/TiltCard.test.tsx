import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TiltCard } from "./TiltCard";

afterEach(() => {
  cleanup();
});

describe("TiltCard", () => {
  it("renders its children", () => {
    render(<TiltCard>Hello</TiltCard>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("forwards onClick", () => {
    const onClick = vi.fn();
    render(<TiltCard onClick={onClick}>Click me</TiltCard>);
    fireEvent.click(screen.getByText("Click me"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("forwards accessibility attributes like role/tabIndex", () => {
    render(
      <TiltCard role="button" tabIndex={0}>
        Accessible card
      </TiltCard>,
    );
    const el = screen.getByText("Accessible card").closest('[role="button"]');
    expect(el).toHaveAttribute("tabindex", "0");
  });

  it("does not throw on mouse move/enter/leave", () => {
    render(<TiltCard>Hover me</TiltCard>);
    const el = screen.getByText("Hover me").parentElement!;
    expect(() => {
      fireEvent.mouseEnter(el);
      fireEvent.mouseMove(el, { clientX: 10, clientY: 10 });
      fireEvent.mouseLeave(el);
    }).not.toThrow();
  });

  it("renders as a li when as=\"li\" is passed", () => {
    render(
      <ul>
        <TiltCard as="li">List item</TiltCard>
      </ul>,
    );
    expect(screen.getByText("List item").closest("li")).toBeInTheDocument();
  });
});
