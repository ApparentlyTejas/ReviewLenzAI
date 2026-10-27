import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { getReview } from "../api/projects";
import { BackButton } from "../components/BackButton";
import { ChatPanel } from "../components/ChatPanel";
import { pageTransition } from "../components/pageTransition";
import { Spinner } from "../components/Spinner";
import { sortFindingsBySeverity } from "../lib/severity";

export function ReviewDetail() {
  const { projectId, reviewId } = useParams<{ projectId: string; reviewId: string }>();
  const id = Number(projectId);
  const rId = Number(reviewId);
  const [prefill, setPrefill] = useState<string | null>(null);

  const { data: review, isLoading } = useQuery({
    queryKey: ["review", id, rId],
    queryFn: () => getReview(id, rId),
  });

  if (isLoading) return <Spinner label="Loading review..." />;
  if (!review) return <p>Review not found.</p>;

  const sortedFindings = sortFindingsBySeverity(review.findings);

  function askAboutFinding(finding: (typeof sortedFindings)[number]) {
    const location = finding.file_path + (finding.line_number ? `:${finding.line_number}` : "");
    setPrefill(`Explain the ${finding.severity} ${finding.category} issue at ${location} and how to fix it.`);
  }

  return (
    <motion.div {...pageTransition}>
      <BackButton to={`/projects/${id}/reviews`} label="Review history" />
      <header className="page-header">
        <h1>
          PR #{review.pr_number}: {review.pr_title}
        </h1>
        <a href={review.pr_url} target="_blank" rel="noreferrer">
          View on GitHub
        </a>
      </header>

      <p>
        Status: <strong>{review.status}</strong> &middot; Model: {review.model_used}
      </p>

      {review.status === "failed" && <p className="error">Review failed: {review.error_message}</p>}

      {review.status === "completed" && sortedFindings.length === 0 && <p>No issues found. Clean diff!</p>}

      <div className={review.status === "completed" ? "review-detail-grid" : undefined}>
        <ul className="finding-list">
          {sortedFindings.map((finding, index) => (
            <motion.li
              key={finding.id}
              className={`finding finding-${finding.severity}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.06 }}
            >
              <div className="finding-header">
                <span className="badge badge-category">{finding.category}</span>
                <span className="badge badge-severity">{finding.severity}</span>
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
              {review.status === "completed" && (
                <button type="button" className="secondary small finding-ask-button" onClick={() => askAboutFinding(finding)}>
                  Ask about this
                </button>
              )}
            </motion.li>
          ))}
        </ul>

        {review.status === "completed" && (
          <ChatPanel projectId={id} reviewId={rId} prefill={prefill} onPrefillConsumed={() => setPrefill(null)} />
        )}
      </div>
    </motion.div>
  );
}
