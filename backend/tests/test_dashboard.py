from datetime import date
from unittest.mock import patch

from app.models.finding import Finding, FindingCategory, FindingSeverity
from app.models.review import Review, ReviewStatus
from tests.conftest import register_and_login as _register_and_login


def test_summary_with_no_projects_returns_zeros(client):
    headers = _register_and_login(client, "empty@example.com")
    response = client.get("/dashboard/summary", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "total_projects": 0,
        "total_reviews": 0,
        "total_findings": 0,
        "findings_by_severity": {},
        "recent_reviews": [],
    }


@patch("app.routers.projects.github_service.validate_repo_access")
def test_summary_counts_reviews_and_findings(mock_validate, client, db_session):
    headers = _register_and_login(client, "stats@example.com")

    create_resp = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    )
    project_id = create_resp.json()["id"]

    review = Review(
        project_id=project_id,
        pr_number=1,
        pr_title="Test PR",
        pr_url="https://github.com/octocat/Hello-World/pull/1",
        diff_snapshot="diff",
        status=ReviewStatus.completed,
        model_used="llama-3.3-70b-versatile",
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
                file_path="app.py",
                message="SQL injection",
            ),
            Finding(
                review_id=review.id,
                category=FindingCategory.style,
                severity=FindingSeverity.low,
                file_path="app.py",
                message="Naming",
            ),
        ]
    )
    db_session.commit()

    response = client.get("/dashboard/summary", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total_projects"] == 1
    assert body["total_reviews"] == 1
    assert body["total_findings"] == 2
    assert body["findings_by_severity"] == {"critical": 1, "low": 1}
    assert len(body["recent_reviews"]) == 1
    assert body["recent_reviews"][0]["pr_title"] == "Test PR"
    assert body["recent_reviews"][0]["finding_count"] == 2


@patch("app.routers.projects.github_service.validate_repo_access")
def test_summary_excludes_other_users_data(mock_validate, client):
    headers_a = _register_and_login(client, "ownerx@example.com")
    headers_b = _register_and_login(client, "ownery@example.com")

    client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers_a,
    )

    response = client.get("/dashboard/summary", headers=headers_b)
    assert response.status_code == 200
    assert response.json()["total_projects"] == 0


def test_summary_requires_auth(client):
    response = client.get("/dashboard/summary")
    assert response.status_code == 401


@patch("app.routers.projects.github_service.validate_repo_access")
def test_deleted_review_excluded_from_summary_and_listed_in_deleted(mock_validate, client, db_session):
    headers = _register_and_login(client, "delreview@example.com")
    project_id = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    ).json()["id"]

    review = Review(
        project_id=project_id,
        pr_number=7,
        pr_title="Delete me",
        pr_url="https://github.com/octocat/Hello-World/pull/7",
        diff_snapshot="diff",
        status=ReviewStatus.completed,
        model_used="llama-3.3-70b-versatile",
    )
    db_session.add(review)
    db_session.commit()
    db_session.refresh(review)

    assert client.delete(f"/projects/{project_id}/reviews/{review.id}", headers=headers).status_code == 204

    summary = client.get("/dashboard/summary", headers=headers).json()
    assert summary["total_reviews"] == 0
    assert summary["recent_reviews"] == []

    deleted = client.get("/dashboard/deleted-reviews", headers=headers).json()
    assert len(deleted) == 1
    assert deleted[0]["id"] == review.id
    assert deleted[0]["pr_title"] == "Delete me"


@patch("app.routers.projects.github_service.validate_repo_access")
def test_restore_review(mock_validate, client, db_session):
    headers = _register_and_login(client, "restorereview@example.com")
    project_id = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    ).json()["id"]

    review = Review(
        project_id=project_id,
        pr_number=8,
        pr_title="Restore me",
        pr_url="https://github.com/octocat/Hello-World/pull/8",
        diff_snapshot="diff",
        status=ReviewStatus.completed,
        model_used="llama-3.3-70b-versatile",
    )
    db_session.add(review)
    db_session.commit()
    db_session.refresh(review)
    client.delete(f"/projects/{project_id}/reviews/{review.id}", headers=headers)

    response = client.post(f"/dashboard/deleted-reviews/{review.id}/restore", headers=headers)
    assert response.status_code == 200
    assert response.json()["pr_title"] == "Restore me"

    assert client.get("/dashboard/deleted-reviews", headers=headers).json() == []
    assert client.get(f"/projects/{project_id}/reviews/{review.id}", headers=headers).status_code == 200


@patch("app.routers.projects.github_service.validate_repo_access")
def test_restore_review_blocked_while_project_deleted(mock_validate, client, db_session):
    headers = _register_and_login(client, "blockedrestore@example.com")
    project_id = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    ).json()["id"]

    review = Review(
        project_id=project_id,
        pr_number=9,
        pr_title="Stuck",
        pr_url="https://github.com/octocat/Hello-World/pull/9",
        diff_snapshot="diff",
        status=ReviewStatus.completed,
        model_used="llama-3.3-70b-versatile",
    )
    db_session.add(review)
    db_session.commit()
    db_session.refresh(review)
    client.delete(f"/projects/{project_id}/reviews/{review.id}", headers=headers)
    client.delete(f"/projects/{project_id}", headers=headers)

    # the review's own deleted_at is unaffected by the project's, but it's not
    # independently restorable until the project comes back
    response = client.post(f"/dashboard/deleted-reviews/{review.id}/restore", headers=headers)
    assert response.status_code == 400


def test_findings_trend_with_no_projects_returns_all_zero_points(client):
    headers = _register_and_login(client, "trend-empty@example.com")
    response = client.get("/dashboard/findings-trend", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body["points"]) == 30
    assert all(p["review_count"] == 0 and p["finding_count"] == 0 for p in body["points"])
    # Points run oldest to newest, ending today.
    assert body["points"][-1]["date"] == date.today().isoformat()


@patch("app.routers.projects.github_service.validate_repo_access")
def test_findings_trend_buckets_todays_review_on_the_last_point(mock_validate, client, db_session):
    headers = _register_and_login(client, "trend-today@example.com")
    create_resp = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    )
    project_id = create_resp.json()["id"]

    review = Review(
        project_id=project_id,
        pr_number=1,
        pr_title="Test PR",
        pr_url="https://github.com/octocat/Hello-World/pull/1",
        diff_snapshot="diff",
        status=ReviewStatus.completed,
        model_used="llama-3.3-70b-versatile",
    )
    db_session.add(review)
    db_session.commit()
    db_session.refresh(review)
    db_session.add(
        Finding(
            review_id=review.id,
            category=FindingCategory.security,
            severity=FindingSeverity.critical,
            file_path="app.py",
            message="SQL injection",
        )
    )
    db_session.commit()

    response = client.get("/dashboard/findings-trend", headers=headers)
    assert response.status_code == 200
    points = response.json()["points"]
    assert points[-1]["review_count"] == 1
    assert points[-1]["finding_count"] == 1
    assert sum(p["review_count"] for p in points) == 1


def test_findings_trend_excludes_other_users_data(client):
    headers_a = _register_and_login(client, "trend-owner@example.com")
    headers_b = _register_and_login(client, "trend-intruder@example.com")
    with patch("app.routers.projects.github_service.validate_repo_access"):
        client.post(
            "/projects",
            json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
            headers=headers_a,
        )

    response = client.get("/dashboard/findings-trend", headers=headers_b)
    assert response.status_code == 200
    assert all(p["review_count"] == 0 for p in response.json()["points"])


def test_findings_trend_requires_auth(client):
    response = client.get("/dashboard/findings-trend")
    assert response.status_code == 401
