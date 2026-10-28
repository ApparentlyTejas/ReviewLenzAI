import { useMemo, useState } from "react";
import { parseUnifiedDiff, type DiffFile, type DiffLine } from "../lib/diffParser";
import type { Finding } from "../types";
import { ChevronRightIcon } from "./Icons";

interface DiffViewerProps {
  diffText: string;
  findings: Finding[];
  onAskAboutFinding?: (finding: Finding) => void;
  newFindingIds?: Set<number>;
}

/** Renders the review's exact diff (what the LLM actually saw — see the
 * diff_snapshot comment in the backend schema) with findings annotated inline
 * at the line they reference, instead of findings being a disconnected list
 * that only names a file/line number. */
export function DiffViewer({ diffText, findings, onAskAboutFinding, newFindingIds }: DiffViewerProps) {
  const files = useMemo(() => parseUnifiedDiff(diffText), [diffText]);

  const findingsByFile = useMemo(() => {
    const map = new Map<string, Finding[]>();
    for (const f of findings) {
      const existing = map.get(f.file_path);
      if (existing) existing.push(f);
      else map.set(f.file_path, [f]);
    }
    return map;
  }, [findings]);

  if (files.length === 0) {
    return <p className="diff-empty">No diff available for this review.</p>;
  }

  return (
    <div className="diff-viewer">
      {files.map((file, index) => {
        const path = file.newPath ?? file.oldPath ?? "unknown file";
        return (
          <DiffFileBlock
            key={`${path}-${index}`}
            file={file}
            path={path}
            fileFindings={findingsByFile.get(path) ?? []}
            onAskAboutFinding={onAskAboutFinding}
            newFindingIds={newFindingIds}
          />
        );
      })}
    </div>
  );
}

function DiffFileBlock({
  file,
  path,
  fileFindings,
  onAskAboutFinding,
  newFindingIds,
}: {
  file: DiffFile;
  path: string;
  fileFindings: Finding[];
  onAskAboutFinding?: (finding: Finding) => void;
  newFindingIds?: Set<number>;
}) {
  const [open, setOpen] = useState(true);
  const added = file.lines.filter((l) => l.type === "add").length;
  const removed = file.lines.filter((l) => l.type === "del").length;
  const findingsByLineIndex = useMemo(
    () => attachFindingsToLines(file.lines, fileFindings),
    [file.lines, fileFindings]
  );

  return (
    <div className="diff-file">
      <button type="button" className="diff-file-header" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ChevronRightIcon size={14} />
        <span className="diff-file-path">
          {file.isRenamed ? `${file.oldPath} → ${file.newPath}` : path}
          {file.isNew && <span className="diff-file-tag">new</span>}
          {file.isDeleted && <span className="diff-file-tag">deleted</span>}
        </span>
        <span className="diff-file-stats">
          {added > 0 && <span className="diff-stat-add">+{added}</span>}
          {removed > 0 && <span className="diff-stat-del">-{removed}</span>}
          {fileFindings.length > 0 && (
            <span className="diff-stat-findings">
              {fileFindings.length} finding{fileFindings.length === 1 ? "" : "s"}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="diff-lines">
          {file.lines.map((line, index) => (
            <DiffLineRow
              key={index}
              line={line}
              findings={findingsByLineIndex.get(index) ?? []}
              onAskAboutFinding={onAskAboutFinding}
              newFindingIds={newFindingIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Attaches each finding to exactly one line, instead of matching every line
 * whose old/new number happens to equal it — a deleted line's old number and
 * a nearby added line's new number can coincide (e.g. both "12"), which would
 * otherwise render the same finding twice. New/context lines (what the diff
 * actually left behind) are matched first; a line number only wins a match
 * against a deleted line when nothing in the new file claims it. */
function attachFindingsToLines(lines: DiffLine[], fileFindings: Finding[]): Map<number, Finding[]> {
  const byIndex = new Map<number, Finding[]>();
  const placed = new Set<number>();

  lines.forEach((line, index) => {
    if (line.newLine == null) return;
    for (const finding of fileFindings) {
      if (placed.has(finding.id) || finding.line_number !== line.newLine) continue;
      byIndex.set(index, [...(byIndex.get(index) ?? []), finding]);
      placed.add(finding.id);
    }
  });

  lines.forEach((line, index) => {
    if (line.type !== "del" || line.oldLine == null) return;
    for (const finding of fileFindings) {
      if (placed.has(finding.id) || finding.line_number !== line.oldLine) continue;
      byIndex.set(index, [...(byIndex.get(index) ?? []), finding]);
      placed.add(finding.id);
    }
  });

  return byIndex;
}

const SEVERITY_LABEL: Record<Finding["severity"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

function DiffLineRow({
  line,
  findings,
  onAskAboutFinding,
  newFindingIds,
}: {
  line: DiffLine;
  findings: Finding[];
  onAskAboutFinding?: (finding: Finding) => void;
  newFindingIds?: Set<number>;
}) {
  if (line.type === "hunk") {
    return <div className="diff-hunk-header">{line.content}</div>;
  }

  return (
    <>
      <div className={`diff-line diff-line-${line.type}`}>
        <span className="diff-line-num">{line.oldLine ?? ""}</span>
        <span className="diff-line-num">{line.newLine ?? ""}</span>
        <span className="diff-line-marker">{line.type === "add" ? "+" : line.type === "del" ? "-" : ""}</span>
        <code className="diff-line-content">{line.content}</code>
      </div>
      {findings.map((finding) => (
        <div key={finding.id} className={`diff-finding diff-finding-${finding.severity}`}>
          <div className="diff-finding-head">
            <span className={`badge severity-${finding.severity}`}>{SEVERITY_LABEL[finding.severity]}</span>
            <span className="diff-finding-category">{finding.category}</span>
            {newFindingIds?.has(finding.id) && <span className="badge badge-new">New</span>}
          </div>
          <p>{finding.message}</p>
          {finding.suggested_fix && (
            <details>
              <summary>Suggested fix</summary>
              <pre>{finding.suggested_fix}</pre>
            </details>
          )}
          {onAskAboutFinding && (
            <button type="button" className="secondary small finding-ask-button" onClick={() => onAskAboutFinding(finding)}>
              Ask about this
            </button>
          )}
        </div>
      ))}
    </>
  );
}
