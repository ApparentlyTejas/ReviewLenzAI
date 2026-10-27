import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatThread } from "./ChatThread";
import { ChatStreamError } from "../api/chat";
import { ToastProvider } from "./Toast";

function renderChatThread(overrides: Partial<React.ComponentProps<typeof ChatThread>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const listMessages = overrides.listMessages ?? vi.fn().mockResolvedValue([]);
  const streamMessage = overrides.streamMessage ?? vi.fn();
  const clearMessages = overrides.clearMessages ?? vi.fn().mockResolvedValue(undefined);

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ChatThread
          title="Ask about this review"
          placeholder="Ask a question about this review..."
          emptyHint="Ask a follow-up question here."
          queryKey={["test-chat"]}
          listMessages={listMessages}
          streamMessage={streamMessage}
          clearMessages={clearMessages}
          {...overrides}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );

  return { ...utils, listMessages, streamMessage, clearMessages };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ChatThread", () => {
  it("shows the empty hint when there's no history yet", async () => {
    renderChatThread();
    expect(await screen.findByText(/ask a follow-up question here/i)).toBeInTheDocument();
  });

  it("renders existing chat history as markdown", async () => {
    renderChatThread({
      listMessages: vi.fn().mockResolvedValue([
        { id: 1, role: "user", content: "Is this safe?", created_at: "2026-01-01T00:00:00Z" },
        { id: 2, role: "assistant", content: "**Yes**, looks fine.", created_at: "2026-01-01T00:00:01Z" },
      ]),
    });

    expect(await screen.findByText("Is this safe?")).toBeInTheDocument();
    const strong = await screen.findByText("Yes");
    expect(strong.tagName).toBe("STRONG");
  });

  it("streams a reply and refreshes history with the final persisted message", async () => {
    let listCallCount = 0;
    const listMessages = vi.fn().mockImplementation(() => {
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
    const streamMessage = vi.fn().mockImplementation(async (_content, onDelta) => {
      onDelta("It's a ");
      onDelta("null-check issue.");
      return { id: 2, role: "assistant", content: "It's a null-check issue.", created_at: "2026-01-01T00:00:01Z" };
    });

    renderChatThread({ listMessages, streamMessage });
    await screen.findByText(/ask a follow-up question here/i);

    const input = screen.getByPlaceholderText(/ask a question about this review/i);
    fireEvent.change(input, { target: { value: "What about line 12?" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(streamMessage).toHaveBeenCalled());
    await waitFor(async () => expect(await screen.findByText("It's a null-check issue.")).toBeInTheDocument());
    expect(streamMessage).toHaveBeenCalledWith("What about line 12?", expect.any(Function), expect.anything());
  });

  it("does not submit an empty message", async () => {
    const streamMessage = vi.fn();
    renderChatThread({ streamMessage });
    await screen.findByText(/ask a follow-up question here/i);

    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(streamMessage).not.toHaveBeenCalled());
  });

  it("shows the stream error as a toast and clears the pending state", async () => {
    const streamMessage = vi.fn().mockRejectedValue(new ChatStreamError("Groq API call failed", 502));
    renderChatThread({ streamMessage });
    await screen.findByText(/ask a follow-up question here/i);

    const input = screen.getByPlaceholderText(/ask a question about this review/i);
    fireEvent.change(input, { target: { value: "Will this fail?" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByText("Groq API call failed")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Will this fail?")).not.toBeInTheDocument());
  });

  it("prefills the input when the prefill prop is set", async () => {
    const onPrefillConsumed = vi.fn();
    renderChatThread({ prefill: "Explain the high bug issue at app.py:15.", onPrefillConsumed });

    await screen.findByText(/ask a follow-up question here/i);
    const input = screen.getByPlaceholderText(/ask a question about this review/i) as HTMLInputElement;

    await waitFor(() => expect(input.value).toBe("Explain the high bug issue at app.py:15."));
    expect(onPrefillConsumed).toHaveBeenCalled();
  });

  it("can stop an in-flight stream", async () => {
    let capturedSignal: AbortSignal | undefined;
    const streamMessage = vi.fn().mockImplementation(
      (_content: string, _onDelta: (c: string) => void, signal?: AbortSignal) =>
        new Promise((_resolve, reject) => {
          capturedSignal = signal;
          signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );

    renderChatThread({ streamMessage });
    await screen.findByText(/ask a follow-up question here/i);

    const input = screen.getByPlaceholderText(/ask a question about this review/i);
    fireEvent.change(input, { target: { value: "Will this hang?" } });
    fireEvent.submit(input.closest("form")!);

    const stopButton = await screen.findByRole("button", { name: /stop/i });
    fireEvent.click(stopButton);

    await waitFor(() => expect(capturedSignal?.aborted).toBe(true));
    await waitFor(() => expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument());
  });

  it("does not show a New chat button when there's no history", async () => {
    renderChatThread();
    await screen.findByText(/ask a follow-up question here/i);
    expect(screen.queryByRole("button", { name: /new chat/i })).not.toBeInTheDocument();
  });

  it("clears history when New chat is clicked", async () => {
    let listCallCount = 0;
    const listMessages = vi.fn().mockImplementation(() => {
      listCallCount += 1;
      return Promise.resolve(
        listCallCount === 1
          ? [{ id: 1, role: "user", content: "Old question", created_at: "2026-01-01T00:00:00Z" }]
          : [],
      );
    });
    const clearMessages = vi.fn().mockResolvedValue(undefined);

    renderChatThread({ listMessages, clearMessages });
    await screen.findByText("Old question");

    fireEvent.click(screen.getByRole("button", { name: /new chat/i }));

    expect(clearMessages).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText("Old question")).not.toBeInTheDocument());
  });
});
