import { clearDashboardChatMessages, listDashboardChatMessages, streamDashboardChatMessage } from "../api/dashboardChat";
import { ChatThread } from "./ChatThread";

export function DashboardChatPanel() {
  return (
    <ChatThread
      className="chat-panel-dashboard"
      title="Ask about your repos"
      placeholder="Ask about your projects, reviews, or findings..."
      emptyHint={
        <>
          Ask anything across all your connected repos — e.g. "what critical issues do I have?" or
          "summarize my last review".
        </>
      }
      queryKey={["dashboard-chat"]}
      listMessages={listDashboardChatMessages}
      streamMessage={(content, onDelta, signal) => streamDashboardChatMessage(content, onDelta, signal)}
      clearMessages={clearDashboardChatMessages}
    />
  );
}
