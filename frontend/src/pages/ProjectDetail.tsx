import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { listPullRequests, listReviews, triggerReview } from "../api/projects";
import { BackButton } from "../components/BackButton";
import { pageTransition } from "../components/pageTransition";
import { Spinner } from "../components/Spinner";
import { TiltCard } from "../components/TiltCard";
import { useToast } from "../components/Toast";
import { usePageTitle } from "../hooks/usePageTitle";

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const id = Number(projectId);

  usePageTitle("Pull requests");

  const { toast } = useToast();
  const [confirmPr, setConfirmPr] = useState<{ number: number; title: string } | null>(null);

  const { data: pulls, isLoading, isError } = useQuery({
    queryKey: ["pulls", id],
    queryFn: () => listPullRequests(id),
  });

  const { data: existingReviews } = useQuery({
    queryKey: ["reviews", id],
    queryFn: () => listReviews(id),
  });

  const reviewedPrNumbers = new Set(existingReviews?.map((r) => r.pr_number) ?? []);

  const reviewMutation = useMutation({
    mutationFn: (prNumber: number) => triggerReview(id, prNumber),
    onSuccess: (review) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      navigate(`/projects/${id}/reviews/${review.id}`);
    },
    onError: (err: AxiosError<{ detail: string }>) => {
      const detail = err.response?.data?.detail ?? "Failed to start review. Please try again.";
      toast(detail, "error");
    },
  });

  function handleReviewClick(pr: { number: number; title: string }) {
    if (reviewedPrNumbers.has(pr.number)) {
      setConfirmPr(pr);
    } else {
      reviewMutation.mutate(pr.number);
    }
  }

  return (
    <motion.div {...pageTransition}>
      <BackButton to="/projects" label="Dashboard" />
      <header className="page-header">
        <h1>Open pull requests</h1>
        <Link to={`/projects/${id}/reviews`}>View review history</Link>
      </header>

      {isLoading && <Spinner label="Loading pull requests..." />}
      {isError && (
        <div className="empty-state-box">
          <p>Could not load pull requests. Your GitHub PAT may have expired, or the repository is inaccessible.</p>
          <p>Try deleting and re-adding this project with a fresh PAT.</p>
        </div>
      )}
      {reviewMutation.isPending && (
        <Spinner label="Running AI review — this can take up to 20 seconds..." />
      )}

      <AnimatePresence>
        {confirmPr && (
          <motion.div
            className="rerun-confirm"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <p>
              <strong>PR #{confirmPr.number}</strong> has already been reviewed. Run it again?
            </p>
            <div className="rerun-confirm-actions">
              <button
                onClick={() => {
                  setConfirmPr(null);
                  reviewMutation.mutate(confirmPr.number);
                }}
                disabled={reviewMutation.isPending}
              >
                Yes, review again
              </button>
              <button className="secondary" onClick={() => setConfirmPr(null)}>
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isLoading && pulls?.length === 0 && (
        <div className="empty-state-box">
          <p>No open pull requests found on this repository.</p>
          <p>Open a pull request on GitHub and come back to review it here.</p>
        </div>
      )}

      <ul className="pull-request-list">
        {pulls?.map((pr, index) => (
          <TiltCard
            as="li"
            key={pr.number}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <div>
              <strong>
                #{pr.number} {pr.title}
              </strong>
              <span> by {pr.author}</span>
              {reviewedPrNumbers.has(pr.number) && (
                <span className="badge already-reviewed-badge">reviewed</span>
              )}
            </div>
            <button
              disabled={reviewMutation.isPending}
              onClick={() => handleReviewClick(pr)}
            >
              Review this PR
            </button>
          </TiltCard>
        ))}
      </ul>

    </motion.div>
  );
}
