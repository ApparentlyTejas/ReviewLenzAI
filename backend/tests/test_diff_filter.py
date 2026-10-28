from app.services.diff_filter import filter_diff, parse_ignore_patterns

DIFF = """diff --git a/app.py b/app.py
index 1..2 100644
--- a/app.py
+++ b/app.py
@@ -1 +1 @@
-old
+new
diff --git a/package-lock.json b/package-lock.json
index 1..2 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1 +1 @@
-old
+new
"""


def test_parse_ignore_patterns_strips_blank_lines_and_whitespace():
    assert parse_ignore_patterns("*.lock\n\n  dist/*  \n") == ["*.lock", "dist/*"]


def test_filter_diff_with_no_patterns_returns_diff_unchanged():
    assert filter_diff(DIFF, []) == DIFF


def test_filter_diff_strips_matching_file_block():
    filtered = filter_diff(DIFF, ["package-lock.json"])
    assert "app.py" in filtered
    assert "package-lock.json" not in filtered


def test_filter_diff_supports_glob_patterns():
    filtered = filter_diff(DIFF, ["*.json"])
    assert "app.py" in filtered
    assert "package-lock.json" not in filtered


def test_filter_diff_keeps_everything_when_pattern_does_not_match():
    filtered = filter_diff(DIFF, ["*.txt"])
    assert filtered == DIFF
