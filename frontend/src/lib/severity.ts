import type { Finding, FindingSeverity } from "../types";

/**
 * Severity rank used to sort findings from most to least urgent.
 * Lower number = higher priority (shown first).
 */
export const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Returns a new array of findings sorted by severity, most severe first.
 * Findings with the same severity keep their original relative order
 * (stable sort), matching how the backend returns them.
 */
export function sortFindingsBySeverity<T extends Pick<Finding, "severity">>(findings: T[]): T[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/**
 * Counts findings per severity level. Every level is present in the result
 * (defaulting to 0) so callers don't need their own fallback logic.
 */
export function countBySeverity<T extends Pick<Finding, "severity">>(
  findings: T[]
): Record<FindingSeverity, number> {
  const counts: Record<FindingSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) {
    counts[finding.severity] += 1;
  }
  return counts;
}
