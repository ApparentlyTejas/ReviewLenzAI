import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "./ChatPanel";
import { ToastProvider } from "./Toast";

vi.mock("../api/chat", () => ({
  listChatMessages: vi.fn(),
  sendChatMessage: vi.fn(),
}));

import { listChatMessages, sendChatMessage } from "../api/chat";

const mockedList = listChatMessages as unknown as ReturnType<typeof vi.fn>;
const mockedSend = sendChatMessage as unknown as ReturnType<typeof vi.fn>;

function renderChatPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ChatPanel projectId={1} reviewId={2} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ChatPanel", () => {
  it("shows a prompt hint when there's no history yet", async () => {
    mockedList.mockResolvedValueOnce([]);
    renderChatPanel();

    expect(await screen.findByText(/ask a follow-up question/i)).toBeInTheDocument();
  });

  it("renders existing chat history", async () => {
    mockedList.mockResolvedValueOnce([
      { id: 1, role: "user", content: "Is this safe?", created_at: "2026-01-01T00:00:00Z" },
      { id: 2, role: "assistant", content: "Yes, looks fine.", created_at: "2026-01-01T00:00:01Z" },
    ]);
    renderChatPanel();

    expect(await screen.findByText("Is this safe?")).toBeInTheDocument();
    expect(screen.getByText("Yes, looks fine.")).toBeInTheDocument();
  });

  it("sends a message and refreshes the history with the reply", async () => {
    mockedList.mockResolvedValueOnce([]);
    mockedList.mockResolvedValueOnce([
      { id: 1, role: "user", content: "What about line 12?", created_at: "2026-01-01T00:00:00Z" },
      { id: 2, role: "assistant", content: "It's a null-check issue.", created_at: "2026-01-01T00:00:01Z" },
    ]);
    mockedSend.mockResolvedValueOnce({
      id: 2,
      role: "assistant",
      content: "It's a null-check issue.",
      created_at: "2026-01-01T00:00:01Z",
    });

    renderChatPanel();
    await screen.findByText(/ask a follow-up question/i);

    const input = screen.getByPlaceholderText(/ask a question about this review/i);
    fireEvent.change(input, { target: { value: "What about line 12?" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(mockedSend).toHaveBeenCalledWith(1, 2, "What about line 12?"));
    expect(await screen.findByText("It's a null-check issue.")).toBeInTheDocument();
  });

  it("does not submit an empty message", async () => {
    mockedList.mockResolvedValueOnce([]);
    renderChatPanel();
    await screen.findByText(/ask a follow-up question/i);

    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(mockedSend).not.toHaveBeenCalled());
  });
});
