import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CountUp } from "./CountUp";

afterEach(() => {
  cleanup();
});

describe("CountUp", () => {
  it("settles on the target value", async () => {
    render(<CountUp value={42} />);
    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument(), { timeout: 2000 });
  });

  it("renders zero as-is", async () => {
    render(<CountUp value={0} />);
    await waitFor(() => expect(screen.getByText("0")).toBeInTheDocument());
  });
});
