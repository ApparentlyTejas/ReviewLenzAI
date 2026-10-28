import json
from unittest.mock import MagicMock, patch

import groq
import httpx
import pytest

from app.services.llm_service import MAX_DIFF_CHARS, LLMReviewError, truncate_diff, review_diff


def _mock_groq_response(arguments_dict):
    tool_call = MagicMock()
    tool_call.function.arguments = json.dumps(arguments_dict)
    response = MagicMock()
    response.choices[0].message.tool_calls = [tool_call]
    return response


@patch("app.services.llm_service.groq.Groq")
def test_review_diff_parses_valid_tool_call(mock_groq_cls):
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_groq_response(
        {
            "findings": [
                {
                    "category": "bug",
                    "severity": "high",
                    "file_path": "app.py",
                    "line_number": 10,
                    "message": "Something is wrong",
                    "suggested_fix": "Fix it like this",
                }
            ]
        }
    )
    mock_groq_cls.return_value = mock_client

    findings, snapshot = review_diff("diff --git a/app.py b/app.py\n+bug")

    assert len(findings.findings) == 1
    assert findings.findings[0].category == "bug"
    assert findings.findings[0].file_path == "app.py"
    assert snapshot.startswith("diff --git")


@patch("app.services.llm_service.groq.Groq")
def test_review_diff_empty_findings_is_valid(mock_groq_cls):
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_groq_response({"findings": []})
    mock_groq_cls.return_value = mock_client

    findings, _ = review_diff("diff --git a/app.py b/app.py\n+clean change")

    assert findings.findings == []


@patch("app.services.llm_service.groq.Groq")
def test_review_diff_no_tool_call_raises_llm_error(mock_groq_cls):
    mock_client = MagicMock()
    response = MagicMock()
    response.choices[0].message.tool_calls = []
    mock_client.chat.completions.create.return_value = response
    mock_groq_cls.return_value = mock_client

    with pytest.raises(LLMReviewError):
        review_diff("diff --git a/app.py b/app.py\n+bug")


@patch("app.services.llm_service.groq.Groq")
def test_review_diff_malformed_json_raises_llm_error(mock_groq_cls):
    mock_client = MagicMock()
    tool_call = MagicMock()
    tool_call.function.arguments = "not valid json"
    response = MagicMock()
    response.choices[0].message.tool_calls = [tool_call]
    mock_client.chat.completions.create.return_value = response
    mock_groq_cls.return_value = mock_client

    with pytest.raises(LLMReviewError):
        review_diff("diff --git a/app.py b/app.py\n+bug")


@patch("app.services.llm_service.groq.Groq")
def test_review_diff_schema_violation_raises_llm_error(mock_groq_cls):
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_groq_response(
        {"findings": [{"category": "not-a-real-category", "severity": "high", "file_path": "x", "message": "m"}]}
    )
    mock_groq_cls.return_value = mock_client

    with pytest.raises(LLMReviewError):
        review_diff("diff --git a/app.py b/app.py\n+bug")


@patch("app.services.llm_service.groq.Groq")
def test_review_diff_retries_once_on_connection_error(mock_groq_cls):
    mock_client = MagicMock()
    connection_error = groq.APIConnectionError(request=httpx.Request("POST", "https://api.groq.com"))
    mock_client.chat.completions.create.side_effect = [connection_error, _mock_groq_response({"findings": []})]
    mock_groq_cls.return_value = mock_client

    findings, _ = review_diff("diff --git a/app.py b/app.py\n+bug")

    assert findings.findings == []
    assert mock_client.chat.completions.create.call_count == 2


def testtruncate_diff_under_limit_returned_unchanged():
    diff = "diff --git a/app.py b/app.py\n+small change"
    assert truncate_diff(diff) == diff


def testtruncate_diff_over_limit_is_shortened_and_marked():
    oversized_diff = "diff --git " + ("a/file b/file\n" + ("x" * 200) + "\n") * 1000
    truncated = truncate_diff(oversized_diff)

    assert len(truncated) < len(oversized_diff)
    assert truncated.endswith("[diff truncated for length]")
    assert len(truncated) <= MAX_DIFF_CHARS + len("\n\n[diff truncated for length]")
