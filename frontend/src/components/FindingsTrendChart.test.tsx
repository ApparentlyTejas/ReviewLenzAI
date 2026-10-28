import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FindingsTrendChart } from "./FindingsTrendChart";
import type { FindingsTrendPoint } from "../types";

afterEach(() => {
  cleanup();
});

function points(overrides: Partial<FindingsTrendPoint>[]): FindingsTrendPoint[] {
  return overrides.map((o, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    review_count: 0,
    finding_count: 0,
    ...o,
  }));
}

describe("FindingsTrendChart", () => {
  it("renders nothing when there are no reviews in range", () => {
    const { container } = render(<FindingsTrendChart points={points([{}, {}, {}])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the total finding count across the range", () => {
    render(<FindingsTrendChart points={points([{ review_count: 1, finding_count: 2 }, { review_count: 1, finding_count: 3 }])} />);
    expect(screen.getByText("5 total")).toBeInTheDocument();
  });
});
