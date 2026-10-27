import { apiClient } from "./client";
import type { ChatMessage } from "../types";

export async function listChatMessages(projectId: number, reviewId: number): Promise<ChatMessage[]> {
  const { data } = await apiClient.get<ChatMessage[]>(`/projects/${projectId}/reviews/${reviewId}/chat`);
  return data;
}

export async function sendChatMessage(
  projectId: number,
  reviewId: number,
  content: string,
): Promise<ChatMessage> {
  const { data } = await apiClient.post<ChatMessage>(`/projects/${projectId}/reviews/${reviewId}/chat`, {
    content,
  });
  return data;
}
