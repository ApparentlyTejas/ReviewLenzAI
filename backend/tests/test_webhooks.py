import hashlib
import hmac
import json
from unittest.mock import patch

from app.schemas.review import ReviewFindings
from tests.conftest import register_and_login as _register_and_login

_RUNNER_PATCH_TARGET = "app.services.review_runner"


def _create_project_with_webhook(client, headers, owner="octocat", name="Hello-World"):
    with patch("app.routers.projects.github_service.validate_repo_access"):
        resp = client.post(
            "/projects",
            json={"repo_owner": owner, "repo_name": name, "github_pat": "ghp_fake"},
            headers=headers,
        )
    project_id = resp.json()["id"]
    webhook_resp = client.post(f"/projects/{project_id}/webhook", headers=headers)
    return project_id, webhook_resp.json()["secret"]


def _signed_post(client, project_id, secret, payload, event="pull_request"):
    body = json.dumps(payload).encode()
    signature = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return client.post(
        f"/webhooks/github/{project_id}",
        content=body,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": signature, "X-GitHub-Event": event},
    )


_OPENED_PAYLOAD = {"action": "opened", "pull_request": {"number": 7}}


@patch(f"{_RUNNER_PATCH_TARGET}.send_review_ready_email")
@patch(f"{_RUNNER_PATCH_TARGET}.review_diff")
@patch(f"{_RUNNER_PATCH_TARGET}.github_service.get_pull_request_diff")
@patch(f"{_RUNNER_PATCH_TARGET}.github_service.get_pull_request")
def test_webhook_opened_action_triggers_review(mock_get_pr, mock_get_diff, mock_review_diff, mock_send_email, client):
    headers = _register_and_login(client, "webhook-trigger@example.com")
    project_id, secret = _create_project_with_webhook(client, headers)

    mock_get_pr.return_value = {
        "number": 7,
        "title": "Add feature",
        "url": "https://github.com/octocat/Hello-World/pull/7",
        "author": "octocat",
        "updated_at": "2026-01-01T00:00:00Z",
    }
    mock_get_diff.return_value = "diff --git a/app.py b/app.py\n+bug"
    mock_review_diff.return_value = (ReviewFindings.model_validate({"findings": []}), "diff")

    response = _signed_post(client, project_id, secret, _OPENED_PAYLOAD)

    assert response.status_code == 200
    assert response.json()["status"] == "review_triggered"

    reviews_resp = client.get(f"/projects/{project_id}/reviews", headers=headers)
    assert len(reviews_resp.json()) == 1


def test_webhook_rejects_bad_signature(client):
    headers = _register_and_login(client, "webhook-bad-sig@example.com")
    project_id, _secret = _create_project_with_webhook(client, headers)

    response = _signed_post(client, project_id, "wrong-secret", _OPENED_PAYLOAD)

    assert response.status_code == 401


def test_webhook_disabled_project_returns_404(client):
    headers = _register_and_login(client, "webhook-disabled@example.com")
    with patch("app.routers.projects.github_service.validate_repo_access"):
        create_resp = client.post(
            "/projects",
            json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
            headers=headers,
        )
    project_id = create_resp.json()["id"]

    response = _signed_post(client, project_id, "any-secret", _OPENED_PAYLOAD)

    assert response.status_code == 404


def test_webhook_ignores_non_pull_request_events(client):
    headers = _register_and_login(client, "webhook-ping@example.com")
    project_id, secret = _create_project_with_webhook(client, headers)

    response = _signed_post(client, project_id, secret, {"zen": "hello"}, event="ping")

    assert response.status_code == 200
    assert response.json()["status"] == "ignored"


def test_webhook_ignores_non_reviewable_actions(client):
    headers = _register_and_login(client, "webhook-closed@example.com")
    project_id, secret = _create_project_with_webhook(client, headers)

    response = _signed_post(client, project_id, secret, {"action": "closed", "pull_request": {"number": 7}})

    assert response.status_code == 200
    assert response.json()["status"] == "ignored"
