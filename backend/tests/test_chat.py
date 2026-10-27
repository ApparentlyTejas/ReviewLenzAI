from unittest.mock import patch

from app.schemas.review import ReviewFindings
from app.services.llm_service import LLMReviewError
from tests.conftest import register_and_login as _register_and_login
from tests.test_reviews import _create_project, _fake_pr

_REVIEWS_PATCH_TARGET = "app.routers.reviews"
_CHAT_PATCH_TARGET = "app.routers.chat"


def _create_completed_review(client, headers, project_id, findings=None):
    with (
        patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request") as mock_get_pr,
        patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request_diff") as mock_get_diff,
        patch(f"{_REVIEWS_PATCH_TARGET}.review_diff") as mock_review_diff,
        patch(f"{_REVIEWS_PATCH_TARGET}.send_review_ready_email"),
    ):
        mock_get_pr.return_value = _fake_pr()
        mock_get_diff.return_value = "diff --git a/app.py b/app.py\n+bug"
        mock_review_diff.return_value = (
            ReviewFindings.model_validate({"findings": findings or []}),
            "diff --git a/app.py b/app.py\n+bug",
        )
        resp = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 7}, headers=headers)
    return resp.json()["id"]


@patch(f"{_CHAT_PATCH_TARGET}.answer_chat_question")
def test_send_chat_message_persists_both_turns_and_returns_assistant_reply(mock_answer, client):
    headers = _register_and_login(client, "chat1@example.com")
    project_id = _create_project(client, headers)
    review_id = _create_completed_review(client, headers, project_id)

    mock_answer.return_value = "The diff looks fine overall."

    response = client.post(
        f"/projects/{project_id}/reviews/{review_id}/chat",
        json={"content": "Is this diff safe to merge?"},
        headers=headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["role"] == "assistant"
    assert body["content"] == "The diff looks fine overall."

    history = client.get(f"/projects/{project_id}/reviews/{review_id}/chat", headers=headers).json()
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[0]["content"] == "Is this diff safe to merge?"
    assert history[1]["role"] == "assistant"


@patch(f"{_CHAT_PATCH_TARGET}.answer_chat_question")
def test_send_chat_message_passes_prior_history_to_llm(mock_answer, client):
    headers = _register_and_login(client, "chat2@example.com")
    project_id = _create_project(client, headers)
    review_id = _create_completed_review(client, headers, project_id)

    mock_answer.return_value = "First answer"
    client.post(
        f"/projects/{project_id}/reviews/{review_id}/chat",
        json={"content": "First question"},
        headers=headers,
    )

    mock_answer.return_value = "Second answer"
    client.post(
        f"/projects/{project_id}/reviews/{review_id}/chat",
        json={"content": "Second question"},
        headers=headers,
    )

    second_call_kwargs = mock_answer.call_args.kwargs
    assert second_call_kwargs["question"] == "Second question"
    assert second_call_kwargs["history"] == [
        {"role": "user", "content": "First question"},
        {"role": "assistant", "content": "First answer"},
    ]


@patch(f"{_CHAT_PATCH_TARGET}.answer_chat_question")
def test_send_chat_message_llm_failure_does_not_persist_user_message(mock_answer, client):
    headers = _register_and_login(client, "chat3@example.com")
    project_id = _create_project(client, headers)
    review_id = _create_completed_review(client, headers, project_id)

    mock_answer.side_effect = LLMReviewError("Groq API call failed: boom")

    response = client.post(
        f"/projects/{project_id}/reviews/{review_id}/chat",
        json={"content": "Will this fail?"},
        headers=headers,
    )

    assert response.status_code == 502

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
