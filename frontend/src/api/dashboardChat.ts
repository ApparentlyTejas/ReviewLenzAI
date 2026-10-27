import { apiClient } from "./client";
import { streamSSEChat } from "./chat";
import type { ChatMessage } from "../types";

export async function listDashboardChatMessages(): Promise<ChatMessage[]> {
  const { data } = await apiClient.get<ChatMessage[]>("/dashboard/chat");
  return data;
}

export async function clearDashboardChatMessages(): Promise<void> {
  await apiClient.delete("/dashboard/chat");
}

export async function streamDashboardChatMessage(
  content: string,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<ChatMessage> {
  return streamSSEChat("/dashboard/chat", content, onDelta, signal);
}
