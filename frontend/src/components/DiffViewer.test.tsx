import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiffViewer } from "./DiffViewer";
import type { Finding } from "../types";

afterEach(() => {
  cleanup();
});

const DIFF = `diff --git a/app.py b/app.py
index ab12cd3..ef45gh6 100644
--- a/app.py
+++ b/app.py
@@ -10,6 +10,7 @@ def handler(request):
     user = get_user(request)
     query = request.args.get("q")
-    result = db.execute(f"SELECT * FROM t WHERE q = '{query}'")
+    result = db.execute("SELECT * FROM t WHERE q = :q", {"q": query})
+    log.info("query executed")
     return result
`;

const FINDING: Finding = {
  id: 1,
  category: "security",
  severity: "critical",
  file_path: "app.py",
  line_number: 12,
  message: "SQL injection via unsanitized query parameter.",
  suggested_fix: "Use parameterized queries.",
};

describe("DiffViewer", () => {
  it("shows an empty-state message when there's no diff", () => {
    render(<DiffViewer diffText="" findings={[]} />);
    expect(screen.getByText("No diff available for this review.")).toBeInTheDocument();
  });

  it("renders the file path and +/- stats", () => {
    render(<DiffViewer diffText={DIFF} findings={[]} />);
    expect(screen.getByText("app.py")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
  });

  it("renders diff line content for additions, deletions, and context", () => {
    render(<DiffViewer diffText={DIFF} findings={[]} />);
    expect(screen.getByText(/result = db\.execute\(f"SELECT/)).toBeInTheDocument();
    expect(screen.getByText(/result = db\.execute\("SELECT \* FROM t WHERE q = :q"/)).toBeInTheDocument();
    expect(screen.getByText('log.info("query executed")')).toBeInTheDocument();
  });

  it("places a finding inline at its line number, not just in a flat list", () => {
    render(<DiffViewer diffText={DIFF} findings={[FINDING]} />);
    expect(screen.getByText("SQL injection via unsanitized query parameter.")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("1 finding")).toBeInTheDocument();
  });

  it("does not place a finding on a line it doesn't reference", () => {
    const wrongLine: Finding = { ...FINDING, line_number: 999 };
    render(<DiffViewer diffText={DIFF} findings={[wrongLine]} />);
    expect(screen.queryByText("SQL injection via unsanitized query parameter.")).not.toBeInTheDocument();
  });

  it("calls onAskAboutFinding with the finding when its button is clicked", () => {
    const onAsk = vi.fn();
    render(<DiffViewer diffText={DIFF} findings={[FINDING]} onAskAboutFinding={onAsk} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask about this" }));
    expect(onAsk).toHaveBeenCalledWith(FINDING);
  });

  it("omits the ask button when no handler is passed", () => {
    render(<DiffViewer diffText={DIFF} findings={[FINDING]} />);
    expect(screen.queryByRole("button", { name: "Ask about this" })).not.toBeInTheDocument();
  });

  it("marks a finding as New when its id is in newFindingIds", () => {
    render(<DiffViewer diffText={DIFF} findings={[FINDING]} newFindingIds={new Set([1])} />);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("does not mark a finding as New when its id is absent from newFindingIds", () => {
    render(<DiffViewer diffText={DIFF} findings={[FINDING]} newFindingIds={new Set([999])} />);
    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });

  it("collapses and re-expands a file's lines when its header is clicked", () => {
    render(<DiffViewer diffText={DIFF} findings={[]} />);
    const header = screen.getByRole("button", { name: /app\.py/ });
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText('log.info("query executed")')).toBeInTheDocument();

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText('log.info("query executed")')).not.toBeInTheDocument();

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText('log.info("query executed")')).toBeInTheDocument();
  });

  it("tags a new file", () => {
    const newFileDiff = `diff --git a/new.py b/new.py
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/new.py
@@ -0,0 +1,1 @@
+print("hi")
`;
    render(<DiffViewer diffText={newFileDiff} findings={[]} />);
    expect(screen.getByText("new")).toBeInTheDocument();
  });
});
