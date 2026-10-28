from app.core.security import create_access_token
from app.models.user import User as UserModel
from tests.conftest import create_verified_user, register_and_login

STRONG_PASSWORD = "Password123!"


def test_register_success(client):
    response = client.post("/auth/register", json={"email": "a@example.com", "password": STRONG_PASSWORD})
    assert response.status_code == 201
    body = response.json()
    assert "message" in body
    assert "hashed_password" not in body
    assert "password" not in body


def test_register_defaults_username_from_email(client):
    client.post("/auth/register", json={"email": "newuser@example.com", "password": STRONG_PASSWORD})
    # The client keeps cookies across requests, so logging in here authenticates
    # the /auth/me call below without needing a separate Bearer header.
    client.post("/auth/login", json={"email": "newuser@example.com", "password": STRONG_PASSWORD})
    me = client.get("/auth/me").json()
    assert me["username"] == "newuser"


def test_update_username(client):
    headers = register_and_login(client, "renameme@example.com")
    response = client.post("/auth/username", json={"username": "New Name"}, headers=headers)
    assert response.status_code == 200
    assert response.json()["username"] == "New Name"

    me = client.get("/auth/me", headers=headers).json()
    assert me["username"] == "New Name"


def test_update_username_rejects_empty(client):
    headers = register_and_login(client, "renameme2@example.com")
    response = client.post("/auth/username", json={"username": ""}, headers=headers)
    assert response.status_code == 422


def test_register_weak_password_rejected(client):
    response = client.post("/auth/register", json={"email": "weak@example.com", "password": "password123"})
    assert response.status_code == 422


def test_register_duplicate_email_rejected(client):
    client.post("/auth/register", json={"email": "dup@example.com", "password": STRONG_PASSWORD})
    response = client.post("/auth/register", json={"email": "dup@example.com", "password": STRONG_PASSWORD})
    assert response.status_code == 409


def test_login_success_returns_token(client):
    create_verified_user("login@example.com")
    response = client.post("/auth/login", json={"email": "login@example.com", "password": "password123"})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_register_auto_verifies_user(client):
    client.post("/auth/register", json={"email": "autoverify@example.com", "password": STRONG_PASSWORD})
    response = client.post("/auth/login", json={"email": "autoverify@example.com", "password": STRONG_PASSWORD})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password_rejected(client):
    create_verified_user("wrong@example.com")
    response = client.post("/auth/login", json={"email": "wrong@example.com", "password": "incorrect"})
    assert response.status_code == 401


def test_login_unknown_email_rejected(client):
    response = client.post("/auth/login", json={"email": "nobody@example.com", "password": "password123"})
    assert response.status_code == 401


def test_me_requires_auth(client):
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_with_invalid_token_rejected(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer not.a.valid.token"})
    assert response.status_code == 401


def test_me_with_valid_token_returns_user(client):
    headers = register_and_login(client, "me@example.com")
    response = client.get("/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["email"] == "me@example.com"


def test_verify_email_invalid_token(client):
    response = client.get("/auth/verify?token=invalidtoken")
    assert response.status_code == 400


def _oauth_only_user_headers(db_session, email: str) -> dict:
    """An account that signed up via Google/GitHub only — hashed_password="" like auth.py sets it."""
    user = UserModel(email=email, username=email.split("@")[0], hashed_password="", is_verified=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(subject=str(user.id))
    return {"Authorization": f"Bearer {token}"}


def test_change_password_success(client):
    headers = register_and_login(client, "changepw@example.com", "password123")
    response = client.post(
        "/auth/password",
        json={"current_password": "password123", "new_password": "NewPassword123!"},
        headers=headers,
    )
    assert response.status_code == 204

    # old password no longer works, new one does
    assert client.post("/auth/login", json={"email": "changepw@example.com", "password": "password123"}).status_code == 401
    assert client.post("/auth/login", json={"email": "changepw@example.com", "password": "NewPassword123!"}).status_code == 200


def test_change_password_wrong_current_rejected(client):
    headers = register_and_login(client, "changepw2@example.com", "password123")
    response = client.post(
        "/auth/password",
        json={"current_password": "wrongpassword", "new_password": "NewPassword123!"},
        headers=headers,
    )
    assert response.status_code == 401


def test_change_password_weak_new_password_rejected(client):
    headers = register_and_login(client, "changepw3@example.com", "password123")
    response = client.post(
        "/auth/password",
        json={"current_password": "password123", "new_password": "weak"},
        headers=headers,
    )
    assert response.status_code == 422


def test_change_password_rejected_for_oauth_only_account(client, db_session):
    headers = _oauth_only_user_headers(db_session, "oauthpw@example.com")
    response = client.post(
        "/auth/password",
        json={"current_password": "anything", "new_password": "NewPassword123!"},
        headers=headers,
    )
    assert response.status_code == 400


def test_github_disconnect_clears_token(client, db_session):
    headers = register_and_login(client, "disconnect@example.com")
    user = db_session.query(UserModel).filter(UserModel.email == "disconnect@example.com").first()
    user.github_access_token = "some-encrypted-token"
    db_session.commit()

    response = client.post("/auth/github/disconnect", headers=headers)
    assert response.status_code == 204
    assert client.get("/auth/me", headers=headers).json()["has_github"] is False


def test_delete_account_requires_correct_password(client):
    headers = register_and_login(client, "delete@example.com", "password123")
    response = client.request("DELETE", "/auth/account", json={"current_password": "wrongpassword"}, headers=headers)
    assert response.status_code == 401


def test_delete_account_success(client):
    headers = register_and_login(client, "delete2@example.com", "password123")
    response = client.request("DELETE", "/auth/account", json={"current_password": "password123"}, headers=headers)
    assert response.status_code == 204

    # account is gone — re-registering the same email now succeeds
    reregister = client.post("/auth/register", json={"email": "delete2@example.com", "password": STRONG_PASSWORD})
    assert reregister.status_code == 201


def test_delete_account_oauth_only_needs_no_password(client, db_session):
    headers = _oauth_only_user_headers(db_session, "oauthdelete@example.com")
    response = client.request("DELETE", "/auth/account", json={}, headers=headers)
    assert response.status_code == 204

