import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { listDeletedReviews, restoreReview } from "../api/dashboard";
import { listDeletedProjects, restoreProject } from "../api/projects";
import { BackButton } from "../components/BackButton";
import { RestoreIcon } from "../components/Icons";
import { pageTransition } from "../components/pageTransition";
import { SkeletonRows } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { usePageTitle } from "../hooks/usePageTitle";
import { timeAgo } from "../lib/timeAgo";

export function RecentlyDeleted() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  usePageTitle("Recently deleted");

  const { data: deletedProjects, isLoading: projectsLoading } = useQuery({
    queryKey: ["deleted-projects"],
    queryFn: listDeletedProjects,
  });
  const { data: deletedReviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["deleted-reviews"],
    queryFn: listDeletedReviews,
  });

  const restoreProjectMutation = useMutation({
    mutationFn: restoreProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deleted-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast("Project restored.");
    },
    onError: () => toast("Failed to restore project. Please try again.", "error"),
  });

  const restoreReviewMutation = useMutation({
    mutationFn: restoreReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deleted-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast("Review restored.");
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Failed to restore review. Please try again.";
      toast(detail, "error");
    },
  });

  const isLoading = projectsLoading || reviewsLoading;
  const isEmpty = !isLoading && !deletedProjects?.length && !deletedReviews?.length;

  return (
    <motion.div {...pageTransition}>
      <BackButton to="/settings" label="Settings" />
      <header className="page-header">
        <h1>Recently deleted</h1>
      </header>
      <p className="page-subtitle" style={{ marginBottom: 28 }}>
        Disconnected repos and deleted reviews stay here for 30 days before they're gone for good.
      </p>

      {isLoading && <SkeletonRows variant="activity" count={4} />}

      {isEmpty && (
        <div className="empty-state-box">
          <p>Nothing here.</p>
          <p>Anything you disconnect or delete shows up here for 30 days.</p>
        </div>
      )}

      {!!deletedProjects?.length && (
        <>
          <div className="dash-section-header">
            <h2>Disconnected repos</h2>
            <span className="dash-section-count">{deletedProjects.length}</span>
          </div>
          <ul className="activity-list" style={{ marginBottom: 28 }}>
            {deletedProjects.map((project) => (
              <li key={project.id} className="activity-item">
                <div className="activity-link" style={{ pointerEvents: "none" }}>
                  <div className="activity-left">
                    <span className="activity-repo">
                      {project.repo_owner}/{project.repo_name}
                    </span>
                    <span className="activity-pr">Deleted {timeAgo(project.deleted_at)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary small"
                  disabled={restoreProjectMutation.isPending}
                  onClick={() => restoreProjectMutation.mutate(project.id)}
                >
                  <RestoreIcon size={13} />
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {!!deletedReviews?.length && (
        <>
          <div className="dash-section-header">
            <h2>Deleted reviews</h2>
            <span className="dash-section-count">{deletedReviews.length}</span>
          </div>
          <ul className="activity-list">
            {deletedReviews.map((review) => (
              <li key={review.id} className="activity-item">
                <div className="activity-link" style={{ pointerEvents: "none" }}>
                  <div className="activity-left">
                    <span className="activity-repo">
                      {review.repo_owner}/{review.repo_name}
                    </span>
                    <span className="activity-pr">
                      <span className="activity-pr-num">#{review.pr_number}</span>
                      {review.pr_title}
                    </span>
                  </div>
                  <div className="activity-right">
                    <span className="activity-time">Deleted {timeAgo(review.deleted_at)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary small"
                  disabled={restoreReviewMutation.isPending}
                  onClick={() => restoreReviewMutation.mutate(review.id)}
                >
                  <RestoreIcon size={13} />
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {!isEmpty && (
        <p className="page-subtitle" style={{ marginTop: 20 }}>
          Looking for something else? <Link to="/settings">Back to Settings</Link>
        </p>
      )}
    </motion.div>
  );
}
