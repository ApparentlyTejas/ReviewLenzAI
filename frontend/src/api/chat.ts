import { API_BASE_URL, apiClient } from "./client";
import type { ChatMessage } from "../types";

export async function listChatMessages(projectId: number, reviewId: number): Promise<ChatMessage[]> {
  const { data } = await apiClient.get<ChatMessage[]>(`/projects/${projectId}/reviews/${reviewId}/chat`);
  return data;
}

export async function clearChatMessages(projectId: number, reviewId: number): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/reviews/${reviewId}/chat`);
}

export class ChatStreamError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ChatStreamError";
    this.status = status;
  }
}

type ChatSSEEvent =
  | { type: "delta"; content: string }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; detail: string };

/** POSTs a chat question to `path` and streams the assistant's reply token-by-token
 * via SSE, calling onDelta as each chunk arrives. Resolves with the final persisted
 * message. Shared by both the per-review chat and the dashboard chat clients. */
export async function streamSSEChat(
  path: string,
  content: string,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<ChatMessage> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    if (response.status === 429) {
      detail = "You've hit the hourly question limit. Try again later.";
    } else {
      try {
        const body = await response.json();
        if (body?.detail) detail = body.detail;
      } catch {
        // response body wasn't JSON — keep the generic message above
      }
    }
    throw new ChatStreamError(detail, response.status);
  }

  if (!response.body) {
    throw new ChatStreamError("Streaming is not supported in this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith("data: ")) continue;
      const event = JSON.parse(line.slice("data: ".length)) as ChatSSEEvent;

      if (event.type === "delta") {
        onDelta(event.content);
      } else if (event.type === "error") {
        throw new ChatStreamError(event.detail, 502);
      } else if (event.type === "done") {
        return event.message;
      }
    }
  }

  throw new ChatStreamError("Connection closed before the response finished.");
}

export async function streamChatMessage(
  projectId: number,
  reviewId: number,
  content: string,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<ChatMessage> {
  return streamSSEChat(`/projects/${projectId}/reviews/${reviewId}/chat`, content, onDelta, signal);
}
