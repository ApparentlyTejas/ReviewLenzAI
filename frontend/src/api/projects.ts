import { apiClient } from "./client";
import type { Project, PullRequest, Review, ReviewSummary } from "../types";

export async function listProjects(): Promise<Project[]> {
  const { data } = await apiClient.get<Project[]>("/projects");
  return data;
}

export async function createProject(repoOwner: string, repoName: string, githubPat: string): Promise<Project> {
  const { data } = await apiClient.post<Project>("/projects", {
    repo_owner: repoOwner,
    repo_name: repoName,
    github_pat: githubPat,
  });
  return data;
}

export async function deleteProject(projectId: number): Promise<void> {
  await apiClient.delete(`/projects/${projectId}`);
}

export async function listPullRequests(projectId: number): Promise<PullRequest[]> {
  const { data } = await apiClient.get<PullRequest[]>(`/projects/${projectId}/pulls`);
  return data;
}

export async function triggerReview(projectId: number, prNumber: number): Promise<Review> {
  const { data } = await apiClient.post<Review>(`/projects/${projectId}/reviews`, { pr_number: prNumber });
  return data;
}

export async function listReviews(projectId: number): Promise<ReviewSummary[]> {
  const { data } = await apiClient.get<ReviewSummary[]>(`/projects/${projectId}/reviews`);
  return data;
}

export async function getReview(projectId: number, reviewId: number): Promise<Review> {
  const { data } = await apiClient.get<Review>(`/projects/${projectId}/reviews/${reviewId}`);
  return data;
}

export async function deleteReview(projectId: number, reviewId: number): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/reviews/${reviewId}`);
}
