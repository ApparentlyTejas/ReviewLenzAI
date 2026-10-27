import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { ChatStreamError } from "../api/chat";
import type { ChatMessage } from "../types";
import { useToast } from "./Toast";
import { Spinner } from "./Spinner";

interface ChatThreadProps {
  title: string;
  placeholder: string;
  emptyHint: ReactNode;
  queryKey: unknown[];
  listMessages: () => Promise<ChatMessage[]>;
  streamMessage: (content: string, onDelta: (chunk: string) => void, signal?: AbortSignal) => Promise<ChatMessage>;
  /** Set by a parent (e.g. a "Ask about this" button on a finding) to prefill and
   * focus the input. Consumed via onPrefillConsumed so the same value can be set again. */
  prefill?: string | null;
  onPrefillConsumed?: () => void;
  /** Extra class on the root element — e.g. a non-sticky, full-width variant for
   * placements outside the review page's two-column sidebar layout. */
  className?: string;
}

/** The shared streaming-chat UI (message list, markdown rendering, auto-scroll,
 * stop/send) used by both the per-review chat and the dashboard chat — they only
 * differ in where messages come from and what grounds the model's answers. */
export function ChatThread({
  title,
  placeholder,
  emptyHint,
  queryKey,
  listMessages,
  streamMessage,
  prefill,
  onPrefillConsumed,
  className,
}: ChatThreadProps) {
  const [input, setInput] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: messages, isLoading } = useQuery({ queryKey, queryFn: listMessages });

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
      await streamMessage(content, (chunk) => setStreamingReply((prev) => prev + chunk), controller.signal);
      await queryClient.invalidateQueries({ queryKey });
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
    <div className={`chat-panel${className ? ` ${className}` : ""}`}>
      <h2>{title}</h2>

      {isLoading ? (
        <Spinner label="Loading chat..." />
      ) : (
        <div className="chat-messages">
          {messages && messages.length === 0 && !pendingQuestion && <p className="chat-empty">{emptyHint}</p>}
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
          placeholder={placeholder}
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
