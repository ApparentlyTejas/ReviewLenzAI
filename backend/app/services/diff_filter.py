import fnmatch
import re

_FILE_HEADER = re.compile(r"^diff --git a/(.+) b/(.+)$")


def parse_ignore_patterns(raw: str) -> list[str]:
    return [line.strip() for line in raw.splitlines() if line.strip()]


def filter_diff(diff_text: str, ignore_patterns: list[str]) -> str:
    """Strips whole-file blocks from a unified diff whose path matches any of the
    given glob patterns (e.g. "*.lock", "dist/*"), so ignored files never reach
    the LLM at all — cheaper and quieter than filtering findings after the fact."""
    if not ignore_patterns:
        return diff_text

    blocks = diff_text.split("diff --git ")
    kept = [blocks[0]] if blocks[0] else []

    for block in blocks[1:]:
        header_line = block.split("\n", 1)[0]
        match = _FILE_HEADER.match("diff --git " + header_line)
        path = match.group(2) if match else None
        if path and any(fnmatch.fnmatch(path, pattern) for pattern in ignore_patterns):
            continue
        kept.append("diff --git " + block)

    return "".join(kept)
