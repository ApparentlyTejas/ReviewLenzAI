import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "./ChatPanel";
import { ToastProvider } from "./Toast";

vi.mock("../api/chat", async () => {
  const actual = await vi.importActual<typeof import("../api/chat")>("../api/chat");
  return {
    ...actual,
    listChatMessages: vi.fn(),
    streamChatMessage: vi.fn(),
  };
});

import { listChatMessages, streamChatMessage, ChatStreamError } from "../api/chat";

const mockedList = listChatMessages as unknown as ReturnType<typeof vi.fn>;
const mockedStream = streamChatMessage as unknown as ReturnType<typeof vi.fn>;

function renderChatPanel(props: Partial<React.ComponentProps<typeof ChatPanel>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ChatPanel projectId={1} reviewId={2} {...props} />
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

  it("renders existing chat history as markdown", async () => {
    mockedList.mockResolvedValueOnce([
      { id: 1, role: "user", content: "Is this safe?", created_at: "2026-01-01T00:00:00Z" },
      { id: 2, role: "assistant", content: "**Yes**, looks fine.", created_at: "2026-01-01T00:00:01Z" },
    ]);
    renderChatPanel();

    expect(await screen.findByText("Is this safe?")).toBeInTheDocument();
    const strong = await screen.findByText("Yes");
    expect(strong.tagName).toBe("STRONG");
  });

  it("streams a reply and refreshes history with the final persisted message", async () => {
    let listCallCount = 0;
    mockedList.mockImplementation(() => {
      listCallCount += 1;
      return Promise.resolve(
        listCallCount === 1
          ? []
          : [
              { id: 1, role: "user", content: "What about line 12?", created_at: "2026-01-01T00:00:00Z" },
              { id: 2, role: "assistant", content: "It's a null-check issue.", created_at: "2026-01-01T00:00:01Z" },
            ],
      );
    });
    mockedStream.mockImplementationOnce(async (_p, _r, _content, onDelta) => {
      onDelta("It's a ");
      onDelta("null-check issue.");
      return { id: 2, role: "assistant", content: "It's a null-check issue.", created_at: "2026-01-01T00:00:01Z" };
    });

    renderChatPanel();
    await screen.findByText(/ask a follow-up question/i);

    const input = screen.getByPlaceholderText(/ask a question about this review/i);
    fireEvent.change(input, { target: { value: "What about line 12?" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(mockedStream).toHaveBeenCalled());
    await waitFor(async () => expect(await screen.findByText("It's a null-check issue.")).toBeInTheDocument());
    expect(mockedStream).toHaveBeenCalledWith(1, 2, "What about line 12?", expect.any(Function), expect.anything());
  });

  it("does not submit an empty message", async () => {
    mockedList.mockResolvedValueOnce([]);
    renderChatPanel();
    await screen.findByText(/ask a follow-up question/i);

    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(mockedStream).not.toHaveBeenCalled());
  });

  it("shows the stream error as a toast and clears the pending state", async () => {
    mockedList.mockResolvedValueOnce([]);
    mockedList.mockResolvedValueOnce([]);
    mockedStream.mockRejectedValueOnce(new ChatStreamError("Groq API call failed", 502));

    renderChatPanel();
    await screen.findByText(/ask a follow-up question/i);

    const input = screen.getByPlaceholderText(/ask a question about this review/i);
    fireEvent.change(input, { target: { value: "Will this fail?" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByText("Groq API call failed")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Will this fail?")).not.toBeInTheDocument());
  });

  it("prefills the input when the prefill prop is set", async () => {
    mockedList.mockResolvedValueOnce([]);
    const onPrefillConsumed = vi.fn();
    renderChatPanel({ prefill: "Explain the high bug issue at app.py:15.", onPrefillConsumed });

    await screen.findByText(/ask a follow-up question/i);
    const input = screen.getByPlaceholderText(/ask a question about this review/i) as HTMLInputElement;

    await waitFor(() => expect(input.value).toBe("Explain the high bug issue at app.py:15."));
    expect(onPrefillConsumed).toHaveBeenCalled();
  });
});
