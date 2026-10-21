# ReviewLenzAI

> AI-powered GitHub pull request reviews sign in with GitHub or Google, browse your repos, pick a PR, get structured findings ranked by severity.

**[reviewlenzai.vercel.app](https://reviewlenzai.vercel.app)**

![CI](https://github.com/ApparentlyTejas/ReviewLenzAI/actions/workflows/ci.yml/badge.svg)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?logo=postgresql&logoColor=white)

---

## What it does

ReviewLenzAI connects to your GitHub account via OAuth and runs LLM-powered code reviews on open pull requests. Sign in with GitHub or Google, browse all your repos directly in the dashboard, select an open PR and in about 20 seconds you get a full breakdown of every issue: what's broken, what's a security hole, and what's just sloppy. Ranked by severity. No token pasting. No manual setup.

It fetches the raw diff, sends it through Groq's Llama 3.3 70B with a structured tool-call schema, and stores every finding categorised, ranked, and persisted so you can track review history across all your projects.

No free-form text. No hallucinated line numbers. Structured JSON output enforced by Pydantic at the boundary.

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
    Backend->>Groq: diff + tool-call schema (Llama 3.3 70B)
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
    ┌────┼──────────┐
    ▼    ▼          ▼
 Neon  GitHub    Groq API
  DB    API    Llama 3.3 70B
```

The Vercel → Render proxy keeps auth cookies first-party and eliminates CORS entirely.

---

## Tech stack

| Layer | Choices |
|---|---|
| **Frontend** | React 19 · TypeScript · Vite · TanStack Query · Framer Motion · React Router v6 |
| **Backend** | FastAPI · SQLAlchemy 2 · Pydantic v2 · python-jose · passlib |
| **Auth** | GitHub OAuth · Google OAuth · JWT · bcrypt · Fernet symmetric encryption |
| **Database** | PostgreSQL via Neon (serverless, free tier) |
| **LLM** | Groq API `llama-3.3-70b-versatile` · `temperature=0.1` · structured tool-calling |
| **Email** | Brevo transactional email |
| **Security** | HttpOnly cookies · Fernet-encrypted OAuth tokens · bcrypt · JWT · SlowAPI rate limiting · security headers |
| **CI/CD** | GitHub Actions: ruff + mypy + pytest-cov (backend), oxlint + tsc + vitest-cov (frontend) on every push |
| **Deploy** | Vercel (frontend) · Render (API) · Neon (Postgres) |

---

## Features

- **GitHub & Google OAuth** one-click sign-in; no passwords required (or use email + password with strength enforcement)
- **Repo browser** browse all your GitHub repos directly in the dashboard; private repos included, zero token pasting
- **Custom PR picker** searchable dropdown lists all open PRs for the selected repo
- **Structured LLM output** findings are typed JSON (file, line, severity, category, message, fix), never paragraphs
- **Consistent reviews** LLM runs at `temperature=0.1` with an enforced output schema to minimise hallucinations
- **Severity ranking** critical → high → medium → low, with visual indicators and a severity breakdown bar
- **Full history** every review run is stored; browse all past findings per repo
- **Dashboard** stat cards, activity feed, and per-repo review history
- **Multi-user** each user only sees their own repos and reviews
- **Password strength enforcement** 8+ chars, uppercase, lowercase, number, special character required at registration

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

Backend (34 tests, 70% coverage) covers auth flows, project ownership isolation, GitHub service (mocked), LLM service (mocked), and the dashboard endpoint. Frontend (48 tests) covers every `src/api/*.ts` client function (success + error paths, including the 401 session-expiry interceptor) and the `usePageTitle` hook at 100%, plus the Login page's submit/error/unverified-resend flows — `src/lib/severity.ts` is still the only pure-utility file covered beyond that. Broader page/component coverage (`ProjectList`, `ReviewDetail`, `Register`, the auth context itself) is a known gap, not something CI is pretending to check.

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
