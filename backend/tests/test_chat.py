import json
from unittest.mock import patch

from app.schemas.review import ReviewFindings
from app.services.llm_service import LLMReviewError
from tests.conftest import register_and_login as _register_and_login
from tests.test_reviews import _create_project, _fake_pr

_REVIEWS_PATCH_TARGET = "app.routers.reviews"
_RUNNER_PATCH_TARGET = "app.services.review_runner"
_CHAT_PATCH_TARGET = "app.routers.chat"


def _create_completed_review(client, headers, project_id, findings=None):
    with (
        patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request") as mock_get_pr,
        patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request_diff") as mock_get_diff,
        patch(f"{_RUNNER_PATCH_TARGET}.review_diff") as mock_review_diff,
        patch(f"{_RUNNER_PATCH_TARGET}.send_review_ready_email"),
    ):
        mock_get_pr.return_value = _fake_pr()
        mock_get_diff.return_value = "diff --git a/app.py b/app.py\n+bug"
        mock_review_diff.return_value = (
            ReviewFindings.model_validate({"findings": findings or []}),
            "diff --git a/app.py b/app.py\n+bug",
        )
        resp = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 7}, headers=headers)
    return resp.json()["id"]


def _sse_events(response_text: str) -> list[dict]:
    events = []
    for frame in response_text.split("\n\n"):
        frame = frame.strip()
        if not frame:
            continue
        assert frame.startswith("data: ")
        events.append(json.loads(frame[len("data: ") :]))
    return events


def _fake_stream(*chunks: str):
    def _generator(**kwargs):
        yield from chunks

    return _generator


@patch(f"{_CHAT_PATCH_TARGET}.stream_chat_answer")
def test_send_chat_message_streams_deltas_then_persists_both_turns(mock_stream, client):
    headers = _register_and_login(client, "chat1@example.com")
    project_id = _create_project(client, headers)
    review_id = _create_completed_review(client, headers, project_id)

    mock_stream.side_effect = _fake_stream("The diff ", "looks fine ", "overall.")

    response = client.post(
        f"/projects/{project_id}/reviews/{review_id}/chat",
        json={"content": "Is this diff safe to merge?"},
        headers=headers,
    )

    assert response.status_code == 200
    events = _sse_events(response.text)
    deltas = [e["content"] for e in events if e["type"] == "delta"]
    assert deltas == ["The diff ", "looks fine ", "overall."]

    done_events = [e for e in events if e["type"] == "done"]
    assert len(done_events) == 1
    assert done_events[0]["message"]["role"] == "assistant"
    assert done_events[0]["message"]["content"] == "The diff looks fine overall."

    history = client.get(f"/projects/{project_id}/reviews/{review_id}/chat", headers=headers).json()
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[0]["content"] == "Is this diff safe to merge?"
    assert history[1]["role"] == "assistant"
    assert history[1]["content"] == "The diff looks fine overall."


@patch(f"{_CHAT_PATCH_TARGET}.stream_chat_answer")
def test_send_chat_message_passes_prior_history_to_llm(mock_stream, client):
    headers = _register_and_login(client, "chat2@example.com")
    project_id = _create_project(client, headers)
    review_id = _create_completed_review(client, headers, project_id)

    mock_stream.side_effect = _fake_stream("First answer")
    client.post(
        f"/projects/{project_id}/reviews/{review_id}/chat",
        json={"content": "First question"},
        headers=headers,
    )

    mock_stream.side_effect = _fake_stream("Second answer")
    client.post(
        f"/projects/{project_id}/reviews/{review_id}/chat",
        json={"content": "Second question"},
        headers=headers,
    )

    second_call_kwargs = mock_stream.call_args.kwargs
    assert second_call_kwargs["question"] == "Second question"
    assert second_call_kwargs["history"] == [
        {"role": "user", "content": "First question"},
        {"role": "assistant", "content": "First answer"},
    ]


@patch(f"{_CHAT_PATCH_TARGET}.stream_chat_answer")
def test_send_chat_message_llm_failure_does_not_persist_user_message(mock_stream, client):
    headers = _register_and_login(client, "chat3@example.com")
    project_id = _create_project(client, headers)
    review_id = _create_completed_review(client, headers, project_id)

    def _failing_generator(**kwargs):
        if False:
            yield ""
        raise LLMReviewError("Groq API call failed: boom")

    mock_stream.side_effect = _failing_generator

    response = client.post(
        f"/projects/{project_id}/reviews/{review_id}/chat",
        json={"content": "Will this fail?"},
        headers=headers,
    )

    assert response.status_code == 200
    events = _sse_events(response.text)
    assert events[-1]["type"] == "error"
    assert "boom" in events[-1]["detail"]

    history = client.get(f"/projects/{project_id}/reviews/{review_id}/chat", headers=headers).json()
    assert history == []


@patch(f"{_CHAT_PATCH_TARGET}.stream_chat_answer")
def test_send_chat_message_llm_failure_after_partial_content_keeps_deltas_but_not_message(mock_stream, client):
    headers = _register_and_login(client, "chat3b@example.com")
    project_id = _create_project(client, headers)
    review_id = _create_completed_review(client, headers, project_id)

    def _partial_then_failing_generator(**kwargs):
        yield "Partial answer "
        raise LLMReviewError("Groq streaming failed: connection dropped")

    mock_stream.side_effect = _partial_then_failing_generator

    response = client.post(
        f"/projects/{project_id}/reviews/{review_id}/chat",
        json={"content": "Will this fail partway?"},
        headers=headers,
    )

    events = _sse_events(response.text)
    assert [e["content"] for e in events if e["type"] == "delta"] == ["Partial answer "]
    assert events[-1]["type"] == "error"

    history = client.get(f"/projects/{project_id}/reviews/{review_id}/chat", headers=headers).json()
    assert history == []


@patch(f"{_CHAT_PATCH_TARGET}.is_on_topic", return_value=False)
@patch(f"{_CHAT_PATCH_TARGET}.stream_chat_answer")
def test_send_chat_message_off_topic_question_is_blocked_before_calling_the_model(mock_stream, mock_on_topic, client):
    headers = _register_and_login(client, "chat-offtopic@example.com")
    project_id = _create_project(client, headers)
    review_id = _create_completed_review(client, headers, project_id)

    response = client.post(
        f"/projects/{project_id}/reviews/{review_id}/chat",
        json={"content": "What's the capital of France?"},
        headers=headers,
    )

    assert response.status_code == 200
    events = _sse_events(response.text)
    assert len(events) == 1
    assert events[0]["type"] == "error"
    mock_stream.assert_not_called()

    history = client.get(f"/projects/{project_id}/reviews/{review_id}/chat", headers=headers).json()
    assert history == []


def test_send_chat_message_requires_auth(client):
    response = client.post("/projects/1/reviews/1/chat", json={"content": "hi"})
    assert response.status_code == 401


def test_send_chat_message_on_other_users_review_returns_404(client):
    headers_a = _register_and_login(client, "chatowner@example.com")
    headers_b = _register_and_login(client, "chatintruder@example.com")
    project_id = _create_project(client, headers_a)
    review_id = _create_completed_review(client, headers_a, project_id)

    response = client.post(
        f"/projects/{project_id}/reviews/{review_id}/chat",
        json={"content": "hi"},
        headers=headers_b,
    )

    assert response.status_code == 404


@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request")
def test_send_chat_message_on_pending_review_returns_400(mock_get_pr, client):
    from app.core.database import get_db
    from app.main import app
    from app.models.review import Review, ReviewStatus

    headers = _register_and_login(client, "chat4@example.com")
    project_id = _create_project(client, headers)

    db_gen = app.dependency_overrides[get_db]()
    db = next(db_gen)
    review = Review(
        project_id=project_id,
        pr_number=1,
        pr_title="WIP",
        pr_url="https://github.com/octocat/Hello-World/pull/1",
        diff_snapshot="",
        status=ReviewStatus.pending,
        model_used="llama-3.3-70b-versatile",
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    review_id = review.id
    db.close()

    response = client.post(
        f"/projects/{project_id}/reviews/{review_id}/chat",
        json={"content": "hi"},
        headers=headers,
    )

    assert response.status_code == 400


@patch(f"{_CHAT_PATCH_TARGET}.stream_chat_answer")
def test_clear_chat_messages_removes_all_history(mock_stream, client):
    headers = _register_and_login(client, "chat5@example.com")
    project_id = _create_project(client, headers)
    review_id = _create_completed_review(client, headers, project_id)

    mock_stream.side_effect = _fake_stream("An answer")
    client.post(
        f"/projects/{project_id}/reviews/{review_id}/chat",
        json={"content": "A question"},
        headers=headers,
    )
    assert len(client.get(f"/projects/{project_id}/reviews/{review_id}/chat", headers=headers).json()) == 2

    clear_resp = client.delete(f"/projects/{project_id}/reviews/{review_id}/chat", headers=headers)
    assert clear_resp.status_code == 204

    history = client.get(f"/projects/{project_id}/reviews/{review_id}/chat", headers=headers).json()
    assert history == []


def test_clear_chat_messages_requires_auth(client):
    response = client.delete("/projects/1/reviews/1/chat")
    assert response.status_code == 401


def test_clear_chat_messages_on_other_users_review_returns_404(client):
    headers_a = _register_and_login(client, "chatclear-owner@example.com")
    headers_b = _register_and_login(client, "chatclear-intruder@example.com")
    project_id = _create_project(client, headers_a)
    review_id = _create_completed_review(client, headers_a, project_id)

    response = client.delete(f"/projects/{project_id}/reviews/{review_id}/chat", headers=headers_b)

    assert response.status_code == 404
