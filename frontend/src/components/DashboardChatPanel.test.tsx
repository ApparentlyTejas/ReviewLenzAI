import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardChatPanel } from "./DashboardChatPanel";
import { ToastProvider } from "./Toast";

vi.mock("../api/dashboardChat", () => ({
  listDashboardChatMessages: vi.fn(),
  streamDashboardChatMessage: vi.fn(),
}));

import { listDashboardChatMessages, streamDashboardChatMessage } from "../api/dashboardChat";

const mockedList = listDashboardChatMessages as unknown as ReturnType<typeof vi.fn>;
const mockedStream = streamDashboardChatMessage as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <DashboardChatPanel />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("DashboardChatPanel", () => {
  it("renders the dashboard-scoped title and hint", async () => {
    mockedList.mockResolvedValueOnce([]);
    renderPanel();

    expect(await screen.findByText("Ask about your repos")).toBeInTheDocument();
    expect(await screen.findByText(/across all your connected repos/i)).toBeInTheDocument();
  });

  it("sends messages via the dashboard chat endpoint, not a review-scoped one", async () => {
    mockedList.mockResolvedValueOnce([]);
    mockedStream.mockImplementationOnce(async (_content, onDelta) => {
      onDelta("You have 2 repos.");
      return { id: 1, role: "assistant", content: "You have 2 repos.", created_at: "2026-01-01T00:00:00Z" };
    });
    renderPanel();

    const input = await screen.findByPlaceholderText(/ask about your projects/i);
    fireEvent.change(input, { target: { value: "How many repos?" } });
    fireEvent.submit(input.closest("form")!);

    await screen.findByText("You have 2 repos.");
    expect(mockedStream).toHaveBeenCalledWith("How many repos?", expect.any(Function), expect.anything());
  });
});
