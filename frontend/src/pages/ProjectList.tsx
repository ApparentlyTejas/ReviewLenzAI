import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getDashboardSummary, getFindingsTrend } from "../api/dashboard";
import { createProject, deleteProject, deleteReview, listProjects } from "../api/projects";
import { listGitHubRepos, createProjectFromGitHub } from "../api/github";
import { ConfirmDeleteButton } from "../components/ConfirmDeleteButton";
import { GitHubLoginButton } from "../components/GitHubLoginButton";
import { RepoPicker } from "../components/RepoPicker";
import { ChevronRightIcon } from "../components/Icons";
import { CountUp } from "../components/CountUp";
import { DashboardChatPanel } from "../components/DashboardChatPanel";
import { FindingsTrendChart } from "../components/FindingsTrendChart";
import { TiltCard } from "../components/TiltCard";
import { pageTransition } from "../components/pageTransition";
import { SkeletonRows } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { usePageTitle } from "../hooks/usePageTitle";
import { avatarColor, avatarInitials } from "../lib/avatar";
import { timeAgo } from "../lib/timeAgo";
import type { FindingSeverity, Project, ReviewStatus } from "../types";

type ProjectSortKey = "recent" | "name";

const PROJECT_SORTERS: Record<ProjectSortKey, (a: Project, b: Project) => number> = {
  recent: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  name: (a, b) => `${a.repo_owner}/${a.repo_name}`.localeCompare(`${b.repo_owner}/${b.repo_name}`),
};

const SEVERITY_ORDER: FindingSeverity[] = ["critical", "high", "medium", "low"];

const STATUS_COLOR: Record<ReviewStatus, string> = {
  completed: "#34c759",
  pending: "#f59e0b",
  failed: "#ef4444",
};

const SEVERITY_COLOR: Record<FindingSeverity, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#94a3b8",
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}



export function ProjectList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  usePageTitle("Dashboard");

  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const { data: summary } = useQuery({ queryKey: ["dashboard-summary"], queryFn: getDashboardSummary });
  const { data: trend } = useQuery({ queryKey: ["findings-trend"], queryFn: getFindingsTrend });

  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [githubPat, setGithubPat] = useState("");
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [connectTab, setConnectTab] = useState<"github" | "manual">("github");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [projectSortKey, setProjectSortKey] = useState<ProjectSortKey>("recent");

  const hasNoProjects = projects?.length === 0;
  const isFormOpen = showConnectForm || hasNoProjects;

  const sortedProjects = useMemo(() => {
    if (!projects) return projects;
    return [...projects].sort(PROJECT_SORTERS[projectSortKey]);
  }, [projects, projectSortKey]);

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: number) => deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast("Repository disconnected. Restorable from Settings for 30 days.");
    },
    onError: () => toast("Failed to disconnect repository. Please try again.", "error"),
  });

  const deleteReviewMutation = useMutation({
    mutationFn: ({ projectId, reviewId }: { projectId: number; reviewId: number }) => deleteReview(projectId, reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast("Review deleted. Restorable from Settings for 30 days.");
    },
    onError: () => toast("Failed to delete review. Please try again.", "error"),
  });

  const { data: githubRepos, isLoading: reposLoading } = useQuery({
    queryKey: ["github-repos"],
    queryFn: listGitHubRepos,
    enabled: !!(user?.has_github && isFormOpen),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: () => createProject(repoOwner, repoName, githubPat),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setRepoOwner("");
      setRepoName("");
      setGithubPat("");
      setShowConnectForm(false);
      toast(`${project.repo_owner}/${project.repo_name} connected successfully.`);
    },
    onError: (err: AxiosError<{ detail: string }>) => {
      const detail = err.response?.data?.detail ?? "Failed to connect repo. Check the token and repo name.";
      toast(detail, "error");
    },
  });

  const githubCreateMutation = useMutation({
    mutationFn: () => {
      const [owner, name] = selectedRepo.split("/");
      return createProjectFromGitHub(owner, name);
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setSelectedRepo("");
      setShowConnectForm(false);
      // Stay on the dashboard instead of jumping into the new project — same as the
      // manual-connect flow below. ProjectDetail has no way to disconnect a repo;
      // the Disconnect button only exists in this page's sidebar list.
      toast(`${project.repo_owner}/${project.repo_name} connected successfully.`);
    },
    onError: (err: AxiosError<{ detail: string }>) => {
      const detail = err.response?.data?.detail ?? "Failed to connect repo.";
      toast(detail, "error");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }

  function handleStatClick(label: string) {
    if (label === "Projects") {
      if (projects?.length === 1) {
        navigate(`/projects/${projects[0].id}`);
      } else {
        document.getElementById("section-repos")?.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      const projectId = summary?.recent_reviews[0]?.project_id ?? projects?.[0]?.id;
      if (projectId) navigate(`/projects/${projectId}/reviews`);
    }
  }

  return (
    <motion.div {...pageTransition}>
      <header className="dash-header">
        <div>
          <p className="dash-greeting">{greeting()}{user ? `, ${user.username}` : ""}.</p>
          <h1>Dashboard</h1>
          <p className="page-subtitle">Here's what's happening across your repos.</p>
        </div>
      </header>

      {summary && (
        <div className="stat-cards">
          {[
            { label: "Projects", value: summary.total_projects, sub: "repositories connected" },
            { label: "Reviews",  value: summary.total_reviews,  sub: "AI reviews completed"  },
            { label: "Findings", value: summary.total_findings, sub: null                    },
          ].map((card, i) => (
            <TiltCard
              key={card.label}
              className="stat-card"
              role="button"
              tabIndex={0}
              onClick={() => handleStatClick(card.label)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleStatClick(card.label); }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: i * 0.06 }}
            >
              <span className="stat-card-label">{card.label}</span>
              <span className="stat-card-value">
                <CountUp value={card.value} />
              </span>
              {card.label === "Findings" && summary.total_findings > 0 ? (
                <>
                  <div className="severity-bar">
                    {SEVERITY_ORDER.filter((s) => summary.findings_by_severity[s]).map((s) => (
                      <div
                        key={s}
                        className="severity-bar-segment"
                        style={{
                          flex: summary.findings_by_severity[s],
                          background: SEVERITY_COLOR[s],
                        }}
                        title={`${summary.findings_by_severity[s]} ${s}`}
                      />
                    ))}
                  </div>
                  <div className="severity-legend">
                    {SEVERITY_ORDER.filter((s) => summary.findings_by_severity[s]).map((s) => (
                      <span key={s} className="severity-legend-item">
                        <span className="severity-legend-dot" style={{ background: SEVERITY_COLOR[s] }} />
                        {summary.findings_by_severity[s]} {s}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <span className="stat-card-sub">{card.sub}</span>
              )}
            </TiltCard>
          ))}
        </div>
      )}

      {trend && <FindingsTrendChart points={trend.points} />}

      <DashboardChatPanel />

      <div className="dashboard-grid">
        <section className="dashboard-main" id="section-activity">
          <div className="dash-section-header">
            <h2>Recent activity</h2>
            {summary && summary.recent_reviews.length > 0 && (
              <span className="dash-section-count">{summary.recent_reviews.length} reviews</span>
            )}
          </div>

          {summary && summary.recent_reviews.length === 0 ? (
            <div className="empty-state-box">
              <p className="empty-state-title">No reviews yet</p>
              <p>Run your first AI review to see activity here.</p>
              <ul className="empty-state-steps">
                <li><span className="empty-state-step-num">1</span>Connect a GitHub repository</li>
                <li><span className="empty-state-step-num">2</span>Pick an open pull request</li>
                <li><span className="empty-state-step-num">3</span>Get a full review in ~20 seconds</li>
              </ul>
            </div>
          ) : (
            <ul className="activity-list">
              {summary?.recent_reviews.map((review, index) => (
                <motion.li
                  key={review.id}
                  className="activity-item"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: index * 0.04 }}
                >
                  <span
                    className="activity-status-bar"
                    data-status={review.status}
                    style={{ background: STATUS_COLOR[review.status] }}
                  />
                  <Link to={`/projects/${review.project_id}/reviews/${review.id}`} className="activity-link">
                    <div className="activity-left">
                      <span className="activity-repo">{review.repo_owner}/{review.repo_name}</span>
                      <span className="activity-pr">
                        <span className="activity-pr-num">#{review.pr_number}</span>
                        {review.pr_title}
                      </span>
                    </div>
                    <div className="activity-right">
                      <span className={`badge status-${review.status}`}>{review.status}</span>
                      <span className="activity-findings">
                        {review.finding_count} {review.finding_count === 1 ? "finding" : "findings"}
                      </span>
                      <span className="activity-time">{timeAgo(review.created_at)}</span>
                    </div>
                  </Link>
                  <ConfirmDeleteButton
                    onConfirm={() => deleteReviewMutation.mutate({ projectId: review.project_id, reviewId: review.id })}
                    disabled={deleteReviewMutation.isPending}
                  />
                </motion.li>
              ))}
            </ul>
          )}
        </section>

        <aside className="dashboard-side" id="section-repos">
          <div className="dash-section-header">
            <h2>Repositories</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {!hasNoProjects && projects && projects.length > 1 && (
                <label className="sort-control">
                  Sort
                  <select
                    value={projectSortKey}
                    onChange={(e) => setProjectSortKey(e.target.value as ProjectSortKey)}
                  >
                    <option value="recent">Recently connected</option>
                    <option value="name">Name (A–Z)</option>
                  </select>
                </label>
              )}
              {!hasNoProjects && (
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => setShowConnectForm((v) => !v)}
                >
                  {showConnectForm ? "Cancel" : "+ Add"}
                </button>
              )}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isFormOpen && (
              <motion.div
                className="connect-repo-form"
                style={{ overflow: "hidden" }}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto", transitionEnd: { overflow: "visible" } }}
                exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {user?.has_github && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <button
                      type="button"
                      className={connectTab === "github" ? "" : "secondary small"}
                      style={{ flex: 1, fontSize: 13 }}
                      onClick={() => setConnectTab("github")}
                    >
                      Browse repos
                    </button>
                    <button
                      type="button"
                      className={connectTab === "manual" ? "" : "secondary small"}
                      style={{ flex: 1, fontSize: 13 }}
                      onClick={() => setConnectTab("manual")}
                    >
                      Manual (PAT)
                    </button>
                  </div>
                )}

                {(connectTab === "github" && user?.has_github) ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {reposLoading ? (
                      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading your repos…</p>
                    ) : (
                      <label>
                        Select a repository
                        <RepoPicker
                          repos={githubRepos ?? []}
                          value={selectedRepo}
                          onChange={setSelectedRepo}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      disabled={!selectedRepo || githubCreateMutation.isPending}
                      onClick={() => githubCreateMutation.mutate()}
                    >
                      {githubCreateMutation.isPending ? "Connecting…" : "Connect repository"}
                    </button>
                  </div>
                ) : !user?.has_github ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                      Connect your GitHub account to browse repos, or add manually with a PAT.
                    </p>
                    <GitHubLoginButton intent="connect" label="Connect GitHub account" />
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <label>
                          Repo owner
                          <input value={repoOwner} onChange={(e) => setRepoOwner(e.target.value)} placeholder="e.g. octocat" required />
                        </label>
                        <label>
                          Repo name
                          <input value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="e.g. Hello-World" required />
                        </label>
                        <label>
                          GitHub personal access token
                          <input type="password" value={githubPat} onChange={(e) => setGithubPat(e.target.value)} placeholder="ghp_..." required />
                        </label>
                        <button type="submit" disabled={createMutation.isPending}>
                          {createMutation.isPending ? "Connecting..." : "Connect repository"}
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <label>
                      Repo owner
                      <input value={repoOwner} onChange={(e) => setRepoOwner(e.target.value)} placeholder="e.g. octocat" required />
                    </label>
                    <label>
                      Repo name
                      <input value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="e.g. Hello-World" required />
                    </label>
                    <label>
                      GitHub personal access token
                      <input type="password" value={githubPat} onChange={(e) => setGithubPat(e.target.value)} placeholder="ghp_..." required />
                    </label>
                    <button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Connecting..." : "Connect repository"}
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {isLoading && <SkeletonRows variant="project" />}

          {!hasNoProjects && (
            <ul className="project-list">
              {sortedProjects?.map((project, index) => (
                <TiltCard
                  as="li"
                  key={project.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: index * 0.04 }}
                >
                  <Link to={`/projects/${project.id}`}>
                    <span
                      className="repo-avatar"
                      style={{ background: avatarColor(project.repo_owner) }}
                    >
                      {avatarInitials(project.repo_owner)}
                    </span>
                    <span className="project-list-name">
                      {project.repo_owner}/{project.repo_name}
                    </span>
                    <span className="project-list-chevron">
                      <ChevronRightIcon />
                    </span>
                  </Link>
                  <ConfirmDeleteButton
                    label="Disconnect"
                    confirmLabel="Disconnect"
                    onConfirm={() => deleteProjectMutation.mutate(project.id)}
                    disabled={deleteProjectMutation.isPending}
                  />
                </TiltCard>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </motion.div>
  );
}
