import json
from collections.abc import Generator
from typing import Any

import groq

from app.core.config import settings
from app.schemas.review import ReviewFindings

MODEL_NAME = "llama-3.3-70b-versatile"
# Plain-text follow-up chat doesn't need review_diff()'s strict tool-call schema, so it
# isn't tied to MODEL_NAME: llama-3.3-70b-versatile has been removed from Groq entirely
# (confirmed via a live API call — review_diff() is currently broken against the real
# API, a pre-existing issue, not something introduced here). openai/gpt-oss-120b answers
# plain prompts fine but doesn't reliably follow review_diff()'s exact JSON schema for
# tool calls, so it's used here only, not as a MODEL_NAME replacement.
CHAT_MODEL_NAME = "openai/gpt-oss-120b"
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


CHAT_SYSTEM_PROMPT_TEMPLATE = """You are a senior code reviewer answering follow-up questions about a \
specific pull request you already reviewed. Answer ONLY using the diff and findings below — if the \
question asks about something not shown in them, say so instead of guessing.

PR: {pr_title} (#{pr_number})

Diff reviewed:
{diff_snapshot}

Findings already reported:
{findings_text}

Keep answers concise and concrete. Reference file paths and line numbers from the diff/findings when \
relevant."""

MAX_CHAT_HISTORY_MESSAGES = 20


def _format_findings_for_chat(findings: list[dict[str, Any]]) -> str:
    if not findings:
        return "(none — the diff was clean)"
    lines = []
    for f in findings:
        location = f["file_path"] + (f":{f['line_number']}" if f.get("line_number") else "")
        lines.append(f"- [{f['severity']}/{f['category']}] {location}: {f['message']}")
    return "\n".join(lines)


def stream_chat_answer(
    *,
    pr_title: str,
    pr_number: int,
    diff_snapshot: str,
    findings: list[dict[str, Any]],
    history: list[dict[str, str]],
    question: str,
) -> Generator[str, None, None]:
    """Answer a follow-up question about a review, grounded in its diff and findings,
    yielding the answer as text deltas as they arrive from the model.

    `history` is prior chat turns as [{"role": "user"|"assistant", "content": ...}], oldest first.
    """
    client = groq.Groq(api_key=settings.groq_api_key)

    system_prompt = CHAT_SYSTEM_PROMPT_TEMPLATE.format(
        pr_title=pr_title,
        pr_number=pr_number,
        diff_snapshot=_truncate_diff(diff_snapshot),
        findings_text=_format_findings_for_chat(findings),
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history[-MAX_CHAT_HISTORY_MESSAGES:])
    messages.append({"role": "user", "content": question})

    request_kwargs: dict[str, Any] = dict(
        model=CHAT_MODEL_NAME,
        max_tokens=1024,
        temperature=0.2,
        messages=messages,
        stream=True,
    )

    try:
        stream = client.chat.completions.create(**request_kwargs)
    except (groq.RateLimitError, groq.APIConnectionError):
        try:
            stream = client.chat.completions.create(**request_kwargs)
        except groq.APIError as exc:
            raise LLMReviewError(f"Groq API call failed after retry: {exc}") from exc
    except groq.APIError as exc:
        raise LLMReviewError(f"Groq API call failed: {exc}") from exc

    got_any_content = False
    try:
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                got_any_content = True
                yield delta
    except groq.APIError as exc:
        raise LLMReviewError(f"Groq streaming failed: {exc}") from exc

    if not got_any_content:
        raise LLMReviewError("Groq response did not include any content")
