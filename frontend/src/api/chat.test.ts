import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiClient: { get: vi.fn() },
  API_BASE_URL: "http://localhost:8000",
}));

import { apiClient } from "./client";
import { ChatStreamError, listChatMessages, streamChatMessage } from "./chat";

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

function sseResponse(frames: string[], init: { ok?: boolean; status?: number } = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(frame));
      }
      controller.close();
    },
  });
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    body,
    json: async () => ({ detail: "boom" }),
  } as unknown as Response;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("chat api", () => {
  it("lists chat messages for a review", async () => {
    const messages = [{ id: 1, role: "user", content: "hi", created_at: "2026-01-01T00:00:00Z" }];
    mockedGet.mockResolvedValueOnce({ data: messages });

    await expect(listChatMessages(1, 2)).resolves.toEqual(messages);
    expect(mockedGet).toHaveBeenCalledWith("/projects/1/reviews/2/chat");
  });

  it("streams deltas and resolves with the final persisted message", async () => {
    const deltas: string[] = [];
    const finalMessage = { id: 2, role: "assistant", content: "Hello world", created_at: "2026-01-01T00:00:01Z" };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        sseResponse([
          'data: {"type":"delta","content":"Hello "}\n\n',
          'data: {"type":"delta","content":"world"}\n\n',
          `data: ${JSON.stringify({ type: "done", message: finalMessage })}\n\n`,
        ]),
      ),
    );

    const result = await streamChatMessage(1, 2, "Hi?", (chunk) => deltas.push(chunk));

    expect(deltas).toEqual(["Hello ", "world"]);
    expect(result).toEqual(finalMessage);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/projects/1/reviews/2/chat",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("handles an SSE frame split across two stream chunks", async () => {
    const deltas: string[] = [];
    const finalMessage = { id: 3, role: "assistant", content: "ok", created_at: "2026-01-01T00:00:01Z" };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        sseResponse([
          'data: {"type":"delta",',
          '"content":"ok"}\n\n',
          `data: ${JSON.stringify({ type: "done", message: finalMessage })}\n\n`,
        ]),
      ),
    );

    const result = await streamChatMessage(1, 2, "Hi?", (chunk) => deltas.push(chunk));

    expect(deltas).toEqual(["ok"]);
    expect(result).toEqual(finalMessage);
  });

  it("throws a ChatStreamError when the backend sends an error event mid-stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        sseResponse(['data: {"type":"delta","content":"partial "}\n\n', 'data: {"type":"error","detail":"Groq API call failed"}\n\n']),
      ),
    );

    await expect(streamChatMessage(1, 2, "Hi?", () => {})).rejects.toMatchObject({
      name: "ChatStreamError",
      message: "Groq API call failed",
    });
  });

  it("maps a 429 response to a friendly rate-limit message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(sseResponse([], { ok: false, status: 429 })));

    await expect(streamChatMessage(1, 2, "Hi?", () => {})).rejects.toMatchObject({
      status: 429,
      message: expect.stringContaining("hourly question limit"),
    });
  });

  it("surfaces the backend's detail message for other non-ok responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse([], { ok: false, status: 400 })));

    await expect(streamChatMessage(1, 2, "Hi?", () => {})).rejects.toBeInstanceOf(ChatStreamError);
    await expect(streamChatMessage(1, 2, "Hi?", () => {})).rejects.toMatchObject({ message: "boom", status: 400 });
  });
});
