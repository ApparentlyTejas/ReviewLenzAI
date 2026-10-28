import type { FindingsTrendPoint } from "../types";

const WIDTH = 600;
const HEIGHT = 120;
const PADDING = 6;

function buildPath(points: FindingsTrendPoint[], max: number): { line: string; area: string } {
  const stepX = (WIDTH - PADDING * 2) / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => {
    const x = PADDING + i * stepX;
    const y = max === 0 ? HEIGHT - PADDING : HEIGHT - PADDING - (p.finding_count / max) * (HEIGHT - PADDING * 2);
    return [x, y] as const;
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${HEIGHT - PADDING} L${coords[0][0].toFixed(1)},${HEIGHT - PADDING} Z`;

  return { line, area };
}

/** A 30-day findings sparkline for the dashboard — no charting library, since a
 * single smooth area path is all this needs and it keeps the bundle free of one. */
export function FindingsTrendChart({ points }: { points: FindingsTrendPoint[] }) {
  const max = Math.max(...points.map((p) => p.finding_count), 1);
  const { line, area } = buildPath(points, max);
  const totalFindings = points.reduce((sum, p) => sum + p.finding_count, 0);
  const totalReviews = points.reduce((sum, p) => sum + p.review_count, 0);

  if (totalReviews === 0) {
    return null;
  }

  return (
    <div className="trend-chart">
      <div className="trend-chart-header">
        <h3>Findings, last 30 days</h3>
        <span className="trend-chart-total">{totalFindings} total</span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="trend-chart-svg">
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trend-fill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="trend-chart-labels">
        <span>{formatDate(points[0].date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function formatDate(isoDate: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
