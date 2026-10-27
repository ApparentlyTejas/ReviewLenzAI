import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from "./client";
import { listChatMessages, sendChatMessage } from "./chat";

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;
const mockedPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.clearAllMocks();
});

describe("chat api", () => {
  it("lists chat messages for a review", async () => {
    const messages = [{ id: 1, role: "user", content: "hi", created_at: "2026-01-01T00:00:00Z" }];
    mockedGet.mockResolvedValueOnce({ data: messages });

    await expect(listChatMessages(1, 2)).resolves.toEqual(messages);
    expect(mockedGet).toHaveBeenCalledWith("/projects/1/reviews/2/chat");
  });

  it("sends a chat message and returns the assistant reply", async () => {
    const reply = { id: 2, role: "assistant", content: "Looks fine.", created_at: "2026-01-01T00:00:01Z" };
    mockedPost.mockResolvedValueOnce({ data: reply });

    await expect(sendChatMessage(1, 2, "Is this safe?")).resolves.toEqual(reply);
    expect(mockedPost).toHaveBeenCalledWith("/projects/1/reviews/2/chat", { content: "Is this safe?" });
  });

  it("propagates errors from the backend", async () => {
    const error = { response: { status: 502 } };
    mockedPost.mockRejectedValueOnce(error);
    await expect(sendChatMessage(1, 2, "hi")).rejects.toBe(error);
  });
});
