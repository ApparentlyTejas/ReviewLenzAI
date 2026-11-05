from html import escape

import httpx

from app.core.config import settings


def _send(to: str, subject: str, html: str) -> None:
    if not settings.brevo_api_key:
        return
    httpx.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={"api-key": settings.brevo_api_key, "content-type": "application/json"},
        json={
            "sender": {"email": settings.brevo_from_email, "name": "ReviewLenzAI"},
            "to": [{"email": to}],
            "subject": subject,
            "htmlContent": html,
        },
        timeout=10,
    )


def send_verification_email(to: str, token: str) -> None:
    verify_url = f"{settings.app_url}/verify-email?token={token}"
    _send(
        to=to,
        subject="Verify your ReviewLenzAI email",
        html=f"""
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">Confirm your email</h1>
          <p style="color:#555;line-height:1.6">
            Click the button below to verify your email address and activate your ReviewLenzAI account.
            This link expires in 24 hours.
          </p>
          <a href="{verify_url}"
             style="display:inline-block;margin-top:24px;padding:12px 24px;background:#0071e3;
                    color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
            Verify email
          </a>
          <p style="margin-top:32px;font-size:12px;color:#999">
            If you didn't create an account, you can safely ignore this email.
          </p>
        </div>
        """,
    )


def send_welcome_email(to: str) -> None:
    _send(
        to=to,
        subject="Welcome to ReviewLenzAI",
        html=f"""
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">Welcome to ReviewLenzAI</h1>
          <p style="color:#555;line-height:1.6">
            Your account is ready. Connect a GitHub repository, pick an open pull request,
            and get structured AI code review findings ranked by severity — in seconds.
          </p>
          <a href="{settings.app_url}"
             style="display:inline-block;margin-top:24px;padding:12px 24px;background:#0071e3;
                    color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
            Open ReviewLenzAI
          </a>
          <p style="margin-top:32px;font-size:12px;color:#999">
            You're receiving this because you signed up at reviewlenzai.vercel.app.
          </p>
        </div>
        """,
    )


def send_review_ready_email(
    to: str,
    pr_title: str,
    pr_number: int,
    repo: str,
    finding_count: int,
    review_url: str,
) -> None:
    findings_text = f"{finding_count} finding{'s' if finding_count != 1 else ''}"
    # pr_title comes straight from the GitHub PR and is written by whoever opened
    # it — anyone with push/PR access to the watched repo, not just this email's
    # recipient — so it must be HTML-escaped before going into an email body.
    safe_pr_title = escape(pr_title)
    safe_repo = escape(repo)
    _send(
        to=to,
        subject=f"Review ready — PR #{pr_number}: {pr_title}",
        html=f"""
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <h1 style="font-size:22px;font-weight:700;margin-bottom:4px">Review complete</h1>
          <p style="color:#555;margin-bottom:24px;line-height:1.6">
            AI review finished for <strong>PR #{pr_number}: {safe_pr_title}</strong>
            in <strong>{safe_repo}</strong>.<br>
            Found <strong>{findings_text}</strong>.
          </p>
          <a href="{review_url}"
             style="display:inline-block;padding:12px 24px;background:#0071e3;
                    color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
            View findings
          </a>
          <p style="margin-top:32px;font-size:12px;color:#999">
            ReviewLenzAI · reviewlenzai.vercel.app
          </p>
        </div>
        """,
    )
