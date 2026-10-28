from unittest.mock import patch

from app.schemas.review import ReviewFindings
from app.services import github_service
from app.services.llm_service import LLMReviewError
from tests.conftest import register_and_login as _register_and_login


def _create_project(client, headers, owner="octocat", name="Hello-World"):
    with patch("app.routers.projects.github_service.validate_repo_access"):
        resp = client.post(
            "/projects",
            json={"repo_owner": owner, "repo_name": name, "github_pat": "ghp_fake"},
            headers=headers,
        )
    return resp.json()["id"]


def _fake_pr(number=7):
    return {
        "number": number,
        "title": "Add feature",
        "url": f"https://github.com/octocat/Hello-World/pull/{number}",
        "author": "octocat",
        "updated_at": "2026-01-01T00:00:00Z",
    }


_REVIEWS_PATCH_TARGET = "app.routers.reviews"
_RUNNER_PATCH_TARGET = "app.services.review_runner"


@patch(f"{_RUNNER_PATCH_TARGET}.send_review_ready_email")
@patch(f"{_RUNNER_PATCH_TARGET}.review_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request")
def test_trigger_review_success_persists_findings_and_sends_email(
    mock_get_pr, mock_get_diff, mock_review_diff, mock_send_email, client
):
    headers = _register_and_login(client, "owner@example.com")
    project_id = _create_project(client, headers)

    mock_get_pr.return_value = _fake_pr()
    mock_get_diff.return_value = "diff --git a/app.py b/app.py\n+bug"
    mock_review_diff.return_value = (
        ReviewFindings.model_validate(
            {
                "findings": [
                    {
                        "category": "bug",
                        "severity": "high",
                        "file_path": "app.py",
                        "line_number": 3,
                        "message": "Off by one",
                        "suggested_fix": "Use <= instead of <",
                    }
                ]
            }
        ),
        "diff --git a/app.py b/app.py\n+bug",
    )

    response = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 7}, headers=headers)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "completed"
    assert body["pr_number"] == 7
    assert len(body["findings"]) == 1
    assert body["findings"][0]["message"] == "Off by one"
    mock_send_email.assert_called_once()
    assert mock_send_email.call_args.kwargs["finding_count"] == 1


@patch(f"{_RUNNER_PATCH_TARGET}.send_review_ready_email")
@patch(f"{_RUNNER_PATCH_TARGET}.review_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request")
def test_trigger_review_llm_failure_marks_review_failed_not_500(
    mock_get_pr, mock_get_diff, mock_review_diff, mock_send_email, client
):
    headers = _register_and_login(client, "owner2@example.com")
    project_id = _create_project(client, headers)

    mock_get_pr.return_value = _fake_pr()
    mock_get_diff.return_value = "diff --git a/app.py b/app.py\n+bug"
    mock_review_diff.side_effect = LLMReviewError("Groq API call failed: boom")

    response = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 7}, headers=headers)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "failed"
    assert "boom" in body["error_message"]
    assert body["findings"] == []
    mock_send_email.assert_not_called()


@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request")
def test_trigger_review_invalid_pat_returns_400(mock_get_pr, client):
    headers = _register_and_login(client, "owner3@example.com")
    project_id = _create_project(client, headers)

    mock_get_pr.side_effect = github_service.GitHubAuthError("GitHub token is invalid or expired")

    response = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 7}, headers=headers)

    assert response.status_code == 400


@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request")
def test_trigger_review_unknown_pr_returns_404(mock_get_pr, client):
    headers = _register_and_login(client, "owner4@example.com")
    project_id = _create_project(client, headers)

    mock_get_pr.side_effect = github_service.GitHubNotFoundError("PR #999 not found")

    response = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 999}, headers=headers)

    assert response.status_code == 404


def test_trigger_review_requires_auth(client):
    response = client.post("/projects/1/reviews", json={"pr_number": 1})
    assert response.status_code == 401


@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request")
def test_trigger_review_on_other_users_project_returns_404(mock_get_pr, client):
    headers_a = _register_and_login(client, "owner5@example.com")
    headers_b = _register_and_login(client, "intruder@example.com")
    project_id = _create_project(client, headers_a)

    response = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 1}, headers=headers_b)

    assert response.status_code == 404
    mock_get_pr.assert_not_called()


@patch(f"{_RUNNER_PATCH_TARGET}.send_review_ready_email")
@patch(f"{_RUNNER_PATCH_TARGET}.review_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request")
def test_trigger_review_email_failure_does_not_fail_the_request(
    mock_get_pr, mock_get_diff, mock_review_diff, mock_send_email, client
):
    # The router wraps the email send in a bare except-and-ignore, on the
    # reasoning that a review the user paid an LLM call for should never be
    # thrown away just because a notification email failed to send.
    headers = _register_and_login(client, "owner6@example.com")
    project_id = _create_project(client, headers)

    mock_get_pr.return_value = _fake_pr()
    mock_get_diff.return_value = "diff --git a/app.py b/app.py\n+ok"
    mock_review_diff.return_value = (ReviewFindings.model_validate({"findings": []}), "diff")
    mock_send_email.side_effect = RuntimeError("Brevo is down")

    response = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 7}, headers=headers)

    assert response.status_code == 201
    assert response.json()["status"] == "completed"


@patch(f"{_RUNNER_PATCH_TARGET}.send_review_ready_email")
@patch(f"{_RUNNER_PATCH_TARGET}.review_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request")
def test_list_reviews_returns_summaries_newest_first(
    mock_get_pr, mock_get_diff, mock_review_diff, mock_send_email, client
):
    headers = _register_and_login(client, "owner7@example.com")
    project_id = _create_project(client, headers)
    mock_get_diff.return_value = "diff"
    mock_review_diff.return_value = (ReviewFindings.model_validate({"findings": []}), "diff")

    mock_get_pr.return_value = _fake_pr(number=1)
    client.post(f"/projects/{project_id}/reviews", json={"pr_number": 1}, headers=headers)
    mock_get_pr.return_value = _fake_pr(number=2)
    client.post(f"/projects/{project_id}/reviews", json={"pr_number": 2}, headers=headers)

    response = client.get(f"/projects/{project_id}/reviews", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert body[0]["pr_number"] == 2  # most recently created first
    assert "finding_count" in body[0]


def test_list_reviews_requires_owned_project(client):
    headers_a = _register_and_login(client, "owner8@example.com")
    headers_b = _register_and_login(client, "intruder2@example.com")
    project_id = _create_project(client, headers_a)

    response = client.get(f"/projects/{project_id}/reviews", headers=headers_b)

    assert response.status_code == 404


@patch(f"{_RUNNER_PATCH_TARGET}.send_review_ready_email")
@patch(f"{_RUNNER_PATCH_TARGET}.review_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request")
def test_get_review_returns_full_detail(
    mock_get_pr, mock_get_diff, mock_review_diff, mock_send_email, client
):
    headers = _register_and_login(client, "owner9@example.com")
    project_id = _create_project(client, headers)
    mock_get_pr.return_value = _fake_pr()
    mock_get_diff.return_value = "diff"
    mock_review_diff.return_value = (ReviewFindings.model_validate({"findings": []}), "diff")

    create_resp = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 7}, headers=headers)
    review_id = create_resp.json()["id"]

    response = client.get(f"/projects/{project_id}/reviews/{review_id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["id"] == review_id


def test_get_review_unknown_id_returns_404(client):
    headers = _register_and_login(client, "owner10@example.com")
    project_id = _create_project(client, headers)

    response = client.get(f"/projects/{project_id}/reviews/999999", headers=headers)

    assert response.status_code == 404


@patch(f"{_RUNNER_PATCH_TARGET}.send_review_ready_email")
@patch(f"{_RUNNER_PATCH_TARGET}.review_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request")
def test_delete_review_removes_it_and_its_findings(
    mock_get_pr, mock_get_diff, mock_review_diff, mock_send_email, client
):
    headers = _register_and_login(client, "deleter1@example.com")
    project_id = _create_project(client, headers)
    mock_get_pr.return_value = _fake_pr()
    mock_get_diff.return_value = "diff"
    mock_review_diff.return_value = (
        ReviewFindings.model_validate(
            {"findings": [{"category": "bug", "severity": "low", "file_path": "a.py", "message": "x"}]}
        ),
        "diff",
    )

    create_resp = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 7}, headers=headers)
    review_id = create_resp.json()["id"]

    delete_resp = client.delete(f"/projects/{project_id}/reviews/{review_id}", headers=headers)
    assert delete_resp.status_code == 204

    get_resp = client.get(f"/projects/{project_id}/reviews/{review_id}", headers=headers)
    assert get_resp.status_code == 404

    list_resp = client.get(f"/projects/{project_id}/reviews", headers=headers)
    assert list_resp.json() == []


def test_delete_review_unknown_id_returns_404(client):
    headers = _register_and_login(client, "deleter2@example.com")
    project_id = _create_project(client, headers)

    response = client.delete(f"/projects/{project_id}/reviews/999999", headers=headers)

    assert response.status_code == 404


@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request")
def test_delete_review_on_other_users_project_returns_404(mock_get_pr, client):
    headers_a = _register_and_login(client, "deleter-owner@example.com")
    headers_b = _register_and_login(client, "deleter-intruder@example.com")
    project_id = _create_project(client, headers_a)

    response = client.delete(f"/projects/{project_id}/reviews/1", headers=headers_b)

    assert response.status_code == 404


def test_delete_review_requires_auth(client):
    response = client.delete("/projects/1/reviews/1")
    assert response.status_code == 401


def _create_completed_review(client, headers, project_id):
    with (
        patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request", return_value=_fake_pr()),
        patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request_diff", return_value="diff --git a/app.py b/app.py\n+bug"),
        patch(f"{_RUNNER_PATCH_TARGET}.review_diff", return_value=(ReviewFindings.model_validate({"findings": []}), "diff")),
    ):
        resp = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 7}, headers=headers)
    return resp.json()["id"]


@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.post_issue_comment")
def test_post_comment_success_returns_comment_url(mock_post_comment, client):
    headers = _register_and_login(client, "commenter@example.com")
    project_id = _create_project(client, headers)
    review_id = _create_completed_review(client, headers, project_id)

    mock_post_comment.return_value = "https://github.com/octocat/Hello-World/pull/7#issuecomment-1"

    response = client.post(f"/projects/{project_id}/reviews/{review_id}/post-comment", headers=headers)

    assert response.status_code == 200
    assert response.json()["comment_url"] == "https://github.com/octocat/Hello-World/pull/7#issuecomment-1"
    mock_post_comment.assert_called_once()


def test_post_comment_on_failed_review_returns_400(client):
    headers = _register_and_login(client, "commenter2@example.com")
    project_id = _create_project(client, headers)

    with (
        patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request", return_value=_fake_pr()),
        patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request_diff", return_value="diff"),
        patch(f"{_RUNNER_PATCH_TARGET}.review_diff", side_effect=LLMReviewError("boom")),
    ):
        create_resp = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 7}, headers=headers)
    review_id = create_resp.json()["id"]

    response = client.post(f"/projects/{project_id}/reviews/{review_id}/post-comment", headers=headers)

    assert response.status_code == 400


def test_post_comment_on_other_users_project_returns_404(client):
    headers_a = _register_and_login(client, "commenter-owner@example.com")
    headers_b = _register_and_login(client, "commenter-intruder@example.com")
    project_id = _create_project(client, headers_a)
    review_id = _create_completed_review(client, headers_a, project_id)

    response = client.post(f"/projects/{project_id}/reviews/{review_id}/post-comment", headers=headers_b)

    assert response.status_code == 404


def test_post_comment_requires_auth(client):
    response = client.post("/projects/1/reviews/1/post-comment")
    assert response.status_code == 401


@patch(f"{_RUNNER_PATCH_TARGET}.send_review_ready_email")
@patch(f"{_RUNNER_PATCH_TARGET}.review_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request")
def test_min_severity_filters_out_low_findings(mock_get_pr, mock_get_diff, mock_review_diff, mock_send_email, client):
    headers = _register_and_login(client, "severity-filter@example.com")
    project_id = _create_project(client, headers)
    client.post(
        f"/projects/{project_id}/settings",
        json={"ignore_patterns": "", "min_severity": "high"},
        headers=headers,
    )

    mock_get_pr.return_value = _fake_pr()
    mock_get_diff.return_value = "diff --git a/app.py b/app.py\n+bug"
    mock_review_diff.return_value = (
        ReviewFindings.model_validate(
            {
                "findings": [
                    {"category": "style", "severity": "low", "file_path": "app.py", "message": "nit"},
                    {"category": "bug", "severity": "critical", "file_path": "app.py", "message": "real bug"},
                ]
            }
        ),
        "diff",
    )

    response = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 7}, headers=headers)

    assert response.status_code == 201
    findings = response.json()["findings"]
    assert len(findings) == 1
    assert findings[0]["message"] == "real bug"


@patch(f"{_RUNNER_PATCH_TARGET}.send_review_ready_email")
@patch(f"{_RUNNER_PATCH_TARGET}.review_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request")
def test_rereview_includes_delta_against_previous_review(
    mock_get_pr, mock_get_diff, mock_review_diff, mock_send_email, client
):
    headers = _register_and_login(client, "rereview@example.com")
    project_id = _create_project(client, headers)
    mock_get_pr.return_value = _fake_pr()
    mock_get_diff.return_value = "diff --git a/app.py b/app.py\n+bug"

    mock_review_diff.return_value = (
        ReviewFindings.model_validate(
            {
                "findings": [
                    {"category": "bug", "severity": "high", "file_path": "app.py", "line_number": 1, "message": "a"},
                    {"category": "bug", "severity": "high", "file_path": "app.py", "line_number": 2, "message": "b"},
                ]
            }
        ),
        "diff",
    )
    first_resp = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 7}, headers=headers)
    assert first_resp.json()["delta"] is None

    mock_review_diff.return_value = (
        ReviewFindings.model_validate(
            {
                "findings": [
                    {"category": "bug", "severity": "high", "file_path": "app.py", "line_number": 1, "message": "a"},
                    {"category": "bug", "severity": "high", "file_path": "app.py", "line_number": 3, "message": "c"},
                ]
            }
        ),
        "diff",
    )
    second_resp = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 7}, headers=headers)

    delta = second_resp.json()["delta"]
    assert delta is not None
    assert delta["previous_review_id"] == first_resp.json()["id"]
    assert delta["resolved_count"] == 1
    assert delta["unchanged_count"] == 1
    assert len(delta["new_finding_ids"]) == 1

    get_resp = client.get(f"/projects/{project_id}/reviews/{second_resp.json()['id']}", headers=headers)
    assert get_resp.json()["delta"] == delta


@patch(f"{_RUNNER_PATCH_TARGET}.send_review_ready_email")
@patch(f"{_RUNNER_PATCH_TARGET}.review_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request_diff")
@patch(f"{_REVIEWS_PATCH_TARGET}.github_service.get_pull_request")
def test_ignore_patterns_strip_matching_files_before_review(
    mock_get_pr, mock_get_diff, mock_review_diff, mock_send_email, client
):
    headers = _register_and_login(client, "ignore-patterns@example.com")
    project_id = _create_project(client, headers)
    client.post(
        f"/projects/{project_id}/settings",
        json={"ignore_patterns": "package-lock.json", "min_severity": "low"},
        headers=headers,
    )

    mock_get_pr.return_value = _fake_pr()
    mock_get_diff.return_value = (
        "diff --git a/app.py b/app.py\n+bug\ndiff --git a/package-lock.json b/package-lock.json\n+noise"
    )
    mock_review_diff.return_value = (ReviewFindings.model_validate({"findings": []}), "diff")

    response = client.post(f"/projects/{project_id}/reviews", json={"pr_number": 7}, headers=headers)

    assert response.status_code == 201
    sent_diff = mock_review_diff.call_args.args[0]
    assert "app.py" in sent_diff
    assert "package-lock.json" not in sent_diff
