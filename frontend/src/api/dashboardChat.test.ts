import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiClient: { get: vi.fn() },
  API_BASE_URL: "http://localhost:8000",
}));

import { apiClient } from "./client";
import { listDashboardChatMessages, streamDashboardChatMessage } from "./dashboardChat";

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

function sseResponse(frames: string[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return { ok: true, status: 200, body } as unknown as Response;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("dashboard chat api", () => {
  it("lists dashboard chat history", async () => {
    const messages = [{ id: 1, role: "user", content: "hi", created_at: "2026-01-01T00:00:00Z" }];
    mockedGet.mockResolvedValueOnce({ data: messages });

    await expect(listDashboardChatMessages()).resolves.toEqual(messages);
    expect(mockedGet).toHaveBeenCalledWith("/dashboard/chat");
  });

  it("streams a dashboard chat reply from the dashboard/chat endpoint", async () => {
    const deltas: string[] = [];
    const finalMessage = { id: 2, role: "assistant", content: "You have 3 repos.", created_at: "2026-01-01T00:00:01Z" };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        sseResponse([
          'data: {"type":"delta","content":"You have "}\n\n',
          'data: {"type":"delta","content":"3 repos."}\n\n',
          `data: ${JSON.stringify({ type: "done", message: finalMessage })}\n\n`,
        ]),
      ),
    );

    const result = await streamDashboardChatMessage("How many repos?", (chunk) => deltas.push(chunk));

    expect(deltas).toEqual(["You have ", "3 repos."]);
    expect(result).toEqual(finalMessage);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/dashboard/chat",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
});
