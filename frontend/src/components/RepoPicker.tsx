import { useState, useRef, useEffect } from "react";
import type { GitHubRepo } from "../api/github";

interface Props {
  repos: GitHubRepo[];
  value: string;
  onChange: (value: string) => void;
}

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

export function RepoPicker({ repos, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = repos.find(r => r.full_name === value);
  const filtered = repos.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 14px",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 14,
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
          {selected ? (
            <>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selected.full_name}
              </span>
              {selected.private && <LockIcon />}
            </>
          ) : (
            "Select a repository"
          )}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.4, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          right: 0,
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          zIndex: 50,
          overflow: "hidden",
        }}>
          <div style={{ padding: "8px 8px 4px" }}>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search repos…"
              style={{ width: "100%", fontSize: 13, padding: "7px 10px", margin: 0, boxSizing: "border-box" }}
            />
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "10px 14px", margin: 0 }}>No repos found</p>
              ) : (
                filtered.map(r => (
                  <button
                    key={r.full_name}
                    type="button"
                    onClick={() => { onChange(r.full_name); setOpen(false); setSearch(""); }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "9px 14px",
                      background: r.full_name === value ? "var(--bg-subtle)" : "transparent",
                      border: "none",
                      borderRadius: 0,
                      fontSize: 13,
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-subtle)")}
                    onMouseLeave={e => (e.currentTarget.style.background = r.full_name === value ? "var(--bg-subtle)" : "transparent")}
                  >
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.full_name}
                    </span>
                    {r.private && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                        <LockIcon /> private
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
            {filtered.length > 6 && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 20,
                  background: "linear-gradient(to bottom, transparent, var(--bg))",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
