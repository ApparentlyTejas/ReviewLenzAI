import { useMutation, useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { motion } from "framer-motion";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { getReview, postReviewComment } from "../api/projects";
import { BackButton } from "../components/BackButton";
import { ChatPanel } from "../components/ChatPanel";
import { DiffViewer } from "../components/DiffViewer";
import { pageTransition } from "../components/pageTransition";
import { Spinner } from "../components/Spinner";
import { TiltCard } from "../components/TiltCard";
import { useToast } from "../components/Toast";
import { reviewToMarkdown } from "../lib/reviewMarkdown";
import { countBySeverity, sortFindingsBySeverity } from "../lib/severity";
import type { FindingSeverity } from "../types";

const SEVERITY_FILTERS: FindingSeverity[] = ["critical", "high", "medium", "low"];

export function ReviewDetail() {
  const { projectId, reviewId } = useParams<{ projectId: string; reviewId: string }>();
  const id = Number(projectId);
  const rId = Number(reviewId);
  const { toast } = useToast();
  const [prefill, setPrefill] = useState<string | null>(null);
  const [tab, setTab] = useState<"diff" | "findings">("diff");
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | "all">("all");

  const { data: review, isLoading } = useQuery({
    queryKey: ["review", id, rId],
    queryFn: () => getReview(id, rId),
  });

  const postCommentMutation = useMutation({
    mutationFn: () => postReviewComment(id, rId),
    onSuccess: () => toast("Review posted as a comment on the pull request."),
    onError: (err: AxiosError<{ detail: string }>) => {
      toast(err.response?.data?.detail ?? "Failed to post comment to GitHub.", "error");
    },
  });

  if (isLoading) return <Spinner label="Loading review..." />;
  if (!review) return <p>Review not found.</p>;

  const sortedFindings = sortFindingsBySeverity(review.findings);
  const severityCounts = countBySeverity(sortedFindings);
  const visibleFindings =
    severityFilter === "all" ? sortedFindings : sortedFindings.filter((f) => f.severity === severityFilter);
  const reviewMarkdown = reviewToMarkdown(review, sortedFindings);
  const newFindingIds = new Set(review.delta?.new_finding_ids ?? []);

  function askAboutFinding(finding: (typeof sortedFindings)[number]) {
    const location = finding.file_path + (finding.line_number ? `:${finding.line_number}` : "");
    setPrefill(`Explain the ${finding.severity} ${finding.category} issue at ${location} and how to fix it.`);
  }

  async function copyAsMarkdown() {
    try {
      await navigator.clipboard.writeText(reviewMarkdown);
      toast("Review copied as Markdown.");
    } catch {
      toast("Could not copy to clipboard.", "error");
    }
  }

  return (
    <motion.div {...pageTransition}>
      <BackButton to={`/projects/${id}/reviews`} label="Review history" />
      <header className="page-header">
        <h1>
          PR #{review.pr_number}: {review.pr_title}
        </h1>
        <div className="page-header-actions">
          <button type="button" className="secondary small" onClick={copyAsMarkdown}>
            Copy as Markdown
          </button>
          {review.status === "completed" && (
            <button
              type="button"
              className="secondary small"
              disabled={postCommentMutation.isPending}
              onClick={() => postCommentMutation.mutate()}
            >
              {postCommentMutation.isPending ? "Posting..." : "Post to GitHub"}
            </button>
          )}
          <a href={review.pr_url} target="_blank" rel="noreferrer">
            View on GitHub
          </a>
        </div>
      </header>

      <p className="review-status-row">
        <span className={`badge status-${review.status}`}>{review.status}</span>
        <span className="review-status-date">{new Date(review.created_at).toLocaleString()}</span>
      </p>

      {review.status === "failed" && <p className="error">Review failed: {review.error_message}</p>}

      {review.delta && (review.delta.resolved_count > 0 || review.delta.new_finding_ids.length > 0) && (
        <p className="review-delta-banner">
          Since the last review:{" "}
          {review.delta.resolved_count > 0 && <span className="review-delta-resolved">{review.delta.resolved_count} resolved</span>}
          {review.delta.resolved_count > 0 && review.delta.new_finding_ids.length > 0 && ", "}
          {review.delta.new_finding_ids.length > 0 && (
            <span className="review-delta-new">{review.delta.new_finding_ids.length} new</span>
          )}
        </p>
      )}

      {review.status === "completed" && sortedFindings.length === 0 && <p>No issues found. Clean diff!</p>}

      {review.status === "completed" && (
        <div className="theme-pref-row" role="tablist" aria-label="Review view">
          <button
            type="button"
            className={`theme-pref-option${tab === "diff" ? " active" : ""}`}
            onClick={() => setTab("diff")}
          >
            Diff
          </button>
          <button
            type="button"
            className={`theme-pref-option${tab === "findings" ? " active" : ""}`}
            onClick={() => setTab("findings")}
          >
            Findings
          </button>
        </div>
      )}

      {review.status === "completed" && sortedFindings.length > 0 && (
        <div className="severity-filter-row" role="group" aria-label="Filter findings by severity">
          <button
            type="button"
            className={`severity-filter-chip${severityFilter === "all" ? " active" : ""}`}
            onClick={() => setSeverityFilter("all")}
          >
            All ({sortedFindings.length})
          </button>
          {SEVERITY_FILTERS.filter((severity) => severityCounts[severity] > 0).map((severity) => (
            <button
              key={severity}
              type="button"
              className={`severity-filter-chip severity-filter-${severity}${severityFilter === severity ? " active" : ""}`}
              onClick={() => setSeverityFilter(severity)}
            >
              {severity} ({severityCounts[severity]})
            </button>
          ))}
        </div>
      )}

      <div className={review.status === "completed" ? "review-detail-grid" : undefined}>
        {review.status !== "completed" || tab === "diff" ? (
          <DiffViewer
            diffText={review.diff_snapshot}
            findings={visibleFindings}
            onAskAboutFinding={askAboutFinding}
            newFindingIds={newFindingIds}
          />
        ) : visibleFindings.length === 0 ? (
          <p>No {severityFilter} findings.</p>
        ) : (
          <ul className="finding-list">
            {visibleFindings.map((finding, index) => (
              <TiltCard
                as="li"
                key={finding.id}
                className={`finding finding-${finding.severity}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.06 }}
              >
                <div className="finding-header">
                  <span className="badge badge-category">{finding.category}</span>
                  <span className="badge badge-severity">{finding.severity}</span>
                  {newFindingIds.has(finding.id) && <span className="badge badge-new">New</span>}
                  <code>
                    {finding.file_path}
                    {finding.line_number ? `:${finding.line_number}` : ""}
                  </code>
                </div>
                <p>{finding.message}</p>
                {finding.suggested_fix && (
                  <details>
                    <summary>Suggested fix</summary>
                    <pre>{finding.suggested_fix}</pre>
                  </details>
                )}
                <button type="button" className="secondary small finding-ask-button" onClick={() => askAboutFinding(finding)}>
                  Ask about this
                </button>
              </TiltCard>
            ))}
          </ul>
        )}

        {review.status === "completed" && (
          <ChatPanel projectId={id} reviewId={rId} prefill={prefill} onPrefillConsumed={() => setPrefill(null)} />
        )}
      </div>
    </motion.div>
  );
}
