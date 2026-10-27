from unittest.mock import patch

from app.models.finding import Finding, FindingCategory, FindingSeverity
from app.models.review import Review, ReviewStatus
from app.services.dashboard_context import (
    MAX_FINDINGS_IN_CONTEXT,
    build_dashboard_context,
)
from tests.conftest import register_and_login as _register_and_login


def test_build_dashboard_context_with_no_projects(client, db_session):
    headers = _register_and_login(client, "ctx-empty@example.com")
    user_id = client.get("/auth/me", headers=headers).json()["id"]

    context = build_dashboard_context(db_session, user_id)

    assert context.has_any_data is False
    assert "not connected" in context.summary_text


@patch("app.routers.projects.github_service.validate_repo_access")
def test_build_dashboard_context_includes_repo_and_findings(mock_validate, client, db_session):
    headers = _register_and_login(client, "ctx-data@example.com")
    user_id = client.get("/auth/me", headers=headers).json()["id"]

    project_id = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    ).json()["id"]

    review = Review(
        project_id=project_id,
        pr_number=5,
        pr_title="Add auth",
        pr_url="https://github.com/octocat/Hello-World/pull/5",
        diff_snapshot="diff",
        status=ReviewStatus.completed,
        model_used="qwen/qwen3.8-27b",
    )
    db_session.add(review)
    db_session.commit()
    db_session.refresh(review)

    db_session.add_all(
        [
            Finding(
                review_id=review.id,
                category=FindingCategory.security,
                severity=FindingSeverity.critical,
                file_path="auth.py",
                line_number=10,
                message="Hardcoded secret",
            ),
            Finding(
                review_id=review.id,
                category=FindingCategory.style,
                severity=FindingSeverity.low,
                file_path="auth.py",
                message="Naming",
            ),
        ]
    )
    db_session.commit()

    context = build_dashboard_context(db_session, user_id)

    assert context.has_any_data is True
    assert "octocat/Hello-World" in context.summary_text
    assert "PR #5" in context.summary_text
    assert "Add auth" in context.summary_text
    assert "Hardcoded secret" in context.summary_text
    assert "Total findings across all reviews: 2" in context.summary_text
    # Critical should be listed before low (sorted most-severe-first).
    assert context.summary_text.index("critical/security") < context.summary_text.index("low/style")


@patch("app.routers.projects.github_service.validate_repo_access")
def test_build_dashboard_context_caps_findings_shown(mock_validate, client, db_session):
    headers = _register_and_login(client, "ctx-many@example.com")
    user_id = client.get("/auth/me", headers=headers).json()["id"]

    project_id = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    ).json()["id"]

    review = Review(
        project_id=project_id,
        pr_number=1,
        pr_title="Many issues",
        pr_url="https://github.com/octocat/Hello-World/pull/1",
        diff_snapshot="diff",
        status=ReviewStatus.completed,
        model_used="qwen/qwen3.8-27b",
    )
    db_session.add(review)
    db_session.commit()
    db_session.refresh(review)

    db_session.add_all(
        [
            Finding(
                review_id=review.id,
                category=FindingCategory.bug,
                severity=FindingSeverity.low,
                file_path=f"file_{i}.py",
                message=f"issue {i}",
            )
            for i in range(MAX_FINDINGS_IN_CONTEXT + 10)
        ]
    )
    db_session.commit()

    context = build_dashboard_context(db_session, user_id)

    total = MAX_FINDINGS_IN_CONTEXT + 10
    assert f"Total findings across all reviews: {total}" in context.summary_text
    assert f"showing {MAX_FINDINGS_IN_CONTEXT} of {total}" in context.summary_text


@patch("app.routers.projects.github_service.validate_repo_access")
def test_build_dashboard_context_excludes_other_users_data(mock_validate, client, db_session):
    headers_a = _register_and_login(client, "ctx-owner@example.com")
    headers_b = _register_and_login(client, "ctx-intruder@example.com")
    user_b_id = client.get("/auth/me", headers=headers_b).json()["id"]

    client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers_a,
    )

    context = build_dashboard_context(db_session, user_b_id)

    assert context.has_any_data is False
