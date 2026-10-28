from unittest.mock import patch

from tests.conftest import login as _login
from tests.conftest import register_and_login as _register_and_login


def test_new_user_has_one_personal_org_as_owner(client):
    headers = _register_and_login(client, "solo@example.com")
    resp = client.get("/orgs", headers=headers)
    assert resp.status_code == 200
    orgs = resp.json()
    assert len(orgs) == 1
    assert orgs[0]["role"] == "owner"
    assert "solo" in orgs[0]["name"]


def test_create_organization_makes_creator_owner(client):
    headers = _register_and_login(client, "founder@example.com")
    resp = client.post("/orgs", json={"name": "Acme Corp"}, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Acme Corp"
    assert body["role"] == "owner"

    orgs = client.get("/orgs", headers=headers).json()
    assert len(orgs) == 2


def test_owner_can_invite_existing_user_and_member_sees_org(client):
    owner_headers = _register_and_login(client, "owner@example.com")
    _register_and_login(client, "teammate@example.com")

    org_id = client.get("/orgs", headers=owner_headers).json()[0]["id"]
    resp = client.post(
        f"/orgs/{org_id}/members", json={"email": "teammate@example.com", "role": "member"}, headers=owner_headers
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "member"

    members = client.get(f"/orgs/{org_id}/members", headers=owner_headers).json()
    emails = {m["email"] for m in members}
    assert emails == {"owner@example.com", "teammate@example.com"}

    teammate_headers = _login(client, "teammate@example.com")
    teammate_orgs = client.get("/orgs", headers=teammate_headers).json()
    assert any(o["id"] == org_id for o in teammate_orgs)


def test_inviting_unknown_email_returns_404(client):
    headers = _register_and_login(client, "owner2@example.com")
    org_id = client.get("/orgs", headers=headers).json()[0]["id"]
    resp = client.post(f"/orgs/{org_id}/members", json={"email": "nobody@example.com"}, headers=headers)
    assert resp.status_code == 404


def test_member_cannot_invite(client):
    owner_headers = _register_and_login(client, "owner3@example.com")
    _register_and_login(client, "member3@example.com")
    org_id = client.get("/orgs", headers=owner_headers).json()[0]["id"]
    client.post(f"/orgs/{org_id}/members", json={"email": "member3@example.com", "role": "member"}, headers=owner_headers)

    member_headers = _login(client, "member3@example.com")
    resp = client.post(
        f"/orgs/{org_id}/members", json={"email": "owner3@example.com"}, headers=member_headers
    )
    assert resp.status_code == 403


def test_non_member_cannot_see_org(client):
    owner_headers = _register_and_login(client, "owner4@example.com")
    outsider_headers = _register_and_login(client, "outsider4@example.com")
    org_id = client.get("/orgs", headers=owner_headers).json()[0]["id"]

    resp = client.get(f"/orgs/{org_id}/members", headers=outsider_headers)
    assert resp.status_code == 404


def test_cannot_remove_last_owner(client):
    headers = _register_and_login(client, "lastowner@example.com")
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    org_id = client.get("/orgs", headers=headers).json()[0]["id"]

    resp = client.delete(f"/orgs/{org_id}/members/{user_id}", headers=headers)
    assert resp.status_code == 400


def test_owner_can_demote_and_remove_a_member(client):
    owner_headers = _register_and_login(client, "owner5@example.com")
    _register_and_login(client, "member5@example.com")
    org_id = client.get("/orgs", headers=owner_headers).json()[0]["id"]
    client.post(f"/orgs/{org_id}/members", json={"email": "member5@example.com", "role": "admin"}, headers=owner_headers)

    member_id = next(
        m["user_id"] for m in client.get(f"/orgs/{org_id}/members", headers=owner_headers).json() if m["email"] == "member5@example.com"
    )

    role_resp = client.post(f"/orgs/{org_id}/members/{member_id}/role", json={"role": "member"}, headers=owner_headers)
    assert role_resp.status_code == 200
    assert role_resp.json()["role"] == "member"

    remove_resp = client.delete(f"/orgs/{org_id}/members/{member_id}", headers=owner_headers)
    assert remove_resp.status_code == 204

    members = client.get(f"/orgs/{org_id}/members", headers=owner_headers).json()
    assert len(members) == 1


@patch("app.routers.projects.github_service.validate_repo_access")
def test_projects_are_scoped_to_the_active_org_not_just_the_user(mock_validate, client):
    owner_headers = _register_and_login(client, "multiorg@example.com")
    personal_org_id = client.get("/orgs", headers=owner_headers).json()[0]["id"]

    team_org = client.post("/orgs", json={"name": "Second Org"}, headers=owner_headers).json()
    team_org_id = team_org["id"]

    client.post(
        "/projects",
        json={"repo_owner": "octocat", "repo_name": "Hello-World", "github_pat": "ghp_fake"},
        headers=owner_headers,
    )

    # Default (no X-Org-Id) resolves to the earliest membership — the personal org.
    personal_projects = client.get("/projects", headers=owner_headers).json()
    assert len(personal_projects) == 1

    # Switching org context via header shows a separate, empty project list.
    team_headers = {**owner_headers, "X-Org-Id": str(team_org_id)}
    team_projects = client.get("/projects", headers=team_headers).json()
    assert team_projects == []

    explicit_personal_headers = {**owner_headers, "X-Org-Id": str(personal_org_id)}
    assert len(client.get("/projects", headers=explicit_personal_headers).json()) == 1


def test_cannot_use_x_org_id_for_an_org_you_are_not_in(client):
    owner_headers = _register_and_login(client, "orga@example.com")
    other_user_headers = _register_and_login(client, "orgb@example.com")
    other_org_id = client.get("/orgs", headers=other_user_headers).json()[0]["id"]

    resp = client.get("/projects", headers={**owner_headers, "X-Org-Id": str(other_org_id)})
    assert resp.status_code == 403
