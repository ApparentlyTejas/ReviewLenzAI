import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Review } from "../types";

vi.mock("../api/projects", async () => {
  const actual = await vi.importActual<typeof import("../api/projects")>("../api/projects");
  return { ...actual, getReview: vi.fn(), postReviewComment: vi.fn() };
});
vi.mock("../api/chat", async () => {
  const actual = await vi.importActual<typeof import("../api/chat")>("../api/chat");
  return { ...actual, listChatMessages: vi.fn().mockResolvedValue([]), streamChatMessage: vi.fn() };
});

import { getReview } from "../api/projects";
import { ToastProvider } from "../components/Toast";
import { ReviewDetail } from "./ReviewDetail";

const mockedGetReview = getReview as unknown as ReturnType<typeof vi.fn>;

function finding(id: number, severity: Review["findings"][number]["severity"]): Review["findings"][number] {
  return {
    id,
    category: "bug",
    severity,
    file_path: `src/file${id}.ts`,
    line_number: id,
    message: `Finding ${id}`,
    suggested_fix: null,
  };
}

function baseReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 2,
    project_id: 1,
    pr_number: 42,
    pr_title: "Add feature",
    pr_url: "https://github.com/octocat/hello/pull/42",
    status: "completed",
    error_message: null,
    model_used: "qwen/qwen3.8-27b",
    created_at: "2026-01-01T00:00:00Z",
    diff_snapshot: "",
    delta: null,
    findings: [finding(1, "critical"), finding(2, "high"), finding(3, "high"), finding(4, "low")],
    ...overrides,
  };
}

function renderReviewDetail() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/projects/1/reviews/2"]}>
          <Routes>
            <Route path="/projects/:projectId/reviews/:reviewId" element={<ReviewDetail />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ReviewDetail severity filter", () => {
  it("shows a count chip per severity level present in the review", async () => {
    mockedGetReview.mockResolvedValueOnce(baseReview());
    renderReviewDetail();

    expect(await screen.findByRole("button", { name: "All (4)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "critical (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "high (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "low (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^medium/ })).not.toBeInTheDocument();
  });

  it("filters the findings list down to the selected severity", async () => {
    mockedGetReview.mockResolvedValueOnce(baseReview());
    renderReviewDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Findings" }));
    expect(await screen.findByText("Finding 1")).toBeInTheDocument();
    expect(screen.getByText("Finding 2")).toBeInTheDocument();
    expect(screen.getByText("Finding 4")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "high (2)" }));

    await waitFor(() => {
      expect(screen.queryByText("Finding 1")).not.toBeInTheDocument();
      expect(screen.queryByText("Finding 4")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Finding 2")).toBeInTheDocument();
    expect(screen.getByText("Finding 3")).toBeInTheDocument();
  });

  it("returns to the full list when All is selected again", async () => {
    mockedGetReview.mockResolvedValueOnce(baseReview());
    renderReviewDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Findings" }));
    fireEvent.click(await screen.findByRole("button", { name: "critical (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "All (4)" }));

    expect(screen.getByText("Finding 1")).toBeInTheDocument();
    expect(screen.getByText("Finding 2")).toBeInTheDocument();
    expect(screen.getByText("Finding 3")).toBeInTheDocument();
    expect(screen.getByText("Finding 4")).toBeInTheDocument();
  });
});

describe("ReviewDetail", () => {
  it("does not render the severity filter when there are no findings", async () => {
    mockedGetReview.mockResolvedValueOnce(baseReview({ findings: [] }));
    renderReviewDetail();

    await screen.findByText(/no issues found/i);
    expect(screen.queryByRole("group", { name: /filter findings by severity/i })).not.toBeInTheDocument();
  });
});
