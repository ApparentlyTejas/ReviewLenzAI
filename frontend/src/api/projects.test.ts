import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from "./client";
import {
  createProject,
  deleteProject,
  deleteReview,
  getReview,
  listProjects,
  listPullRequests,
  listReviews,
  triggerReview,
} from "./projects";

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;
const mockedPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;
const mockedDelete = apiClient.delete as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.clearAllMocks();
});

describe("projects api", () => {
  it("listProjects returns the project list", async () => {
    const projects = [{ id: 1, repo_owner: "a", repo_name: "b", created_at: "now" }];
    mockedGet.mockResolvedValueOnce({ data: projects });

    await expect(listProjects()).resolves.toEqual(projects);
    expect(mockedGet).toHaveBeenCalledWith("/projects");
  });

  it("listProjects propagates errors", async () => {
    const error = { response: { status: 500 } };
    mockedGet.mockRejectedValueOnce(error);
    await expect(listProjects()).rejects.toBe(error);
  });

  it("createProject posts the repo details and token", async () => {
    const project = { id: 1, repo_owner: "octocat", repo_name: "hello-world", created_at: "now" };
    mockedPost.mockResolvedValueOnce({ data: project });

    await expect(createProject("octocat", "hello-world", "ghp_abc")).resolves.toEqual(project);
    expect(mockedPost).toHaveBeenCalledWith("/projects", {
      repo_owner: "octocat",
      repo_name: "hello-world",
      github_pat: "ghp_abc",
    });
  });

  it("createProject propagates a validation error", async () => {
    const error = { response: { status: 422, data: { detail: "invalid token" } } };
    mockedPost.mockRejectedValueOnce(error);
    await expect(createProject("octocat", "hello-world", "bad")).rejects.toBe(error);
  });

  it("deleteProject calls DELETE on the project path", async () => {
    mockedDelete.mockResolvedValueOnce({ data: undefined });
    await deleteProject(42);
    expect(mockedDelete).toHaveBeenCalledWith("/projects/42");
  });

  it("deleteReview calls DELETE on the review path", async () => {
    mockedDelete.mockResolvedValueOnce({ data: undefined });
    await deleteReview(1, 7);
    expect(mockedDelete).toHaveBeenCalledWith("/projects/1/reviews/7");
  });

  it("listPullRequests returns the PR list for a project", async () => {
    const pulls = [{ number: 1, title: "x", url: "u", author: "me", updated_at: "now" }];
    mockedGet.mockResolvedValueOnce({ data: pulls });

    await expect(listPullRequests(7)).resolves.toEqual(pulls);
    expect(mockedGet).toHaveBeenCalledWith("/projects/7/pulls");
  });

  it("triggerReview posts the PR number and returns the created review", async () => {
    const review = { id: 9, project_id: 7, pr_number: 3, status: "pending" };
    mockedPost.mockResolvedValueOnce({ data: review });

    await expect(triggerReview(7, 3)).resolves.toEqual(review);
    expect(mockedPost).toHaveBeenCalledWith("/projects/7/reviews", { pr_number: 3 });
  });

  it("triggerReview propagates errors", async () => {
    const error = { response: { status: 409, data: { detail: "already running" } } };
    mockedPost.mockRejectedValueOnce(error);
    await expect(triggerReview(7, 3)).rejects.toBe(error);
  });

  it("listReviews returns the review summaries for a project", async () => {
    const reviews = [{ id: 1, pr_number: 3, pr_title: "t", status: "completed", created_at: "now", finding_count: 2 }];
    mockedGet.mockResolvedValueOnce({ data: reviews });

    await expect(listReviews(7)).resolves.toEqual(reviews);
    expect(mockedGet).toHaveBeenCalledWith("/projects/7/reviews");
  });

  it("getReview returns a single review", async () => {
    const review = { id: 9, project_id: 7, pr_number: 3, status: "completed" };
    mockedGet.mockResolvedValueOnce({ data: review });

    await expect(getReview(7, 9)).resolves.toEqual(review);
    expect(mockedGet).toHaveBeenCalledWith("/projects/7/reviews/9");
  });

  it("getReview propagates a not-found error", async () => {
    const error = { response: { status: 404 } };
    mockedGet.mockRejectedValueOnce(error);
    await expect(getReview(7, 999)).rejects.toBe(error);
  });
});
