# CareerPipeline

A job application tracker with a CRM-style Kanban board: columns are your pipeline stages
(Wishlist, Applied, Interviewing, Offer, Rejected) and each card is a job application.

**Stack:** Django · Django REST Framework · SimpleJWT · PostgreSQL · drf-spectacular ·
pytest · ruff (backend) — React · TypeScript · Vite · Tailwind · TanStack Query · dnd-kit (frontend).

> Work in progress — see [PLAN.md](PLAN.md) for the roadmap and live progress.

## Repository layout

```
backend/    Django REST API (accounts = auth, pipeline = stages/companies/applications)
frontend/   React + TypeScript single-page app (Vite, Tailwind, TanStack Query, dnd-kit)
PLAN.md     Plan, decisions and progress
```

## Backend — local setup (Windows / PowerShell)

Requirements: Python 3.12+ and PostgreSQL 14+ (no Docker needed).

### 1. Create the PostgreSQL role and database

Run once, as the `postgres` superuser (you will be prompted for its password). Pick your own
password for the app role:

```powershell
psql -U postgres -c "CREATE ROLE career_user LOGIN PASSWORD 'choose-a-password' CREATEDB;"
psql -U postgres -c "CREATE DATABASE careerpipeline OWNER career_user;"
```

`CREATEDB` lets pytest create and drop its own `test_careerpipeline` database.
If the role already exists, use `ALTER ROLE career_user PASSWORD '...' CREATEDB;` instead.

### 2. Install and configure

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env      # then edit .env: SECRET_KEY and DB_PASSWORD at least
```

All configuration comes from environment variables (see `backend/.env.example`). `.env` is
git-ignored and must never be committed.

### 3. Migrate, seed, run

```powershell
python manage.py migrate
python manage.py seed_demo       # demo account + sample board; safe to re-run (it resets it)
python manage.py runserver
```

- API: <http://localhost:8000/api/>
- Interactive docs (Swagger UI): <http://localhost:8000/api/docs/> — raw schema at `/api/schema/`
- Demo login: the `DEMO_EMAIL` / `DEMO_PASSWORD` from `.env`
  (defaults `demo@careerpipeline.dev` / `DemoPipeline2026!`)
- Django admin: create an admin with `python manage.py createsuperuser`

### 4. Tests and lint

```powershell
pytest                 # needs the CREATEDB privilege from step 1
ruff check .
ruff format --check .
```

## Frontend — local setup

Requirements: Node 20+ (developed on Node 24) and the backend running on port 8000.

```powershell
cd frontend
npm install
Copy-Item .env.example .env      # VITE_API_URL and the demo credentials
npm run dev                      # http://localhost:5173
```

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm test` | Unit and component tests (Vitest + Testing Library) |
| `npm run lint` | oxlint |
| `npm run build` | Type-check and production build into `dist/` |
| `npm run format` | Prettier |

What the app does:

- **Auth:** log in, register, or press **Try the demo**. The access token lives in memory only; on
  every page load the app silently asks `/api/auth/refresh/` for a new one using the httpOnly cookie.
- **Board:** one column per stage; drag cards between and within columns (mouse, touch with a short
  press, or keyboard: Space to pick up, arrow keys to move, Space to drop). The board updates
  immediately and rolls back with an error message if the server refuses the move.
- **Pipeline settings:** add, rename, delete and reorder stages. Deleting a stage that still has
  applications shows the server's explanation instead of deleting.
- **Applications:** add (existing or new company), edit, delete. Click a card for a details pane
  (beside the board on laptops, full screen on phones) with the description, listing link, date and
  the company's notes.
- **Companies:** edit notes and delete companies that have no applications.

## API overview

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register/` | Create an account (email + password, validated by Django's password validators) |
| POST | `/api/auth/login/` | Returns `{access}`; sets the refresh token as an httpOnly cookie |
| POST | `/api/auth/refresh/` | Reads the cookie, rotates it, returns a new `{access}` |
| POST | `/api/auth/logout/` | Blacklists the refresh token and clears the cookie |
| GET | `/api/auth/me/` | Current user |
| CRUD | `/api/stages/` | Pipeline stages (new stages are appended at the end) |
| POST | `/api/stages/reorder/` | `{"stage_ids": [...]}` — the complete list of your stage ids in the new order |
| CRUD | `/api/companies/` | Companies |
| CRUD | `/api/applications/` | Applications; the list comes back in board order (column, then position) |
| PATCH | `/api/applications/{id}/move/` | `{"stage": id, "position": n}` — moves a card and re-sequences both columns |

Every request except register/login/refresh/logout needs `Authorization: Bearer <access>`.

**Errors** always look like `{"error": {"code": "...", "message": "...", "details": {...}}}`.
Validation problems use `validation_error` (field messages in `details`); blocked deletes
return **409** with `stage_not_empty` or `company_in_use`.

**Creating an application** takes exactly one of `company` (id of an existing company) or
`company_name` (finds your company with that name, or creates it). Responses include both
`company` (id) and a nested `company_detail`.

## Design decisions

- **Custom user model from the first migration** — email is the login field; there is no username.
- **Tenant isolation by construction** — every viewset filters by `request.user`, `user` is set
  server-side and never read from the client, and every foreign-key field only accepts objects the
  caller owns (`OwnedPrimaryKeyRelatedField`). Another user's ids return 404 or a validation error.
  `tests/test_isolation.py` checks this for every model.
- **Deleting is blocked, not cascaded** — a stage or company that still has applications cannot be
  deleted (`on_delete=PROTECT` → 409), so a click can never silently destroy applications.
- **Positions are managed by the server** — cards change column or order only through the move
  endpoint, which runs in a transaction with row locks and keeps positions contiguous (0..n-1).
- **No pagination** — one person's board is small and the Kanban needs all of it at once.
- **Refresh token in an httpOnly cookie** — JavaScript only ever holds the 5-minute access token.

### Cookie, CORS and token settings

| Setting (env var) | Local development | Production (Vercel → Render, cross-site) |
|---|---|---|
| `REFRESH_COOKIE_SAMESITE` | `Lax` | `None` |
| `REFRESH_COOKIE_SECURE` | `False` | `True` (required with `SameSite=None`) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | the exact Vercel origin(s) |
| `CORS_ALLOW_CREDENTIALS` | always `True` | always `True` |

The cookie is `HttpOnly`, scoped to `Path=/api/auth/`, and the refresh token rotates on every use
(the previous one is blacklisted). Access tokens last 5 minutes, refresh tokens 7 days.

CSRF note: the cookie is only sent to the `/api/auth/` endpoints. A cross-site page can trigger a
refresh request, but CORS stops it from reading the response, so it never obtains the access token;
all other endpoints authenticate with the `Authorization` header, which browsers don't attach
automatically.
