# Choices Service

A web service that integrates into [KoboToolbox](https://www.kobotoolbox.org/) workflows to manage external choice lists. It provides a REST API for KoboToolbox to dynamically add/remove choice options, plus a web UI for manual management.

**Live:** `choices.imtools.info`

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Data Models](#data-models)
- [API Reference](#api-reference)
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
   ├── /api/*          → Django (Gunicorn :8000)
   ├── /admin/*        → Django (Gunicorn :8000)
   ├── /static/*       → Django / WhiteNoise
   ├── /<id>/*.csv     → Django (CSV export)
   ├── /<id>/*/add     → Django (KoboToolbox webhook)
   ├── /<id>/*/remove  → Django (KoboToolbox webhook)
   └── /*              → React SPA (served from Nginx)
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
| Reverse proxy | Nginx |
| Containerisation | Docker + Docker Compose |

---

## Data Models

```
Project
├── slug        (unique, e.g. "aQQv2xc99EodN8pB8GZ6Jq" — matches KoboToolbox project ID)
├── name
├── description
└── owner       (FK → User, optional)

ChoiceList
├── project     (FK → Project)
├── slug        (e.g. "fruits")
├── name
└── description

Choice
├── choice_list (FK → ChoiceList)
├── value       (short UUID, auto-generated)
├── label       (human-readable, unique within list)
└── order
```

---

## API Reference

### KoboToolbox Integration Endpoints

These endpoints are called directly by KoboToolbox and require no authentication.

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/{project_id}/{list_name}.csv` | Download choice list as CSV (`name,label` columns) |
| `POST` | `/{project_id}/{list_name}/add` | Add a choice (idempotent) |
| `POST` | `/{project_id}/{list_name}/remove` | Remove a choice by label |

**Add/Remove request body** — send JSON with any key containing the label value:
```json
{ "name": "Joshua Beretta" }
```

**Add response:**
```json
{
  "success": true,
  "choice_id": "sgdgbs324",
  "label": "Joshua Beretta",
  "created": true
}
```

### Management REST API

Base path: `/api/` — requires session authentication (login via `/admin/`).

| Resource | Endpoints |
|----------|-----------|
| Projects | `GET/POST /api/projects/` · `GET/PATCH/DELETE /api/projects/{id}/` |
| Choice Lists | `GET/POST /api/choice-lists/` · `GET/PATCH/DELETE /api/choice-lists/{id}/` |
| Choices | `POST /api/choice-lists/{id}/choices/` · `PATCH/DELETE /api/choices/{id}/` |

All list endpoints return paginated responses:
```json
{
  "count": 42,
  "next": "/api/projects/?page=2",
  "previous": null,
  "results": [...]
}
```

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
cp .env.example .env       # or create .env manually (see Environment Variables section)

# Run migrations and start dev server
python manage.py migrate
python manage.py createsuperuser   # optional, for admin access
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
cp backend/.env.example backend/.env
# Edit backend/.env — see Environment Variables section

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

From the admin you can manage Projects, Choice Lists, Choices, and Users.
