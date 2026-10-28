import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getDashboardSummary } from "../api/dashboard";
import { listProjects } from "../api/projects";
import { useTheme } from "../theme/ThemeContext";
import {
  HelpIcon,
  LogOutIcon,
  MoonIcon,
  RepoIcon,
  ReviewCheckIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  TrashIcon,
} from "./Icons";

interface Command {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reuses whatever's already cached from the dashboard/sidebar — no dedicated
  // search endpoint yet, so this covers your projects and 5 most recent reviews,
  // not every review ever run.
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects, enabled: open && !!user });
  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
    enabled: open && !!user,
  });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    // The navbar's visible search button can't reach this component's state
    // directly without lifting it through a provider — a custom event is the
    // lighter-weight option for a single one-off "open me" trigger.
    function handleOpenEvent() {
      setOpen(true);
    }
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleOpenEvent);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  function close() {
    setOpen(false);
  }

  function go(path: string) {
    return () => {
      navigate(path);
      close();
    };
  }

  const commands = useMemo<Command[]>(() => {
    const items: Command[] = [
      { id: "nav-dashboard", group: "Go to", label: "Dashboard", icon: <RepoIcon size={15} />, run: go("/projects") },
      { id: "nav-settings", group: "Go to", label: "Settings", icon: <SettingsIcon size={15} />, run: go("/settings") },
      {
        id: "nav-deleted",
        group: "Go to",
        label: "Recently deleted",
        icon: <TrashIcon size={15} />,
        run: go("/settings/recently-deleted"),
      },
      { id: "nav-help", group: "Go to", label: "Help", icon: <HelpIcon size={15} />, run: go("/help") },
      {
        id: "action-theme",
        group: "Actions",
        label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        icon: theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />,
        run: () => {
          toggleTheme();
          close();
        },
      },
      {
        id: "action-logout",
        group: "Actions",
        label: "Log out",
        icon: <LogOutIcon size={15} />,
        run: () => {
          logout();
          close();
        },
      },
    ];

    for (const project of projects ?? []) {
      items.push({
        id: `project-${project.id}`,
        group: "Projects",
        label: `${project.repo_owner}/${project.repo_name}`,
        icon: <RepoIcon size={15} />,
        run: go(`/projects/${project.id}`),
      });
    }

    for (const review of summary?.recent_reviews ?? []) {
      items.push({
        id: `review-${review.id}`,
        group: "Recent reviews",
        label: `#${review.pr_number} ${review.pr_title}`,
        sub: `${review.repo_owner}/${review.repo_name}`,
        icon: <ReviewCheckIcon size={15} />,
        run: go(`/projects/${review.project_id}/reviews/${review.id}`),
      });
    }

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, summary, theme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.sub?.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[activeIndex]?.run();
    }
  }

  if (!open || !user) return null;

  let lastGroup = "";

  return (
    <div className="cmdk-backdrop" onClick={close}>
      <div className="cmdk-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-search">
          <SearchIcon size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, reviews, settings..."
          />
          <kbd>esc</kbd>
        </div>
        <div className="cmdk-list" role="listbox">
          {filtered.length === 0 && <p className="cmdk-empty">No matches.</p>}
          {filtered.map((cmd, index) => {
            const showGroup = cmd.group !== lastGroup;
            lastGroup = cmd.group;
            return (
              <div key={cmd.id}>
                {showGroup && <div className="cmdk-group-label">{cmd.group}</div>}
                <button
                  type="button"
                  className={`cmdk-item${index === activeIndex ? " active" : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={cmd.run}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  {cmd.icon}
                  <span className="cmdk-item-label">{cmd.label}</span>
                  {cmd.sub && <span className="cmdk-item-sub">{cmd.sub}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
