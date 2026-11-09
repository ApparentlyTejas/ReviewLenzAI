# ADR 2: Proxy the backend through the frontend's own domain instead of CORS + third-party cookies

## Context

The frontend (`reviewlenzai.vercel.app`) and backend (`ai-code-review-api-00fw.onrender.com`) are two separate deployments on two separate domains. Auth uses an `httponly` session cookie (`auth.py`'s `_set_auth_cookies`), not a bearer token the frontend reads and resends itself. A cookie set by a cross-origin API response is a third-party cookie from the browser's perspective, and Safari/Firefox's default tracking-prevention policies partition or drop third-party cookies, which would silently break login for a chunk of real users, not a CORS error you'd catch in dev on Chrome.

## Decision

`frontend/vercel.json` rewrites `/api/*` on the Vercel domain straight through to the Render backend:

```json
{ "source": "/api/:path*", "destination": "https://ai-code-review-api-00fw.onrender.com/:path*" }
```

The frontend's API client (`frontend/src/api/client.ts`) is configured to call `/api` in production (`VITE_API_BASE_URL=/api`) instead of the Render URL directly. Because the browser only ever talks to `reviewlenzai.vercel.app`, the `Set-Cookie` the backend issues lands as a same-origin, first-party cookie as far as the browser is concerned, and Vercel's edge forwards the request to Render underneath, invisibly to the client. CORS stops being a concern at all for the real traffic path, since the browser never makes a cross-origin request in the first place; `CORS_ORIGINS` in `app/core/config.py` still exists for local dev, where the frontend on `localhost:5173` does call the backend on `localhost:8000` directly.

## Alternatives considered

- **CORS with `credentials: true`, cookie set directly by the Render domain.** Rejected: works in Chrome, breaks in Safari/Firefox the moment their third-party cookie partitioning applies, which is an intermittent, hard-to-reproduce login failure that depends on the user's browser and privacy settings rather than anything the server logs would show clearly.
- **Bearer token in `localStorage`, sent manually on every request (the pattern RoomLock uses).** Rejected for this project specifically because `localStorage` tokens are readable by any script on the page, and a token-reading bug is a strictly worse failure mode than a cookie bug for a tool that stores encrypted GitHub PATs and OAuth tokens per user. A `localStorage` token is a reasonable tradeoff for a simpler API-only project; it's a worse one for an app whose whole job is holding other services' credentials.

## Consequences

- The Vercel rewrite is the only thing standing between "first-party cookie" and "third-party cookie," so changing either domain (a custom domain on the frontend, a different host for the backend) means updating `vercel.json` to match, not just an environment variable.
- Every backend route is reachable at two paths in production depending on which domain hits it (direct Render URL, or proxied through Vercel's `/api/*`); only the proxied path gets the first-party cookie behavior, so the direct Render URL is not meant to be called from a browser session at all, only from non-cookie clients like the webhook sender or `curl`.
