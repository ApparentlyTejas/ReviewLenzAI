import { apiClient } from "./client";
import type { DashboardSummary, DeletedReview, FindingsTrend, RecentReview } from "../types";

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>("/dashboard/summary");
  return data;
}

export async function getFindingsTrend(): Promise<FindingsTrend> {
  const { data } = await apiClient.get<FindingsTrend>("/dashboard/findings-trend");
  return data;
}

export async function listDeletedReviews(): Promise<DeletedReview[]> {
  const { data } = await apiClient.get<DeletedReview[]>("/dashboard/deleted-reviews");
  return data;
}

export async function restoreReview(reviewId: number): Promise<RecentReview> {
  const { data } = await apiClient.post<RecentReview>(`/dashboard/deleted-reviews/${reviewId}/restore`);
  return data;
}
