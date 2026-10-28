import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import { deleteReview, listReviews } from "../api/projects";
import { BackButton } from "../components/BackButton";
import { ConfirmDeleteButton } from "../components/ConfirmDeleteButton";
import { pageTransition } from "../components/pageTransition";
import { SkeletonRows } from "../components/Skeleton";
import { TiltCard } from "../components/TiltCard";
import { useToast } from "../components/Toast";
import type { ReviewSummary } from "../types";

type SortKey = "date-desc" | "date-asc" | "findings-desc" | "status";

const SORTERS: Record<SortKey, (a: ReviewSummary, b: ReviewSummary) => number> = {
  "date-desc": (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  "date-asc": (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  "findings-desc": (a, b) => b.finding_count - a.finding_count,
  status: (a, b) => a.status.localeCompare(b.status),
};

export function ReviewHistory() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = Number(projectId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["reviews", id],
    queryFn: () => listReviews(id),
  });

  const deleteMutation = useMutation({
    mutationFn: (reviewId: number) => deleteReview(id, reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast("Review deleted. Restorable from Settings for 30 days.");
    },
    onError: () => toast("Failed to delete review. Please try again.", "error"),
  });

  const sortedReviews = useMemo(() => {
    if (!reviews) return reviews;
    return [...reviews].sort(SORTERS[sortKey]);
  }, [reviews, sortKey]);

  return (
    <motion.div {...pageTransition}>
      <BackButton to={`/projects/${id}`} label="Pull requests" />
      <header className="page-header">
        <h1>Review history</h1>
        {reviews && reviews.length > 1 && (
          <label className="sort-control">
            Sort by
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="findings-desc">Most findings</option>
              <option value="status">Status</option>
            </select>
          </label>
        )}
      </header>

      {isLoading && <SkeletonRows variant="row" />}

      <ul className="review-history-list">
        {sortedReviews?.map((review, index) => (
          <TiltCard
            as="li"
            key={review.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Link to={`/projects/${id}/reviews/${review.id}`}>
              PR #{review.pr_number}: {review.pr_title}
            </Link>
            <span className={`badge status-${review.status}`}>{review.status}</span>
            <span>{review.finding_count} findings</span>
            <span>{new Date(review.created_at).toLocaleString()}</span>
            <ConfirmDeleteButton
              onConfirm={() => deleteMutation.mutate(review.id)}
              disabled={deleteMutation.isPending}
            />
          </TiltCard>
        ))}
        {reviews?.length === 0 && <p>No reviews yet.</p>}
      </ul>
    </motion.div>
  );
}
