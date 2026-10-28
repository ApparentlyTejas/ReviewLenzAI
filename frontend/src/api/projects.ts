import { apiClient } from "./client";
import type { DeletedProject, FindingSeverity, Project, ProjectSettings, PullRequest, Review, ReviewSummary } from "../types";

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

export async function postReviewComment(projectId: number, reviewId: number): Promise<{ comment_url: string }> {
  const { data } = await apiClient.post<{ comment_url: string }>(
    `/projects/${projectId}/reviews/${reviewId}/post-comment`
  );
  return data;
}

export async function listDeletedProjects(): Promise<DeletedProject[]> {
  const { data } = await apiClient.get<DeletedProject[]>("/projects/deleted");
  return data;
}

export async function restoreProject(projectId: number): Promise<Project> {
  const { data } = await apiClient.post<Project>(`/projects/${projectId}/restore`);
  return data;
}

export interface WebhookStatus {
  enabled: boolean;
  webhook_url: string;
}

export interface WebhookCreated extends WebhookStatus {
  secret: string;
}

export async function getWebhookStatus(projectId: number): Promise<WebhookStatus> {
  const { data } = await apiClient.get<WebhookStatus>(`/projects/${projectId}/webhook`);
  return data;
}

export async function enableWebhook(projectId: number): Promise<WebhookCreated> {
  const { data } = await apiClient.post<WebhookCreated>(`/projects/${projectId}/webhook`);
  return data;
}

export async function disableWebhook(projectId: number): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/webhook`);
}

export async function getProjectSettings(projectId: number): Promise<ProjectSettings> {
  const { data } = await apiClient.get<ProjectSettings>(`/projects/${projectId}/settings`);
  return data;
}

export async function updateProjectSettings(
  projectId: number,
  ignorePatterns: string,
  minSeverity: FindingSeverity
): Promise<ProjectSettings> {
  const { data } = await apiClient.post<ProjectSettings>(`/projects/${projectId}/settings`, {
    ignore_patterns: ignorePatterns,
    min_severity: minSeverity,
  });
  return data;
}
