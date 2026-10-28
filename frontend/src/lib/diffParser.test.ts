import { describe, expect, it } from "vitest";
import { parseUnifiedDiff } from "./diffParser";

const MODIFIED_FILE_DIFF = `diff --git a/app.py b/app.py
index ab12cd3..ef45gh6 100644
--- a/app.py
+++ b/app.py
@@ -10,6 +10,7 @@ def handler(request):
     user = get_user(request)
     query = request.args.get("q")
-    result = db.execute(f"SELECT * FROM t WHERE q = '{query}'")
+    result = db.execute("SELECT * FROM t WHERE q = :q", {"q": query})
+    log.info("query executed")
     return result
`;

const NEW_FILE_DIFF = `diff --git a/new_module.py b/new_module.py
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/new_module.py
@@ -0,0 +1,2 @@
+def hello():
+    return "hi"
`;

const DELETED_FILE_DIFF = `diff --git a/old.py b/old.py
deleted file mode 100644
index 1234567..0000000
--- a/old.py
+++ /dev/null
@@ -1,2 +0,0 @@
-def bye():
-    return "bye"
`;

describe("parseUnifiedDiff", () => {
  it("parses a modified file's hunk with correct old/new line numbers", () => {
    const [file] = parseUnifiedDiff(MODIFIED_FILE_DIFF);

    expect(file.oldPath).toBe("app.py");
    expect(file.newPath).toBe("app.py");
    expect(file.isNew).toBe(false);
    expect(file.isDeleted).toBe(false);

    const contentLines = file.lines.filter((l) => l.type !== "hunk");
    expect(contentLines).toEqual([
      { type: "context", content: "    user = get_user(request)", oldLine: 10, newLine: 10 },
      { type: "context", content: '    query = request.args.get("q")', oldLine: 11, newLine: 11 },
      {
        type: "del",
        content: '    result = db.execute(f"SELECT * FROM t WHERE q = \'{query}\'")',
        oldLine: 12,
        newLine: null,
      },
      {
        type: "add",
        content: '    result = db.execute("SELECT * FROM t WHERE q = :q", {"q": query})',
        oldLine: null,
        newLine: 12,
      },
      { type: "add", content: '    log.info("query executed")', oldLine: null, newLine: 13 },
      { type: "context", content: "    return result", oldLine: 13, newLine: 14 },
    ]);
  });

  it("marks a new file and treats /dev/null as no old path", () => {
    const [file] = parseUnifiedDiff(NEW_FILE_DIFF);

    expect(file.isNew).toBe(true);
    expect(file.oldPath).toBeNull();
    expect(file.newPath).toBe("new_module.py");
    expect(file.lines.filter((l) => l.type === "add")).toHaveLength(2);
  });

  it("marks a deleted file and treats /dev/null as no new path", () => {
    const [file] = parseUnifiedDiff(DELETED_FILE_DIFF);

    expect(file.isDeleted).toBe(true);
    expect(file.oldPath).toBe("old.py");
    expect(file.newPath).toBeNull();
    expect(file.lines.filter((l) => l.type === "del")).toHaveLength(2);
  });

  it("parses multiple files from one diff", () => {
    const files = parseUnifiedDiff(MODIFIED_FILE_DIFF + NEW_FILE_DIFF);
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.newPath)).toEqual(["app.py", "new_module.py"]);
  });

  it("returns an empty array for an empty diff", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
  });
});
