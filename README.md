# ReviewLenzAI

> AI-powered GitHub pull request reviews. Sign in with GitHub or Google, browse your repos, pick a PR, get structured findings ranked by severity.

**[reviewlenzai.vercel.app](https://reviewlenzai.vercel.app)**

![CI](https://github.com/ApparentlyTejas/ReviewLenzAI/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.130-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?logo=postgresql&logoColor=white)

![ReviewLenzAI landing page](docs/screenshots/landing.png)

---

## What it does

ReviewLenzAI connects to your GitHub account via OAuth and runs LLM-powered code reviews on open pull requests. Sign in with GitHub or Google, browse all your repos directly in the dashboard, select an open PR, and in about 20 seconds you get a full breakdown of every issue: what's broken, what's a security hole, and what's just sloppy. Ranked by severity. No token pasting, no manual setup.

It fetches the raw diff, sends it through an LLM on Groq with a structured tool-call schema, and stores every finding categorised, ranked, and persisted so you can track review history across every project your team connects.

No free-form text, no hallucinated line numbers. Structured JSON output enforced by Pydantic at the boundary.

Projects belong to an organization, not a single account, so a team can share review history, invite teammates with owner/admin/member roles, and keep working after one person leaves. GitHub webhooks can also trigger a review automatically on every PR push, with the findings posted back as a PR comment.

<details>
<summary>More screenshots (login, repo picker)</summary>

![Login page](docs/screenshots/login.png)

</details>

---

## How a review works

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant GitHub
    participant Groq

    User->>Frontend: Sign in with GitHub OAuth
    Frontend->>Backend: POST /auth/github/login (code)
    Backend->>GitHub: Exchange code → access token
    GitHub-->>Backend: OAuth access token (stored encrypted)
    User->>Frontend: Browse repos, select open PR
    Frontend->>Backend: POST /reviews (pr_number)
    Backend->>GitHub: GET /repos/{owner}/{repo}/pulls/{n} (OAuth token)
    GitHub-->>Backend: PR metadata + diff URL
    Backend->>GitHub: GET diff
    GitHub-->>Backend: Unified diff
    Backend->>Groq: diff + tool-call schema
    Groq-->>Backend: Structured findings JSON
    Backend->>Backend: Validate with Pydantic, persist to Postgres
    Backend-->>Frontend: Review object with findings[]
    Frontend->>User: Findings grouped by severity
```

---

## Architecture

```
reviewlenzai.vercel.app  (React + Vite)
         │
         │  /api/* proxied by Vercel
         ▼
ai-code-review-api.onrender.com  (FastAPI)
         │
    ┌────┼──────────┬──────────────┐
    ▼    ▼          ▼              ▼
 Neon  GitHub    Groq API    GitHub webhooks
  DB    API      (LLM)       (auto-review on push)
```

The Vercel → Render proxy keeps auth cookies first-party and eliminates CORS entirely.

Projects are owned by an **organization**, not a user. Every request resolves its org from an `X-Org-Id` header (falling back to the caller's earliest membership), and an owner/admin/member role on that org gates destructive actions like deleting a project or rotating its webhook secret.

---

## Tech stack

| Layer | Choices |
|---|---|
| **Frontend** | React 19 · TypeScript · Vite · TanStack Query · Framer Motion · React Router v7 |
| **Backend** | FastAPI · SQLAlchemy 2 · Alembic · Pydantic v2 · python-jose · passlib |
| **Auth** | GitHub OAuth · Google OAuth · JWT · bcrypt · Fernet symmetric encryption |
| **Multi-tenancy** | Organizations and memberships with owner/admin/member roles |
| **Database** | PostgreSQL via Neon (serverless, free tier) |
| **LLM** | Groq API `qwen/qwen3.8-27b`, `temperature=0.1`, structured tool-calling |
| **Email** | Brevo transactional email |
| **Security** | HttpOnly cookies · Fernet-encrypted OAuth/PAT tokens · bcrypt · JWT · SlowAPI rate limiting · security headers |
| **CI/CD** | GitHub Actions: ruff + mypy + pytest-cov (backend), oxlint + tsc + vitest-cov (frontend) on every push, plus Dependabot |
| **Deploy** | Vercel (frontend) · Render (API) · Neon (Postgres) |

---

## Features

- **GitHub & Google OAuth** one-click sign-in, no passwords required (or use email + password with strength enforcement)
- **Repo browser** browse all your GitHub repos directly in the dashboard, private repos included, zero token pasting
- **Custom PR picker** searchable dropdown lists all open PRs for the selected repo
- **Structured LLM output** findings are typed JSON (file, line, severity, category, message, fix), never paragraphs
- **Consistent reviews** LLM runs at `temperature=0.1` with an enforced output schema to minimise hallucinations
- **Severity ranking** critical, high, medium, low, with visual indicators and a severity breakdown bar
- **Teams and roles** projects belong to an organization; invite teammates as owner, admin, or member, with destructive actions (delete, webhook rotation, settings) gated to managers
- **GitHub webhooks** opt in per project to trigger a review automatically on every push to an open PR, with findings posted back as a PR comment
- **Review deltas** re-running a review on an updated PR shows what changed since the last run: new findings, resolved findings, and what's still open
- **Full history** every review run is stored and browsable per repo, including a findings-trend chart over time and a soft-delete "recently deleted" view with a 30-day recovery window
- **Dashboard** stat cards, activity feed, and per-repo review history
- **Ask about a review** streaming chat grounded in that PR's diff and findings, ask follow-up questions, jump straight to a specific finding with one click
- **Ask about your repos** a second chat on the dashboard, grounded across every connected repo's reviews and findings, for questions that span more than one PR
- **On-topic guardrail** both chats run every question through a cheap classifier call first; off-topic questions get redirected instead of burning a full completion, and the guard fails open if the classifier call itself errors
- **Delete & sort** remove a repo or a stale review; sort review history by date/status/finding count and repos by name or recency
- **Password strength enforcement** 8+ chars, uppercase, lowercase, number, special character required at registration

---

## What's technically interesting here

A few things that were harder than they look from the feature list:

- **Multi-tenancy migrated in place, not designed in from day one.** Projects originally belonged to a user; moving ownership to an organization meant a backfilling Alembic migration that creates a personal org per existing user, reassigns every project, drops the old column, and still has to be idempotent against a deploy that crashes halfway through and retries, since that's exactly what happened the first time it ran in production. The migration checks table/column existence with `sa.inspect()` before creating anything, so a retry picks up where the crash left off instead of failing on a duplicate.
- **A production login outage traced to a missing migration step**, not a code bug. Auth broke in prod; the real cause was a stale, duplicate `render.yaml` at the repo root whose start command skipped `alembic upgrade head`. Fixed with a one-time `alembic stamp` plus a corrected start command, diagnosed without shell access to the host.
- **The on-topic chat filter is a second, cheap LLM call, not a keyword list.** A classifier call gates the main chat response and is designed to fail open: if the classifier call itself errors, the request proceeds rather than silently blocking a legitimate question.
- **A CSS alignment bug that looked fixed three times before it actually was.** The root cause was two rules setting different properties on the same element at different specificities (a global `label { flex-direction: column }` beating a more specific class's `display: flex`), which isn't visible from reading the markup. Only confirmed by screenshotting the real compiled page.

---

## Running locally

**Prerequisites:** Python 3.12+, Node 20+, PostgreSQL

```bash
git clone https://github.com/ApparentlyTejas/ai-code-review-assistant.git
cd ai-code-review-assistant
```

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your values
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

**Environment variables (backend `.env`)**

| Variable | How to get it |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg2://user:pass@localhost/ai_code_review` |
| `JWT_SECRET_KEY` | `openssl rand -hex 32` |
| `PAT_ENCRYPTION_KEY` | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) free tier works |
| `GITHUB_CLIENT_ID` | GitHub → Settings → Developer settings → OAuth Apps |
| `GITHUB_CLIENT_SECRET` | Same OAuth App |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → OAuth 2.0 credentials |
| `BREVO_API_KEY` | [brevo.com](https://brevo.com) free tier works |
| `CORS_ORIGINS` | `http://localhost:5173` |
| `APP_URL` | `http://localhost:5173` |

**Environment variables (frontend `.env`)**

| Variable | Value |
|---|---|
| `VITE_GITHUB_CLIENT_ID` | Same as `GITHUB_CLIENT_ID` above |
| `VITE_GOOGLE_CLIENT_ID` | Same as `GOOGLE_CLIENT_ID` above |

---

## Tests

```bash
cd backend && pytest
```

Backend (157 tests, 84% coverage) covers auth flows, org/membership scoping and RBAC, project isolation across organizations, GitHub service (mocked), LLM service (mocked, including the on-topic classifier's allow/block/fail-open paths), and every router. Frontend (117 tests) covers every `src/api/*.ts` client function (success + error paths, including the 401 session-expiry interceptor), shared hooks and utilities, and several page/component flows. Coverage is deliberately uneven on the frontend: API clients and logic-heavy utilities sit near 100%, while large presentational pages are thinner, since the components most likely to hide a real bug are the ones with branching logic, not JSX layout.

---

## Lint, type-check, and coverage locally

Same checks CI runs on every push, if you want to run them before pushing.

**Backend** (from `backend/`, with your `.venv` active)
```bash
pip install -r requirements-dev.txt   # ruff, mypy, pytest-cov, type stubs
ruff check .                          # lint
mypy app                              # type-check
pytest --cov=app --cov-report=term-missing --cov-report=html   # tests + coverage
open htmlcov/index.html               # browse the coverage report
```

**Frontend** (from `frontend/`)
```bash
npm run lint           # oxlint
npm run typecheck      # tsc -b --noEmit
npm run test:coverage  # vitest run --coverage
open coverage/index.html
```

Config lives in `backend/ruff.toml`, `backend/mypy.ini`, and `frontend/.oxlintrc.json` / `frontend/tsconfig.app.json`.

---

## Deploy your own (free)

| Service | What for | Cost |
|---|---|---|
| [Neon](https://neon.tech) | Postgres database | Free forever |
| [Render](https://render.com) | FastAPI backend | Free (sleeps after 15 min idle) |
| [Vercel](https://vercel.com) | React frontend | Free forever |
| [Brevo](https://brevo.com) | Transactional email | Free up to 300 emails/day |

`backend/render.yaml` and `frontend/vercel.json` are included import the repo and set your env vars.

---

Built by [@ApparentlyTejas](https://github.com/ApparentlyTejas)
