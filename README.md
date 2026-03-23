# Choices Service

A web service that integrates into [KoboToolbox](https://www.kobotoolbox.org/) workflows to manage external choice lists. It provides a webhook API for KoboToolbox to dynamically add/remove choice options, plus a full web UI for manual management.

**Live:** `choices.imtools.info`

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Data Models](#data-models)
- [API Reference](#api-reference)
  - [KoboToolbox Integration Endpoints](#kobotoolbox-integration-endpoints)
  - [Management REST API](#management-rest-api)
  - [Authentication API](#authentication-api)
- [Features](#features)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Environment Variables](#environment-variables)
- [Django Admin](#django-admin)

---

## Architecture

```
Browser / KoboToolbox
        │
        ▼
   Nginx (port 80)
   ├── /api/*                    → Django (Gunicorn :8000)
   ├── /admin/*                  → Django (Gunicorn :8000)
   ├── /static/*                 → Django / WhiteNoise
   ├── /{user}/{id}/*/export/*   → Django (CSV export for KoboToolbox)
   ├── /{user}/{id}/*/add        → Django (KoboToolbox webhook)
   ├── /{user}/{id}/*/remove     → Django (KoboToolbox soft-delete webhook)
   ├── /{user}/{id}/*/delete     → Django (KoboToolbox hard-delete webhook)
   └── /*                        → React SPA (served from Nginx)
```

The frontend is a React SPA bundled by Vite and served as static files by Nginx. The backend is Django + DRF behind Gunicorn. SQLite is used for persistence (stored in a Docker named volume in production).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | Django 4.2 + Django REST Framework 3.14 |
| Backend server | Gunicorn |
| Static files | WhiteNoise |
| Database | SQLite (via Docker named volume) |
| Frontend framework | React 19 + TypeScript |
| Frontend bundler | Vite |
| Frontend styling | Tailwind CSS 4 |
| Frontend HTTP | Axios |
| Frontend state | Zustand |
| Frontend routing | React Router 7 |
| Frontend drag-and-drop | @dnd-kit/core + @dnd-kit/sortable |
| Reverse proxy | Nginx |
| Containerisation | Docker + Docker Compose |

---

## Data Models

```
Project
├── slug              (unique, e.g. "aQQv2xc99EodN8pB8GZ6Jq" — matches KoboToolbox project ID)
├── name
├── description
└── owner             (FK → User)

ChoiceList
├── project           (FK → Project)
├── slug              (e.g. "fruits"; unique within project)
├── name
├── description
├── label_column_name (CSV export header for label; default "label"; e.g. "label::English (en)")
├── name_generation   ("uuid" | "from_label"; controls how choice values are auto-generated)
└── name_max_length   (max length for from_label names; 0 = no limit)

ChoiceListColumn      (extra named columns attached to a ChoiceList)
├── choice_list       (FK → ChoiceList)
├── name              (column identifier)
└── order

  System columns (created lazily, cannot be renamed/deleted):
    "removed"   — soft-delete flag; "true"/"false"
    "protected" — prevents soft-delete via webhook; "true"/"false"
    "pin"       — pins choice to bottom of list when new choices arrive; "true"/"false"

ChoiceExtraValue      (sparse: one row per choice × column pair with a value)
├── choice            (FK → Choice)
├── column            (FK → ChoiceListColumn)
└── value

Choice
├── choice_list       (FK → ChoiceList)
├── value             (short UUID or label-derived slug — the XLSForm "name" column)
├── label             (human-readable; unique within list)
└── order
```

---

## API Reference

### KoboToolbox Integration Endpoints

These endpoints require no authentication and are called directly by KoboToolbox.
All URLs are scoped to a **username** so each user's projects are isolated.

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/{username}/{project_id}/{list_name}/export/{filename}.csv` | Download choice list as CSV |
| `POST` | `/{username}/{project_id}/{list_name}/add` | Add a choice (idempotent; re-activates soft-deleted choices) |
| `POST` | `/{username}/{project_id}/{list_name}/remove` | Soft-delete a choice by value/ID |
| `POST` | `/{username}/{project_id}/{list_name}/delete` | Hard-delete a choice by value/ID |

**CSV export** includes all extra columns (including system columns). The label header respects the `label_column_name` setting on the choice list.

**Add/Remove/Delete request body** — send JSON with any key; the first value is used as the label (add) or choice value/ID (remove/delete):
```json
{ "name": "Joshua Beretta" }
```
`content-type: text/plain` with a JSON body is also accepted (KoboToolbox compatibility).

**Add response:**
```json
{
  "success": true,
  "message": "Choice added successfully",
  "choice_id": "sgdgbs324",
  "value": "Joshua Beretta"
}
```

When a new choice is added via the webhook, all non-pinned choices in the list are re-sorted alphabetically. Pinned choices (`pin=true`) remain at the bottom of the list in their existing order.

**Remove response (soft-delete):**
```json
{ "success": true, "message": "Choice marked as removed", "value": "sgdgbs324" }
```
Protected choices (`protected=true`) return `403 Forbidden` when a remove is attempted.

**Delete response (hard-delete):**
```json
{ "success": true, "message": "Choice deleted", "value": "sgdgbs324" }
```

All webhook endpoints are idempotent — duplicate requests return `success: true`.

---

### Management REST API

Base path: `/api/` — requires session authentication (see [Authentication API](#authentication-api) below). All data is scoped to the authenticated user; each ViewSet filters by `owner=request.user`.

#### Projects

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/api/projects/` | List all projects |
| `POST` | `/api/projects/` | Create a project |
| `GET` | `/api/projects/{slug}/` | Get a project |
| `PATCH` | `/api/projects/{slug}/` | Update a project |
| `DELETE` | `/api/projects/{slug}/` | Delete a project |

#### Choice Lists

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/api/choice-lists/` | List all choice lists (annotated with `choices_count`) |
| `GET` | `/api/choice-lists/?project_slug=<slug>&slug=<slug>` | Filter by project and/or list slug |
| `POST` | `/api/choice-lists/` | Create a choice list |
| `GET` | `/api/choice-lists/{id}/` | Get a choice list with full choices and columns |
| `PATCH` | `/api/choice-lists/{id}/` | Update a choice list (name, description, label_column_name, name_generation, name_max_length) |
| `DELETE` | `/api/choice-lists/{id}/` | Delete a choice list |
| `GET` | `/api/choice-lists/{id}/export/` | Download choice list as CSV (attachment) |
| `POST` | `/api/choice-lists/{id}/import/` | Replace all choices from an uploaded CSV (multipart `file` field) |
| `POST` | `/api/choice-lists/{id}/choices/` | Add a new choice (auto-generates value) |
| `POST` | `/api/choice-lists/{id}/reorder/` | Bulk-update choice order: `[{id, order}, ...]` |
| `POST` | `/api/choice-lists/{id}/add_column/` | Add an extra column: `{name}` |
| `PATCH` | `/api/choice-lists/{id}/update_column/` | Rename an extra column: `{column_id, name}` |
| `DELETE` | `/api/choice-lists/{id}/remove_column/` | Delete an extra column: `{column_id}` |

#### Choices

| Method | URL | Description |
|--------|-----|-------------|
| `PATCH` | `/api/choices/{id}/` | Update a choice (label, value, order) |
| `DELETE` | `/api/choices/{id}/` | Hard-delete a choice |
| `PATCH` | `/api/choices/{id}/set_extra_value/` | Set a column value: `{column_id, value}` |

All list endpoints return paginated responses:
```json
{
  "count": 42,
  "next": "/api/projects/?page=2",
  "previous": null,
  "results": [...]
}
```

#### CSV Import format

- Required columns: `name` (or `value`) and `label` (or any `label::*` XLSForm translation column)
- Auto-detects delimiter (comma, semicolon, tab, pipe) — Excel semicolon exports are handled automatically
- Extra columns beyond the standard set are automatically created as `ChoiceListColumn` rows
- Reserved column names (`name`, `value`, `label`, `removed`, `protected`, `pin`) cannot be used for custom columns
- System column values in the CSV (`removed`, `protected`, `pin`) are preserved; missing values default to `false`
- All existing choices are replaced on import

---

### Authentication API

Session-based authentication. Users are created via Django admin only — there is no public signup.

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/api/auth/csrf/` | Seed the CSRF cookie (call on app load / login page mount) |
| `POST` | `/api/auth/login/` | Login: `{username, password}` → `{id, username}` |
| `POST` | `/api/auth/logout/` | Logout |
| `GET` | `/api/auth/me/` | Get current user: `{id, username}` |
| `POST` | `/api/auth/change-password/` | Change password: `{old_password, new_password}` |

A `401` response from any authenticated endpoint automatically redirects the browser to `/login`.

---

## Features

### Choice value / name generation

Each choice list has a `name_generation` setting that controls how the XLSForm `name` (value) column is populated when a new choice is created:

| Mode | Behaviour |
|------|-----------|
| `uuid` (default) | Random 9-character short UUID (e.g. `sgdgbs324`) |
| `from_label` | Derived from the label: lowercased, spaces → `_`, non-alphanumeric characters stripped, then truncated to `name_max_length` (if set). Uniqueness is guaranteed with a `_2`, `_3` suffix. |

### System columns

Three special `ChoiceListColumn` rows are created lazily on the first detail view or choice creation:

| Column | Values | Behaviour |
|--------|--------|-----------|
| `removed` | `true` / `false` | Soft-delete flag. `true` rows are included in CSV exports but can be filtered out in KoboToolbox. The `/add` webhook re-activates soft-deleted choices instead of creating duplicates. |
| `protected` | `true` / `false` | Blocks soft-deletion via the `/remove` webhook (returns `403`). The hard-delete button in the UI is hidden for protected choices (replaced with a 🔒 badge). |
| `pin` | `true` / `false` | Pinned choices are sorted to the bottom of the list and exempt from alphabetical re-sorting when new choices arrive via the `/add` webhook. |

System columns are rendered as checkboxes (toggle) in the UI and cannot be renamed or deleted.

### Extra columns

Arbitrary extra columns can be added to any choice list. Each column is a `ChoiceListColumn` row; values are stored as `ChoiceExtraValue` rows (sparse — missing row means blank value).

- Click a column header to rename it inline
- Click the ✕ button in the header to delete a column (and all its values)
- Click "+ column" in the table header row to add a new column
- Cell values are edited inline by clicking

Extra columns are included in both the management CSV export and the KoboToolbox CSV export.

### Drag-to-reorder

Choices can be reordered by dragging rows. Sorting by label or value persists the order to the backend. Manual drag clears the sort indicator.

### Configurable label column name

The CSV `label` header can be customised per list (e.g. `label::English (en)` for XLSForm multi-language forms). This affects both the management export and the KoboToolbox CSV export.

---

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- (Optional) Docker & Docker Compose for running the full stack locally

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
# Create backend/.env — see Environment Variables section

# Run migrations and start dev server
python manage.py migrate
python manage.py createsuperuser   # required for login
python manage.py runserver
```

The backend will be available at `http://localhost:8000`.

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies /api to localhost:8000 via Vite config)
npm run dev
```

The frontend will be available at `http://localhost:5173`.

> **Note:** The Vite dev server proxies `/api`, `/admin`, and `/static` to `http://localhost:8000` so both servers can run together during development.

### Linting & Type Checking

```bash
# Frontend
cd frontend
npm run lint
npx tsc --noEmit

# Backend
cd backend
python manage.py check
```

### Running Tests

```bash
# Backend unit tests
cd backend
python manage.py test

# Backend API tests
python test_api.py

# Integration tests (requires both servers running or Docker stack)
cd ..
python test_integration.py
```

---

## Production Deployment

### Docker Compose (recommended)

```bash
# 1. Clone the repository
git clone <repo-url>
cd choices

# 2. Create the backend environment file
# Create backend/.env — see Environment Variables section

# 3. Build and start all services
docker compose up -d --build

# 4. Create a Django superuser (first deploy only)
docker compose exec backend python manage.py createsuperuser
```

The application will be available on `http://localhost:8080` (bound to `127.0.0.1` only). Put a TLS-terminating reverse proxy (e.g. Caddy or Nginx) in front for HTTPS.

### Example Caddy config (external HTTPS proxy)

```
choices.imtools.info {
    reverse_proxy localhost:8080
}
```

### Updating

```bash
git pull
docker compose up -d --build
```

Migrations run automatically on container start via `entrypoint.sh`.

### Scaling / Notes

- SQLite is stored in a Docker named volume (`sqlite_data`) — it persists across container restarts and rebuilds.
- For higher write concurrency, migrate to PostgreSQL by updating `DATABASES` in `settings.py` and adding a `postgres` service to `docker-compose.yml`.
- The Nginx container serves the pre-built React SPA; no Node.js runtime is needed in production.

---

## Environment Variables

Create `backend/.env` with the following variables:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SECRET_KEY` | Yes | Django secret key (keep secret, never reuse dev key in prod) | `django-insecure-...` |
| `DEBUG` | Yes | Enable Django debug mode. **Must be `False` in production.** | `False` |
| `ALLOWED_HOSTS` | Yes | Comma-separated list of allowed host/domain names | `choices.imtools.info,localhost` |

**Development `.env`:**
```env
SECRET_KEY=django-insecure-replace-me
DEBUG=True
ALLOWED_HOSTS=*
```

**Production `.env`:**
```env
SECRET_KEY=<long-random-string>
DEBUG=False
ALLOWED_HOSTS=choices.imtools.info
```

Generate a secure `SECRET_KEY`:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

---

## Django Admin

The Django admin interface is available at `/admin/`. Create a superuser to access it:

```bash
# Local development
python manage.py createsuperuser

# Docker production
docker compose exec backend python manage.py createsuperuser
```

From the admin you can manage Projects, Choice Lists, Choices, Columns, and Users.

> **User management:** There is no public signup. All users must be created via the Django admin. Each user sees only their own projects and choice lists. Assign `owner` on any existing projects with a `NULL` owner via the admin after creating a user account.
