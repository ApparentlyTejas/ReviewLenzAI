import { listChatMessages, streamChatMessage } from "../api/chat";
import { ChatThread } from "./ChatThread";

interface ChatPanelProps {
  projectId: number;
  reviewId: number;
  prefill?: string | null;
  onPrefillConsumed?: () => void;
}

export function ChatPanel({ projectId, reviewId, prefill, onPrefillConsumed }: ChatPanelProps) {
  return (
    <ChatThread
      title="Ask about this review"
      placeholder="Ask a question about this review..."
      emptyHint={
        <>
          Ask a follow-up question about this PR's diff or findings — e.g. "why is the null-check
          finding a real issue?" or "is this safe to merge?"
        </>
      }
      queryKey={["chat", projectId, reviewId]}
      listMessages={() => listChatMessages(projectId, reviewId)}
      streamMessage={(content, onDelta, signal) => streamChatMessage(projectId, reviewId, content, onDelta, signal)}
      prefill={prefill}
      onPrefillConsumed={onPrefillConsumed}
    />
  );
}
