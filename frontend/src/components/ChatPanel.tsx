import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChatStreamError, listChatMessages, streamChatMessage } from "../api/chat";
import { useToast } from "./Toast";
import { Spinner } from "./Spinner";

interface ChatPanelProps {
  projectId: number;
  reviewId: number;
  /** Set by a parent (e.g. a "Ask about this" button on a finding) to prefill and
   * focus the input. Consumed via onPrefillConsumed so the same value can be set again. */
  prefill?: string | null;
  onPrefillConsumed?: () => void;
}

export function ChatPanel({ projectId, reviewId, prefill, onPrefillConsumed }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["chat", projectId, reviewId],
    queryFn: () => listChatMessages(projectId, reviewId),
  });

  useEffect(() => {
    if (prefill) {
      setInput(prefill);
      inputRef.current?.focus();
      onPrefillConsumed?.();
    }
  }, [prefill, onPrefillConsumed]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages, pendingQuestion, streamingReply]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || isStreaming) return;

    setInput("");
    setPendingQuestion(content);
    setStreamingReply("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChatMessage(
        projectId,
        reviewId,
        content,
        (chunk) => setStreamingReply((prev) => prev + chunk),
        controller.signal,
      );
      await queryClient.invalidateQueries({ queryKey: ["chat", projectId, reviewId] });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        const message = error instanceof ChatStreamError ? error.message : "Failed to get a response.";
        toast(message, "error");
      }
    } finally {
      setPendingQuestion(null);
      setStreamingReply("");
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  return (
    <div className="chat-panel">
      <h2>Ask about this review</h2>

      {isLoading ? (
        <Spinner label="Loading chat..." />
      ) : (
        <div className="chat-messages">
          {messages && messages.length === 0 && !pendingQuestion && (
            <p className="chat-empty">
              Ask a follow-up question about this PR's diff or findings — e.g. "why is the
              null-check finding a real issue?" or "is this safe to merge?"
            </p>
          )}
          {messages?.map((message) => (
            <div key={message.id} className={`chat-message chat-message-${message.role}`}>
              <span className="chat-message-role">{message.role === "user" ? "You" : "Assistant"}</span>
              <ChatMarkdown content={message.content} />
            </div>
          ))}
          {pendingQuestion && (
            <div className="chat-message chat-message-user">
              <span className="chat-message-role">You</span>
              <p>{pendingQuestion}</p>
            </div>
          )}
          {isStreaming && (
            <div className="chat-message chat-message-assistant chat-message-pending">
              <span className="chat-message-role">Assistant</span>
              {streamingReply ? <ChatMarkdown content={streamingReply} /> : <p className="chat-thinking">Thinking...</p>}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this review..."
          disabled={isStreaming}
          maxLength={2000}
        />
        {isStreaming ? (
          <button type="button" className="secondary" onClick={handleStop}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()}>
            Send
          </button>
        )}
      </form>
    </div>
  );
}

function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
