import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "./ChatPanel";
import { ToastProvider } from "./Toast";

vi.mock("../api/chat", async () => {
  const actual = await vi.importActual<typeof import("../api/chat")>("../api/chat");
  return { ...actual, listChatMessages: vi.fn(), streamChatMessage: vi.fn() };
});

import { listChatMessages, streamChatMessage } from "../api/chat";

const mockedList = listChatMessages as unknown as ReturnType<typeof vi.fn>;
const mockedStream = streamChatMessage as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderChatPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ChatPanel projectId={1} reviewId={2} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("ChatPanel", () => {
  it("fetches history scoped to the given project/review", async () => {
    mockedList.mockResolvedValueOnce([]);
    renderChatPanel();

    await screen.findByText(/ask a follow-up question about this pr/i);
    expect(mockedList).toHaveBeenCalledWith(1, 2);
  });

  it("sends new messages scoped to the given project/review", async () => {
    mockedList.mockResolvedValueOnce([]);
    mockedStream.mockImplementationOnce(async (_p, _r, _content, onDelta) => {
      onDelta("ok");
      return { id: 1, role: "assistant", content: "ok", created_at: "2026-01-01T00:00:00Z" };
    });
    renderChatPanel();

    const input = await screen.findByPlaceholderText(/ask a question about this review/i);
    fireEvent.change(input, { target: { value: "hi" } });
    fireEvent.submit(input.closest("form")!);

    await screen.findByText("ok");
    expect(mockedStream).toHaveBeenCalledWith(1, 2, "hi", expect.any(Function), expect.anything());
  });
});
