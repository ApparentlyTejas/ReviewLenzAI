export type DiffLineType = "add" | "del" | "context" | "hunk";

export interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface DiffFile {
  oldPath: string | null;
  newPath: string | null;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
  lines: DiffLine[];
}

const FILE_HEADER = /^diff --git a\/(.+) b\/(.+)$/;
const OLD_PATH = /^--- (?:a\/(.+)|\/dev\/null)$/;
const NEW_PATH = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/** Parses a standard unified diff (GitHub's `.diff` format) into per-file hunks
 * with running old/new line numbers, so each rendered line can be matched back
 * to a finding by file path + line number. Deliberately hand-rolled rather than
 * pulling in a diff library — GitHub's own format is simple enough, and this
 * keeps the bundle free of a dependency just for ~70 lines of parsing. */
export function parseUnifiedDiff(diffText: string): DiffFile[] {
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of diffText.split("\n")) {
    const fileMatch = FILE_HEADER.exec(line);
    if (fileMatch) {
      current = {
        oldPath: fileMatch[1],
        newPath: fileMatch[2],
        isNew: false,
        isDeleted: false,
        isRenamed: fileMatch[1] !== fileMatch[2],
        lines: [],
      };
      files.push(current);
      continue;
    }
    if (!current) continue;

    if (line.startsWith("new file mode")) {
      current.isNew = true;
      continue;
    }
    if (line.startsWith("deleted file mode")) {
      current.isDeleted = true;
      continue;
    }

    const oldPathMatch = OLD_PATH.exec(line);
    if (oldPathMatch) {
      current.oldPath = oldPathMatch[1] ?? null;
      continue;
    }
    const newPathMatch = NEW_PATH.exec(line);
    if (newPathMatch) {
      current.newPath = newPathMatch[1] ?? null;
      continue;
    }

    const hunkMatch = HUNK_HEADER.exec(line);
    if (hunkMatch) {
      oldLineNum = Number(hunkMatch[1]);
      newLineNum = Number(hunkMatch[3]);
      current.lines.push({ type: "hunk", content: line, oldLine: null, newLine: null });
      continue;
    }

    if (line.startsWith("\\")) continue; // "\ No newline at end of file"

    if (line.startsWith("+")) {
      current.lines.push({ type: "add", content: line.slice(1), oldLine: null, newLine: newLineNum++ });
    } else if (line.startsWith("-")) {
      current.lines.push({ type: "del", content: line.slice(1), oldLine: oldLineNum++, newLine: null });
    } else if (line.startsWith(" ")) {
      current.lines.push({ type: "context", content: line.slice(1), oldLine: oldLineNum++, newLine: newLineNum++ });
    }
    // Any other line is metadata (e.g. "index ab12..cd34 100644") or, for the
    // last line of the diff text, the empty string split() leaves after a
    // trailing newline — both correctly ignored.
  }

  return files;
}
