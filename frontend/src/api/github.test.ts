import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from "./client";
import { connectGitHub, createProjectFromGitHub, listGitHubRepoPulls, listGitHubRepos } from "./github";

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;
const mockedPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.clearAllMocks();
});

describe("github api", () => {
  it("listGitHubRepos returns the repo list", async () => {
    const repos = [{ full_name: "a/b", owner: "a", name: "b", private: false }];
    mockedGet.mockResolvedValueOnce({ data: repos });

    await expect(listGitHubRepos()).resolves.toEqual(repos);
    expect(mockedGet).toHaveBeenCalledWith("/github/repos");
  });

  it("listGitHubRepos propagates errors", async () => {
    const error = { response: { status: 401 } };
    mockedGet.mockRejectedValueOnce(error);
    await expect(listGitHubRepos()).rejects.toBe(error);
  });

  it("listGitHubRepoPulls builds the owner/repo path", async () => {
    const pulls = [{ number: 1, title: "x", url: "u", author: "me", updated_at: "now" }];
    mockedGet.mockResolvedValueOnce({ data: pulls });

    await expect(listGitHubRepoPulls("octocat", "hello-world")).resolves.toEqual(pulls);
    expect(mockedGet).toHaveBeenCalledWith("/github/repos/octocat/hello-world/pulls");
  });

  it("createProjectFromGitHub posts owner and repo name", async () => {
    const project = { id: 1, repo_owner: "octocat", repo_name: "hello-world", created_at: "now" };
    mockedPost.mockResolvedValueOnce({ data: project });

    await expect(createProjectFromGitHub("octocat", "hello-world")).resolves.toEqual(project);
    expect(mockedPost).toHaveBeenCalledWith("/projects/from-github", {
      repo_owner: "octocat",
      repo_name: "hello-world",
    });
  });

  it("createProjectFromGitHub propagates errors", async () => {
    const error = { response: { status: 400, data: { detail: "bad token" } } };
    mockedPost.mockRejectedValueOnce(error);
    await expect(createProjectFromGitHub("octocat", "hello-world")).rejects.toBe(error);
  });

  it("connectGitHub posts the oauth code", async () => {
    mockedPost.mockResolvedValueOnce({ data: undefined });
    await connectGitHub("abc123");
    expect(mockedPost).toHaveBeenCalledWith("/auth/github/connect", { code: "abc123" });
  });
});
