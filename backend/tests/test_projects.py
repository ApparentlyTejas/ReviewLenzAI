from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from app.models.project import Project
from tests.conftest import register_and_login as _register_and_login


@patch("app.routers.projects.github_service.validate_repo_access")
def test_create_project_success(mock_validate, client):
    headers = _register_and_login(client, "owner@example.com")
    response = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["repo_owner"] == "octocat"
    assert "github_pat" not in body
    assert "encrypted_pat" not in body


@patch("app.routers.projects.github_service.validate_repo_access")
def test_list_projects_only_returns_own_projects(mock_validate, client):
    headers_a = _register_and_login(client, "a@example.com")
    headers_b = _register_and_login(client, "b@example.com")

    client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers_a,
    )

    response = client.get("/projects", headers=headers_b)
    assert response.status_code == 200
    assert response.json() == []


@patch("app.routers.projects.github_service.validate_repo_access")
def test_user_cannot_access_other_users_project(mock_validate, client):
    headers_a = _register_and_login(client, "owner2@example.com")
    headers_b = _register_and_login(client, "intruder@example.com")

    create_resp = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers_a,
    )
    project_id = create_resp.json()["id"]

    response = client.get(f"/projects/{project_id}/pulls", headers=headers_b)
    assert response.status_code == 404


def test_create_project_requires_auth(client):
    response = client.post(
        "/projects", json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"}
    )
    assert response.status_code == 401


@patch("app.routers.projects.github_service.validate_repo_access")
def test_delete_project_is_soft_and_shows_in_deleted_list(mock_validate, client):
    headers = _register_and_login(client, "softdel@example.com")
    create_resp = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    )
    project_id = create_resp.json()["id"]

    assert client.delete(f"/projects/{project_id}", headers=headers).status_code == 204
    assert client.get("/projects", headers=headers).json() == []
    assert client.get(f"/projects/{project_id}/pulls", headers=headers).status_code == 404

    deleted = client.get("/projects/deleted", headers=headers).json()
    assert len(deleted) == 1
    assert deleted[0]["id"] == project_id


@patch("app.routers.projects.github_service.validate_repo_access")
def test_restore_project(mock_validate, client):
    headers = _register_and_login(client, "restore@example.com")
    create_resp = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    )
    project_id = create_resp.json()["id"]
    client.delete(f"/projects/{project_id}", headers=headers)

    response = client.post(f"/projects/{project_id}/restore", headers=headers)
    assert response.status_code == 200
    assert response.json()["id"] == project_id

    assert client.get("/projects/deleted", headers=headers).json() == []
    assert any(p["id"] == project_id for p in client.get("/projects", headers=headers).json())


@patch("app.routers.projects.github_service.validate_repo_access")
def test_reconnecting_deleted_repo_revives_it(mock_validate, client):
    headers = _register_and_login(client, "revive@example.com")
    create_resp = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    )
    project_id = create_resp.json()["id"]
    client.delete(f"/projects/{project_id}", headers=headers)

    revive_resp = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake2"},
        headers=headers,
    )
    assert revive_resp.status_code == 201
    assert revive_resp.json()["id"] == project_id
    assert client.get("/projects/deleted", headers=headers).json() == []


@patch("app.routers.projects.github_service.validate_repo_access")
def test_deleted_project_purged_after_retention_window(mock_validate, client, db_session):
    headers = _register_and_login(client, "purge@example.com")
    create_resp = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    )
    project_id = create_resp.json()["id"]
    client.delete(f"/projects/{project_id}", headers=headers)

    project = db_session.get(Project, project_id)
    project.deleted_at = datetime.now(UTC) - timedelta(days=31)
    db_session.commit()

    assert client.get("/projects/deleted", headers=headers).json() == []
    assert db_session.get(Project, project_id) is None


@patch("app.routers.projects.github_service.validate_repo_access")
def test_get_project_settings_defaults(mock_validate, client):
    headers = _register_and_login(client, "settings-defaults@example.com")
    create_resp = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    )
    project_id = create_resp.json()["id"]

    response = client.get(f"/projects/{project_id}/settings", headers=headers)

    assert response.status_code == 200
    assert response.json() == {"ignore_patterns": "", "min_severity": "low"}


@patch("app.routers.projects.github_service.validate_repo_access")
def test_update_project_settings_persists(mock_validate, client):
    headers = _register_and_login(client, "settings-update@example.com")
    create_resp = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    )
    project_id = create_resp.json()["id"]

    response = client.post(
        f"/projects/{project_id}/settings",
        json={"ignore_patterns": "*.lock\ndist/*", "min_severity": "high"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() == {"ignore_patterns": "*.lock\ndist/*", "min_severity": "high"}

    get_resp = client.get(f"/projects/{project_id}/settings", headers=headers)
    assert get_resp.json()["min_severity"] == "high"


def test_get_project_settings_on_other_users_project_returns_404(client):
    headers_a = _register_and_login(client, "settings-owner@example.com")
    headers_b = _register_and_login(client, "settings-intruder@example.com")
    with patch("app.routers.projects.github_service.validate_repo_access"):
        create_resp = client.post(
            "/projects",
            json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
            headers=headers_a,
        )
    project_id = create_resp.json()["id"]

    response = client.get(f"/projects/{project_id}/settings", headers=headers_b)

    assert response.status_code == 404


def test_project_settings_requires_auth(client):
    assert client.get("/projects/1/settings").status_code == 401
    assert client.post("/projects/1/settings", json={"ignore_patterns": "", "min_severity": "low"}).status_code == 401


@patch("app.routers.projects.github_service.validate_repo_access")
def test_webhook_disabled_by_default(mock_validate, client):
    headers = _register_and_login(client, "webhook-default@example.com")
    create_resp = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    )
    project_id = create_resp.json()["id"]

    response = client.get(f"/projects/{project_id}/webhook", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is False
    assert body["webhook_url"].endswith(f"/webhooks/github/{project_id}")


@patch("app.routers.projects.github_service.validate_repo_access")
def test_enable_webhook_returns_secret_and_marks_enabled(mock_validate, client):
    headers = _register_and_login(client, "webhook-enable@example.com")
    create_resp = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    )
    project_id = create_resp.json()["id"]

    response = client.post(f"/projects/{project_id}/webhook", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is True
    assert len(body["secret"]) == 64

    status_resp = client.get(f"/projects/{project_id}/webhook", headers=headers)
    assert status_resp.json()["enabled"] is True


@patch("app.routers.projects.github_service.validate_repo_access")
def test_disable_webhook_clears_secret(mock_validate, client):
    headers = _register_and_login(client, "webhook-disable@example.com")
    create_resp = client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=headers,
    )
    project_id = create_resp.json()["id"]
    client.post(f"/projects/{project_id}/webhook", headers=headers)

    response = client.delete(f"/projects/{project_id}/webhook", headers=headers)
    assert response.status_code == 204

    status_resp = client.get(f"/projects/{project_id}/webhook", headers=headers)
    assert status_resp.json()["enabled"] is False


def test_webhook_management_requires_auth(client):
    assert client.get("/projects/1/webhook").status_code == 401
    assert client.post("/projects/1/webhook").status_code == 401
    assert client.delete("/projects/1/webhook").status_code == 401
