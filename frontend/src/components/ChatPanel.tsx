import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listChatMessages, sendChatMessage } from "../api/chat";
import { useToast } from "./Toast";
import { Spinner } from "./Spinner";

export function ChatPanel({ projectId, reviewId }: { projectId: number; reviewId: number }) {
  const [input, setInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["chat", projectId, reviewId],
    queryFn: () => listChatMessages(projectId, reviewId),
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendChatMessage(projectId, reviewId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", projectId, reviewId] });
    },
    onError: (error: unknown) => {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Failed to get a response. Please try again.";
      toast(detail, "error");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(content);
  }

  return (
    <div className="chat-panel">
      <h2>Ask about this review</h2>

      {isLoading ? (
        <Spinner label="Loading chat..." />
      ) : (
        <div className="chat-messages">
          {messages && messages.length === 0 && (
            <p className="chat-empty">
              Ask a follow-up question about this PR's diff or findings — e.g. "why is the
              null-check finding a real issue?" or "is this safe to merge?"
            </p>
          )}
          {messages?.map((message) => (
            <div key={message.id} className={`chat-message chat-message-${message.role}`}>
              <span className="chat-message-role">{message.role === "user" ? "You" : "Assistant"}</span>
              <p>{message.content}</p>
            </div>
          ))}
          {sendMutation.isPending && (
            <div className="chat-message chat-message-assistant chat-message-pending">
              <span className="chat-message-role">Assistant</span>
              <p>Thinking...</p>
            </div>
          )}
        </div>
      )}

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this review..."
          disabled={sendMutation.isPending}
          maxLength={2000}
        />
        <button type="submit" disabled={sendMutation.isPending || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
