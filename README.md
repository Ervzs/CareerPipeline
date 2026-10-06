# CareerPipeline

[![CI](https://github.com/Ervzs/CareerPipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/Ervzs/CareerPipeline/actions/workflows/ci.yml)

A job application tracker with a CRM-style Kanban board. Each column is a stage of your search
(Wishlist, Applied, Interviewing, Offer, Rejected, or your own), and each card is an application.
Drag cards between stages, keep notes on every company, and see where your search stands.

**Try it locally:** follow the setup below, run `python manage.py seed_demo`, then press **Try the
demo** on the login page. The demo account (`demo@careerpipeline.dev` / `DemoPipeline2026!`) comes
with a ready-made board.

![The board](docs/screenshots/board.png)

|  |  |
|---|---|
| ![Application details](docs/screenshots/details.png) | ![Pipeline settings](docs/screenshots/settings.png) |
| Details pane beside the board, with company notes and the activity timeline | Add, rename, delete and reorder stages |

![The dashboard](docs/screenshots/dashboard.png)

On a phone the board scrolls sideways and the details cover the screen:

<img src="docs/screenshots/board-mobile.png" alt="The board on a phone" width="260">

## Highlights

- **Full stack, end to end:** a PostgreSQL schema with migrations, a Django REST API, a React and
  TypeScript app, automated tests and CI.
- **Security-minded authentication:** a short-lived access token kept in memory, a rotating refresh
  token in an httpOnly cookie, blacklisting on logout, and CORS with credentials.
- **Multi-user data isolation:** every query is scoped to the signed-in user and every foreign key is
  validated, with tests for each model.
- **Data integrity:** transactions and row locks keep card order consistent, and stages or companies
  that are in use cannot be deleted by accident.
- **Polished interface:** optimistic drag and drop with rollback, loading, empty and error states,
  keyboard and screen-reader support, and a layout that works from phone to laptop.
- **Tested and checked:** 145 backend and 76 frontend tests, plus lint, formatting and type checks
  on every push.

## What it does

- **Kanban board** with drag and drop between and within columns (mouse, touch, or keyboard).
  Moves apply instantly and roll back with an explanation if the server refuses them.
- **Your own pipeline:** add, rename, reorder and delete stages. A stage that still holds
  applications can't be deleted, and the app explains why.
- **Applications and companies:** create an application for an existing company or a new one in the
  same step; edit and delete both. A company with applications can't be deleted.
- **Details pane:** description, listing link, date applied and the company's notes.
- **Activity timeline:** log calls, interviews and follow-ups on each application, with the time
  they happened; edit or delete them later.
- **Dashboard:** applications per stage, applications per week (last 12 weeks) and a response rate,
  all computed in the database.
- **Accounts:** register, log in, or try the demo. Every user only ever sees their own data.

## Architecture

```mermaid
flowchart LR
    Browser["Browser<br/>React SPA"]
    API["Django REST API"]
    DB[("PostgreSQL")]
    GHA["GitHub Actions<br/>CI on every push"]

    Browser -- "JSON over HTTPS<br/>Bearer access token" --> API
    Browser -. "httpOnly refresh cookie<br/>(only sent to /api/auth/)" .-> API
    API -- "psycopg 3" --> DB
    GHA -. "lint, tests, build" .-> API
```

The access token (5 minutes) lives only in JavaScript memory. The refresh token (7 days, rotated on
every use) is an `HttpOnly` cookie that scripts can't read, so on every page load the app silently
trades the cookie for a fresh access token.

## Data model

```mermaid
erDiagram
    USER ||--o{ PIPELINE_STAGE : owns
    USER ||--o{ COMPANY : owns
    USER ||--o{ JOB_APPLICATION : owns
    PIPELINE_STAGE ||--o{ JOB_APPLICATION : "column of"
    COMPANY ||--o{ JOB_APPLICATION : "applied to"
    JOB_APPLICATION ||--o{ APPLICATION_ACTIVITY : "has notes"
    USER ||--o{ APPLICATION_ACTIVITY : owns

    USER {
        int id PK
        string email UK "login"
        string password "hashed"
    }
    PIPELINE_STAGE {
        int id PK
        int user_id FK
        string name "unique per user"
        int order "left to right"
    }
    COMPANY {
        int id PK
        int user_id FK
        string name
        string website
        text notes
    }
    JOB_APPLICATION {
        int id PK
        int user_id FK
        int company_id FK
        int stage_id FK
        string job_title
        text job_description
        string listing_url
        date date_applied "null = wishlist"
        int position "order inside the column"
        datetime created_at
        datetime updated_at
    }
    APPLICATION_ACTIVITY {
        int id PK
        int user_id FK
        int application_id FK
        string kind "call, interview, follow_up, other"
        text note
        datetime occurred_at
        datetime created_at
    }
```

Every row carries `user_id`, the multi-tenancy key. `stage` and `company` use `ON DELETE PROTECT`,
which is what blocks deleting something that is still in use. Activity notes belong to their
application and are deleted with it.

## Tech stack

| Layer | Tools |
|---|---|
| Backend | Python, Django 5.2 LTS, Django REST Framework, SimpleJWT, drf-spectacular (OpenAPI), django-cors-headers, WhiteNoise, gunicorn |
| Database | PostgreSQL through psycopg 3 |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, React Router, dnd-kit |
| Quality | pytest + pytest-django, ruff, Vitest + Testing Library, oxlint, Prettier, GitHub Actions |

## Quality

- **Backend:** 145 pytest tests covering authentication (hashing, cookie flags, rotation, logout and
  blacklisting), default stages, **tenant isolation for every model** (user A can't read, change,
  delete or reference user B's data), card re-sequencing, stage reorder validation, blocked deletes,
  the dashboard numbers, activity notes, the seed command, and the production settings. `ruff check` and `ruff format --check` are clean.
- **Frontend:** 76 Vitest tests covering the API client (token refresh, single-flight retry), auth
  flow, route protection, the board, optimistic move with rollback, every dialog, the dashboard and
  the activity timeline.
- **CI** runs all of it on every push: backend on Python 3.13 and 3.14 against a real PostgreSQL,
  frontend on Node 24.
- The drag gesture, the dashboard, the activity timeline and the responsive layout were also
  exercised in a real browser (Edge) against a running backend. That run caught a real bug (a
  Tailwind 4 build detail that dropped the fifth stage colour), which now has a regression test.

## Repository layout

```
backend/            Django REST API (accounts = auth, pipeline = stages/companies/applications)
frontend/           React + TypeScript single-page app
extension/          Chrome/Edge/Brave extension that saves jobs you apply to
docs/screenshots/   Images used in this README
.github/workflows/  CI: lint, tests and build on every push
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

Keyboard dragging: Space picks a card up, the arrow keys move it, Space drops it, Escape cancels.
Enter opens the card's details. On touch screens, press and hold a card briefly to drag it.

## API overview

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register/` | Create an account (email + password, validated by Django's password validators) |
| POST | `/api/auth/login/` | Returns `{access}`; sets the refresh token as an httpOnly cookie |
| POST | `/api/auth/refresh/` | Reads the cookie, rotates it, returns a new `{access}` |
| POST | `/api/auth/logout/` | Blacklists the refresh token and clears the cookie |
| GET | `/api/auth/me/` | Current user |
| POST, DELETE | `/api/auth/extension-token/` | Email + password → a long-lived key for the browser extension; DELETE revokes it |
| CRUD | `/api/stages/` | Pipeline stages (new stages are appended at the end) |
| POST | `/api/stages/reorder/` | `{"stage_ids": [...]}` — the complete list of your stage ids in the new order |
| CRUD | `/api/companies/` | Companies |
| CRUD | `/api/applications/` | Applications; the list comes back in board order (column, then position) |
| POST | `/api/applications/capture/` | Used by the extension: `{listing_url, job_title, company_name?}` → saved to "Applied", dated today; a listing URL you already saved returns that card (200) |
| PATCH | `/api/applications/{id}/move/` | `{"stage": id, "position": n}` — moves a card and re-sequences both columns |
| GET | `/api/dashboard/` | Per-stage counts, applications per week (12 weeks) and the response rate |
| GET, POST | `/api/applications/{id}/activities/` | List an application's activity notes (newest first) or add one |
| GET, PATCH, PUT, DELETE | `/api/activities/{id}/` | Read, edit or delete one note |
| GET | `/api/health/` | Liveness probe (no authentication, no database access) |

Every request except register/login/refresh/logout/health needs `Authorization: Bearer <access>`
(or `Authorization: Token <key>` from the browser extension).

**Errors** always look like `{"error": {"code": "...", "message": "...", "details": {...}}}`.
Validation problems use `validation_error` (field messages in `details`); blocked deletes
return **409** with `stage_not_empty` or `company_in_use`.

**Creating an application** needs `job_title` and `listing_url`. Company is optional: send
`company` (id of an existing company, or `null`) or `company_name` (finds your company with that
name, or creates it), or neither. Responses include both `company` (id) and a nested
`company_detail`; both are `null` when there is no company.

## Browser extension

`extension/` saves jobs to your board as you apply on **LinkedIn, Indeed and JobStreet**.

- When a site shows its "application sent" screen, a small card asks whether to save the job
  (title, company and link are pre-filled and editable).
- When the Apply button sends you to the company's own site, click the extension icon on the job
  page instead and press **Save as applied**. This works on any page.

**Install (Chrome, Edge or Brave):** open `chrome://extensions` (or `edge://extensions`), turn on
**Developer mode**, click **Load unpacked** and pick the `extension/` folder. Click the extension
icon, enter the API URL (`http://localhost:8000` locally, or your Render URL) and your
CareerPipeline email and password.

Saved jobs go to the **Applied** stage (or your first stage if there is none), dated today. Each
listing link is saved only once. Job sites change their pages often: if detection stops working,
update the selectors and phrases in `extension/sites.js` and click reload on `chrome://extensions`.

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
  The frontend predicts the result with a pure function (`moveApplication`) that mirrors those rules,
  which is what makes the optimistic update safe to roll back.
- **No pagination** — one person's board is small and the Kanban needs all of it at once.
- **Refresh token in an httpOnly cookie** — JavaScript only ever holds the 5-minute access token.
- **Dashboard numbers come from SQL aggregations** (`Count`, `TruncWeek`, filtered counts), in three
  queries however many applications there are. Response rate = applications with a date applied that
  now sit in a column after "Applied", divided by all applications with a date applied; it is `null`,
  never a division by zero, when nothing has been applied to yet.
- **One error shape** — the API and the UI agree on `{error: {code, message, details}}`, so forms can
  show field errors and the UI can react to specific codes.

### Cookie, CORS and token settings

| Setting (env var) | Local development | Production (app and API on different sites) |
|---|---|---|
| `REFRESH_COOKIE_SAMESITE` | `Lax` | `None` |
| `REFRESH_COOKIE_SECURE` | `False` | `True` (required with `SameSite=None`) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | the exact frontend origin(s) |
| `CORS_ALLOW_CREDENTIALS` | always `True` | always `True` |

The cookie is `HttpOnly`, scoped to `Path=/api/auth/`, and the refresh token rotates on every use
(the previous one is blacklisted). Access tokens last 5 minutes, refresh tokens 7 days.

CSRF note: the cookie is only sent to the `/api/auth/` endpoints. A cross-site page can trigger a
refresh request, but CORS stops it from reading the response, so it never obtains the access token;
all other endpoints authenticate with the `Authorization` header, which browsers don't attach
automatically.

**Known limits:** browsers that block third-party cookies (Safari, Brave) won't keep a cross-site
refresh cookie, so when the app and API are on different sites those users have to log in again
after a reload; serving both from one domain, or proxying the API through the frontend host, avoids
it. And because refresh tokens rotate, closing the tab at the exact moment a refresh is in flight
can force a new login.
