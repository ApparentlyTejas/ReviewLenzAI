import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { ChatStreamError } from "../api/chat";
import type { ChatMessage } from "../types";
import { PlusIcon, SendIcon, SparkleIcon } from "./Icons";
import { useToast } from "./Toast";
import { Spinner } from "./Spinner";

interface ChatThreadProps {
  title: string;
  placeholder: string;
  emptyHint: ReactNode;
  queryKey: unknown[];
  listMessages: () => Promise<ChatMessage[]>;
  streamMessage: (content: string, onDelta: (chunk: string) => void, signal?: AbortSignal) => Promise<ChatMessage>;
  clearMessages: () => Promise<void>;
  /** Set by a parent (e.g. a "Ask about this" button on a finding) to prefill and
   * focus the input. Consumed via onPrefillConsumed so the same value can be set again. */
  prefill?: string | null;
  onPrefillConsumed?: () => void;
  /** Extra class on the root element — e.g. a non-sticky, full-width variant for
   * placements outside the review page's two-column sidebar layout. */
  className?: string;
}

const MAX_TEXTAREA_HEIGHT = 140;

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
  clearMessages,
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
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

  function resizeTextarea() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }

  useEffect(resizeTextarea, [input]);

  async function submitQuestion(content: string) {
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || isStreaming) return;
    void submitQuestion(content);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const content = input.trim();
      if (!content || isStreaming) return;
      void submitQuestion(content);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  async function handleNewChat() {
    try {
      await clearMessages();
      await queryClient.invalidateQueries({ queryKey });
    } catch {
      toast("Failed to clear chat. Please try again.", "error");
    }
  }

  const hasHistory = !!messages && messages.length > 0;

  return (
    <div className={`chat-panel${className ? ` ${className}` : ""}`}>
      <div className="chat-panel-header">
        <h2>
          <SparkleIcon size={15} />
          {title}
        </h2>
        {hasHistory && !isStreaming && (
          <button
            type="button"
            className="secondary small chat-new-button"
            onClick={handleNewChat}
            aria-label="New chat"
            title="New chat"
          >
            <PlusIcon size={14} />
            New chat
          </button>
        )}
      </div>

      {isLoading ? (
        <Spinner label="Loading chat..." />
      ) : (
        <div className="chat-messages">
          {messages && messages.length === 0 && !pendingQuestion && <p className="chat-empty">{emptyHint}</p>}
          <AnimatePresence initial={false}>
            {messages?.map((message) => (
              <ChatBubble key={message.id} role={message.role}>
                <ChatMarkdown content={message.content} />
              </ChatBubble>
            ))}
            {pendingQuestion && (
              <ChatBubble role="user">
                <p>{pendingQuestion}</p>
              </ChatBubble>
            )}
            {isStreaming && (
              <ChatBubble role="assistant" pending>
                {streamingReply ? (
                  // Plain text + a real trailing cursor while tokens are still arriving —
                  // re-parsing as markdown every delta doesn't let a cursor sit at the true
                  // end of the text. Swaps to the fully-rendered ChatMarkdown once the
                  // message lands in `messages` (see the map above) and this bubble unmounts.
                  <p className="chat-streaming-text">
                    {streamingReply}
                    <span className="chat-cursor" aria-hidden="true" />
                  </p>
                ) : (
                  <TypingDots />
                )}
              </ChatBubble>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      )}

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isStreaming}
          maxLength={2000}
          rows={1}
        />
        {isStreaming ? (
          <button type="button" className="chat-send-button chat-stop-button" onClick={handleStop} aria-label="Stop">
            <span className="chat-stop-icon" />
          </button>
        ) : (
          <button type="submit" className="chat-send-button" disabled={!input.trim()} aria-label="Send">
            <SendIcon size={16} />
          </button>
        )}
      </form>
    </div>
  );
}

function ChatBubble({
  role,
  pending,
  children,
}: {
  role: "user" | "assistant";
  pending?: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div
      className={`chat-message chat-message-${role}${pending ? " chat-message-pending" : ""}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="chat-avatar" aria-hidden="true">
        {role === "user" ? "You" : <SparkleIcon size={13} />}
      </span>
      <div className="chat-bubble-content">{children}</div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <span className="chat-typing-dots" aria-label="Assistant is typing">
      <span />
      <span />
      <span />
    </span>
  );
}

function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
