import json
from typing import Any

import groq

from app.core.config import settings
from app.schemas.review import ReviewFindings

MODEL_NAME = "llama-3.3-70b-versatile"
MAX_DIFF_CHARS = 70_000

SYSTEM_PROMPT = """You are a thorough, senior code reviewer. You will be given a unified git diff from \
a pull request. Your job is to find ALL real issues in the changed code — do not skip obvious bugs.

Review every line of added code (+) carefully for:
- Logic errors: wrong operators, incorrect calculations, flipped conditions, off-by-one errors
- Missing return statements or functions that return the wrong value
- Type mismatches or unsafe implicit conversions
- Security issues: injection, hardcoded secrets, auth flaws, unsafe input handling
- Null/undefined dereferences, unhandled edge cases
- Dead code, unreachable branches, unused variables
- Style and naming consistency
- Missing error handling

Rules:
- Be thorough. If a bug is obvious, report it — do not skip it for being "minor".
- Only report issues present in the diff (lines starting with +). Ignore context lines.
- For each finding provide the file path, the nearest line number from the diff hunk, a clear \
  explanation of WHY it is wrong, and a concrete suggested fix.
- If the diff is genuinely clean with no issues, return an empty findings list.
- Call submit_findings exactly once with your complete results."""

_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "submit_findings",
            "description": "Submit the structured code review findings for the diff.",
            "parameters": ReviewFindings.model_json_schema(),
        },
    }
]


class LLMReviewError(Exception):
    """Raised when the LLM call fails or returns an unusable response."""


def _truncate_diff(diff_text: str) -> str:
    if len(diff_text) <= MAX_DIFF_CHARS:
        return diff_text

    chunks = diff_text.split("diff --git ")
    truncated = chunks[0]
    for chunk in chunks[1:]:
        candidate = truncated + "diff --git " + chunk
        if len(candidate) > MAX_DIFF_CHARS:
            break
        truncated = candidate
    return truncated.rstrip() + "\n\n[diff truncated for length]"


def review_diff(diff_text: str) -> tuple[ReviewFindings, str]:
    """Run the diff through Groq's LLM and return (parsed findings, diff snapshot actually sent)."""
    diff_snapshot = _truncate_diff(diff_text)
    client = groq.Groq(api_key=settings.groq_api_key)

    request_kwargs: dict[str, Any] = dict(
        model=MODEL_NAME,
        max_tokens=4096,
        temperature=0.1,
        tools=_TOOLS,
        tool_choice={"type": "function", "function": {"name": "submit_findings"}},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Review this diff thoroughly and report every issue you find:\n\n{diff_snapshot}"},
        ],
    )

    try:
        response = client.chat.completions.create(**request_kwargs)
    except (groq.RateLimitError, groq.APIConnectionError):
        try:
            response = client.chat.completions.create(**request_kwargs)
        except groq.APIError as exc:
            raise LLMReviewError(f"Groq API call failed after retry: {exc}") from exc
    except groq.APIError as exc:
        raise LLMReviewError(f"Groq API call failed: {exc}") from exc

    tool_calls = response.choices[0].message.tool_calls
    if not tool_calls:
        raise LLMReviewError("Groq response did not include a tool call")

    try:
        arguments = json.loads(tool_calls[0].function.arguments)
        findings = ReviewFindings.model_validate(arguments)
    except Exception as exc:
        raise LLMReviewError(f"Groq response failed schema validation: {exc}") from exc

    return findings, diff_snapshot
