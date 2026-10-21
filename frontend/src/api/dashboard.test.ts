import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from "./client";
import { getDashboardSummary } from "./dashboard";

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.clearAllMocks();
});

describe("dashboard api", () => {
  it("returns the dashboard summary", async () => {
    const summary = {
      total_projects: 2,
      total_reviews: 5,
      total_findings: 10,
      findings_by_severity: { critical: 1 },
      recent_reviews: [],
    };
    mockedGet.mockResolvedValueOnce({ data: summary });

    await expect(getDashboardSummary()).resolves.toEqual(summary);
    expect(mockedGet).toHaveBeenCalledWith("/dashboard/summary");
  });

  it("propagates errors from the backend", async () => {
    const error = { response: { status: 500 } };
    mockedGet.mockRejectedValueOnce(error);
    await expect(getDashboardSummary()).rejects.toBe(error);
  });
});
