from unittest.mock import MagicMock, patch

from app.services.email_service import (
    send_review_ready_email,
    send_verification_email,
    send_welcome_email,
)


@patch("app.services.email_service.httpx.post")
def test_send_verification_email_is_a_noop_without_an_api_key(mock_post):
    # settings.brevo_api_key defaults to "" (unset in CI, and in any env
    # that hasn't configured Brevo) -- email sending should degrade to a
    # silent no-op rather than raise, since nothing in the app currently
    # treats a failed/skipped email as fatal to the request it's attached to.
    send_verification_email(to="user@example.com", token="tok123")
    mock_post.assert_not_called()


@patch("app.services.email_service.settings")
@patch("app.services.email_service.httpx.post")
def test_send_verification_email_posts_to_brevo_when_configured(mock_post, mock_settings):
    mock_settings.brevo_api_key = "fake-key"
    mock_settings.brevo_from_email = "noreply@reviewlenzai.com"
    mock_settings.app_url = "https://reviewlenzai.vercel.app"
    mock_post.return_value = MagicMock(status_code=200)

    send_verification_email(to="user@example.com", token="tok123")

    mock_post.assert_called_once()
    _, kwargs = mock_post.call_args
    assert kwargs["headers"]["api-key"] == "fake-key"
    assert kwargs["json"]["to"] == [{"email": "user@example.com"}]
    assert kwargs["json"]["subject"] == "Verify your ReviewLenzAI email"
    assert "tok123" in kwargs["json"]["htmlContent"]


@patch("app.services.email_service.settings")
@patch("app.services.email_service.httpx.post")
def test_send_welcome_email_posts_to_brevo_when_configured(mock_post, mock_settings):
    mock_settings.brevo_api_key = "fake-key"
    mock_settings.brevo_from_email = "noreply@reviewlenzai.com"
    mock_settings.app_url = "https://reviewlenzai.vercel.app"
    mock_post.return_value = MagicMock(status_code=200)

    send_welcome_email(to="new-user@example.com")

    mock_post.assert_called_once()
    _, kwargs = mock_post.call_args
    assert kwargs["json"]["to"] == [{"email": "new-user@example.com"}]
    assert kwargs["json"]["subject"] == "Welcome to ReviewLenzAI"


@patch("app.services.email_service.settings")
@patch("app.services.email_service.httpx.post")
def test_send_review_ready_email_includes_finding_count_and_singular_plural(mock_post, mock_settings):
    mock_settings.brevo_api_key = "fake-key"
    mock_settings.brevo_from_email = "noreply@reviewlenzai.com"
    mock_settings.app_url = "https://reviewlenzai.vercel.app"
    mock_post.return_value = MagicMock(status_code=200)

    send_review_ready_email(
        to="user@example.com",
        pr_title="Fix the bug",
        pr_number=42,
        repo="octocat/Hello-World",
        finding_count=1,
        review_url="https://reviewlenzai.vercel.app/projects/1/reviews/1",
    )

    _, kwargs = mock_post.call_args
    assert "1 finding" in kwargs["json"]["htmlContent"]
    assert "1 findings" not in kwargs["json"]["htmlContent"]
    assert "PR #42" in kwargs["json"]["subject"]


@patch("app.services.email_service.settings")
@patch("app.services.email_service.httpx.post")
def test_send_review_ready_email_pluralizes_multiple_findings(mock_post, mock_settings):
    mock_settings.brevo_api_key = "fake-key"
    mock_settings.brevo_from_email = "noreply@reviewlenzai.com"
    mock_settings.app_url = "https://reviewlenzai.vercel.app"
    mock_post.return_value = MagicMock(status_code=200)

    send_review_ready_email(
        to="user@example.com",
        pr_title="Fix the bug",
        pr_number=42,
        repo="octocat/Hello-World",
        finding_count=3,
        review_url="https://reviewlenzai.vercel.app/projects/1/reviews/1",
    )

    _, kwargs = mock_post.call_args
    assert "3 findings" in kwargs["json"]["htmlContent"]
