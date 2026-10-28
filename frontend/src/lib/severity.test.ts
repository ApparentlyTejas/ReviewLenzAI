import { describe, expect, it } from "vitest";
import type { Finding } from "../types";
import { SEVERITY_ORDER, countBySeverity, sortFindingsBySeverity } from "./severity";

function finding(id: number, severity: Finding["severity"]): Pick<Finding, "id" | "severity"> {
  return { id, severity };
}

describe("sortFindingsBySeverity", () => {
  it("orders findings from critical to low", () => {
    const input = [finding(1, "low"), finding(2, "critical"), finding(3, "medium"), finding(4, "high")];

    const result = sortFindingsBySeverity(input);

    expect(result.map((f) => f.severity)).toEqual(["critical", "high", "medium", "low"]);
  });

  it("keeps the relative order of findings with equal severity (stable sort)", () => {
    const input = [finding(1, "high"), finding(2, "high"), finding(3, "critical")];

    const result = sortFindingsBySeverity(input);

    expect(result.map((f) => f.id)).toEqual([3, 1, 2]);
  });

  it("does not mutate the input array", () => {
    const input = [finding(1, "low"), finding(2, "critical")];
    const inputCopy = [...input];

    sortFindingsBySeverity(input);

    expect(input).toEqual(inputCopy);
  });

  it("returns an empty array for no findings", () => {
    expect(sortFindingsBySeverity([])).toEqual([]);
  });

  it("every known severity has a distinct rank", () => {
    const ranks = Object.values(SEVERITY_ORDER);
    expect(new Set(ranks).size).toBe(ranks.length);
  });
});

describe("countBySeverity", () => {
  it("counts findings per severity level", () => {
    const input = [finding(1, "high"), finding(2, "critical"), finding(3, "high"), finding(4, "low")];

    expect(countBySeverity(input)).toEqual({ critical: 1, high: 2, medium: 0, low: 1 });
  });

  it("returns every severity level at 0 for an empty list", () => {
    expect(countBySeverity([])).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
  });
});
