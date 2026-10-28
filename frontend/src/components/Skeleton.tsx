type SkeletonVariant = "project" | "row" | "activity";

/** Loading placeholders shaped like the real list rows they stand in for, reusing
 * each list's own className so border/padding/spacing stay in sync with the
 * real content automatically — only the bar shimmer styling is skeleton-specific. */
export function SkeletonRows({ variant, count = 3 }: { variant: SkeletonVariant; count?: number }) {
  const rows = Array.from({ length: count });

  if (variant === "project") {
    return (
      <ul className="project-list" aria-hidden="true">
        {rows.map((_, i) => (
          <li key={i}>
            <div className="project-list-icon skeleton" />
            <span className="skeleton skeleton-bar" style={{ width: `${55 - i * 8}%`, height: 14 }} />
          </li>
        ))}
      </ul>
    );
  }

  if (variant === "activity") {
    return (
      <ul className="activity-list" aria-hidden="true">
        {rows.map((_, i) => (
          <li key={i} className="activity-item">
            <div className="activity-left">
              <span className="skeleton skeleton-bar" style={{ width: 160, height: 13 }} />
              <span className="skeleton skeleton-bar" style={{ width: 90, height: 11, marginTop: 6 }} />
            </div>
            <span className="skeleton skeleton-bar" style={{ width: 70, height: 20, borderRadius: 999 }} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="pull-request-list" aria-hidden="true">
      {rows.map((_, i) => (
        <li key={i}>
          <div>
            <span className="skeleton skeleton-bar" style={{ width: `${70 - i * 10}%`, height: 14 }} />
            <span className="skeleton skeleton-bar" style={{ width: 100, height: 11, marginTop: 8 }} />
          </div>
          <span className="skeleton skeleton-bar" style={{ width: 80, height: 28, borderRadius: 8 }} />
        </li>
      ))}
    </ul>
  );
}
