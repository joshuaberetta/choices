# Choices Service - Action Plan

## Project Overview
A web service that integrates into KoboToolbox workflows to manage external choice lists. Hosted at `choices.imtools.info`, it provides an REST API for KoboToolbox to dynamically add/remove options, plus a web UI for management.

**Key Endpoints:**
- `GET /{project_id}/{choice_list_name}.csv` - Returns choice list as CSV
- `POST /{project_id}/{choice_list_name}/add` - Add choice option
- `POST /{project_id}/{choice_list_name}/remove` - Remove choice option

**URL Parameter Notes:**
- `{project_id}`: Slug format (alphanumeric + underscores, e.g., `aQQv2xc99EodN8pB8GZ6Jq` from KoboToolbox). Can map to database ID internally for lookup.
- `{choice_list_name}`: Slug format (e.g., `fruits`). Can map to database ID internally for lookup.

---

## §0 — memory.md Convention

`memory.md` lives at the root of the repo and is updated **at the end of every completed phase or major task**. Its purpose is to give a new context window enough information to resume work without re-reading the entire plan.

**When to update:** immediately after all checklist items for a phase are ticked off.

**Format template:**
```md
# Choices — Project Memory
_Last updated: YYYY-MM-DD_

## Current status
- Last completed phase: Phase X — <short title>
- Currently working on: Phase Y — <short title>

## What is implemented
- <bullet per major feature/component already built>

## Key decisions & notes
- <any non-obvious choices made, gotchas, config specifics>

## What's next
- <ordered list of the next concrete tasks to start>

## File/path quick-reference
- <any non-obvious file locations worth noting>
```

Keep entries concise — bullet points only, no prose paragraphs. Overwrite the whole file each time rather than appending.

**Docs to update alongside memory.md:**
- `README.md` — keep the API reference, feature list, and any changed endpoints/config in sync
- `frontend/src/pages/HelpPage.tsx` — update user-facing help text for any new or changed UI features

Both files should be updated in the same commit as the feature work, not as a separate follow-up.

---

## Phase 1: Project Setup & Infrastructure (Foundation)

### 1.1 Project Initialization
- [x] Initialize git repository
- [x] Create Python virtual environment (venv)
- [x] Install Django and dependencies: `pip install django djangorestframework psycopg2-binary python-decouple shortuuid`
- [x] Create requirements.txt with all dependencies
- [x] Run `django-admin startproject choices`
- [x] Create main app: `python manage.py startapp api`
- [x] Set up .gitignore and .env for configuration (python-decouple wired for SECRET_KEY, DEBUG, ALLOWED_HOSTS)
- [x] Run `python manage.py migrate` to initialize database (SQLite for MVP)

### 1.2 Technology Stack
- **Backend Framework:** Django + Django REST Framework (built-in auth, admin, ORM)
- **Database:** SQLite for MVP (quick start), PostgreSQL later for production
- **Backend Authentication:** Django's built-in User model + session auth (admin)
- **API:** Django REST Framework (minimal code, comprehensive features)
- **Frontend Framework:** React 18+ with TypeScript
- **Frontend Bundler:** Vite (fast, modern builds)
- **Frontend Styling:** Tailwind CSS (utility-first, easy to extend)
- **Frontend HTTP:** axios (simple data fetching) + TanStack Query (optional, for caching)
- **Frontend State:** Zustand (lightweight) or React Context (built-in)
- **Frontend Routing:** React Router v6
- **Code Quality:** ESLint, Prettier
- **Containerization:** Docker + Docker Compose (Phase 2)

### 1.3 Project Structure
```
choices/
├── backend/                  (Django project)
│   ├── manage.py
│   ├── choices/              (Django project config)
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── api/                  (Django REST API app)
│   │   ├── migrations/
│   │   ├── models.py         (Project, ChoiceList, Choice)
│   │   ├── views.py          (DRF views for API endpoints)
│   │   ├── serializers.py    (DRF serializers)
│   │   ├── urls.py           (API routes)
│   │   └── admin.py          (Django admin configuration)
│   ├── requirements.txt
│   ├── .env
│   └── db.sqlite3            (SQLite for MVP)
│
├── frontend/                 (React + Vite app)
│   ├── src/
│   │   ├── components/       (React components)
│   │   ├── pages/            (Page components)
│   │   ├── hooks/            (Custom React hooks)
│   │   ├── services/         (API client, axios)
│   │   ├── utils/            (Helpers)
│   │   ├── App.tsx           (Main app component)
│   │   ├── main.tsx          (Entry point)
│   │   └── index.css         (Tailwind imports)
│   ├── public/               (Static assets)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── tailwind.config.js
│
├── docker-compose.yml        (Runs backend + frontend)
├── Dockerfile.backend        (Django)
├── Dockerfile.frontend       (Vite)
└── plan.md
```

---

## Phase 2: Database Models (MVP)

### 2.1 Database Schema - MVP (Simple)
**Models:**
- `User` - Django's built-in User model (no custom code)
- `Project` - name, owner (FK to User), created_at
- `ChoiceList` - name, project (FK), description, created_at
- `Choice` - value, label, choice_list (FK), order
- *(Phase 6 additions: `Project.is_public`, `Project.updated_at`, `ChoiceList.updated_at`, `ProjectShare`)*
- *(Phase 7 additions: `Collection`, `CollectionProject`, `CollectionShare`)*

**Key constraints:**
- Unique constraint: (project, name) for ChoiceList
- User can only see their own projects

### 2.2 Create Django Models
- [x] Define Project model in api/models.py (includes owner FK to User)
- [x] Define ChoiceList model
- [x] Define Choice model
- [x] Register all models in api/admin.py (Django admin handles CRUD)
- [x] Run: `python manage.py makemigrations && python manage.py migrate`
- [ ] Update `README.md` (data models section)
- [ ] Update `HelpPage.tsx` if any user-visible concepts changed
- [ ] Update `memory.md` with current project state (see §0)

---

## Phase 3: REST API for KoboToolbox (MVP)

### 3.1 MVP API Endpoints (Core Only)

**KoboToolbox Integration (Priority):**
- [x] `GET /{project_id}/{choice_list_name}.csv` - Export as CSV
- [x] `POST /{project_id}/{choice_list_name}/add` - Add choice (append mode)
- [x] `POST /{project_id}/{choice_list_name}/remove` - Remove choice (delete mode)

**Web Admin API (for management UI):**
- [x] `GET /api/projects/` - List all projects
- [x] `GET /api/choice-lists/` - List all choice lists
- [x] `GET /api/choice-lists/{id}/` - Get one list with all choices
- [x] `POST /api/choice-lists/` - Create choice list
- [x] `POST /api/choice-lists/{id}/choices/` - Create a choice
- [x] `PATCH /api/choices/{id}/` - Update a choice
- [x] `DELETE /api/choices/{id}/` - Delete a choice

### 3.2 CSV Export Format

**CSV format (plain, no header formatting):**
```
name,label
sgdgbs324,Joshua Beretta
abc12345,Jane Doe
def67890,John Smith
```
- First column: `name` (the short UUID generated by service)
- Second column: `label` (the human-readable text)
- Plain text, no special formatting or quoting (unless needed for commas/newlines)

### 3.3 KoboToolbox Request/Response Format

**Request format (from KoboToolbox):**
```json
{"name": "Joshua Beretta"}
```
- Key name can be anything ("name", "value", "choice", etc.)
- Service extracts the first value regardless of key
- This is the choice text to add or remove

**Response format (to KoboToolbox):**
```json
{
  "success": true,
  "message": "Choice added/removed successfully",
  "value": "Joshua Beretta",
  "choice_id": "sgdgbs324"
}
```

### 3.4 Append Mode Logic (`/add` endpoint)
1. Extract first value from JSON body: `"Joshua Beretta"`
2. Check if choice with this text already exists in the list
3. **If exists:** Return success (idempotent, no error)
4. **If not exists:** 
   - Generate short unique ID (8-10 chars, alphanumeric): `sgdgbs324`
   - Create choice with (value=generated_id, label="Joshua Beretta")
   - Return success with choice_id

### 3.5 Remove Mode Logic (`/remove` endpoint)
1. Extract first value from JSON body: `"Joshua Beretta"`
2. Find choice where label matches "Joshua Beretta"
3. **If found:** Delete it, return success
4. **If not found:** Return success (idempotent, no error)

### 3.6 Short ID Generation
Use `shortuuid` library for readable, shorter IDs:
```python
import shortuuid

def generate_short_id():
    # Generate short UUID like: sgdgbs324 (9 chars)
    return shortuuid.ShortUUID().random(length=9)
```

**Installation:**
```bash
pip install shortuuid
```

**Add to requirements.txt:**
```
shortuuid>=1.0.0
```

### 3.7 Implementation (Use DRF)
- [x] Create DRF Serializers for ChoiceList and Choice models
- [x] Create DRF ViewSets for CRUD (auto-generates endpoints)
- [x] Configure router for API URLs
- [x] Create function-based views for CSV and KoboToolbox endpoints
- [x] Implement JSON body parsing and validation
- [x] Handle missing/invalid JSON gracefully
- [ ] Update `README.md` (API reference — KoboToolbox endpoints + management endpoints)
- [ ] Update `HelpPage.tsx` (KoboToolbox integration section)
- [ ] Update `memory.md` with current project state (see §0)

**Django REST Framework handles (out of box):**
- ✓ JSON serialization
- ✓ Validation
- ✓ Error responses with proper status codes
- ✓ Filtering and pagination
- ✓ API documentation

---

## Phase 4: Authentication & Web UI (MVP)

### 4.1 Authentication & Authorization (MVP)

**Backend (Django API):**
- [ ] Enable Django admin: create superuser (`python manage.py createsuperuser`)
- [x] KoboToolbox integration endpoints (`/add`, `/remove`, `.csv`) are **public** (no auth required)
- [x] Admin API endpoints can be accessed via Django admin or direct DB access

**Frontend (React + Vite):**
- [x] No authentication UI for MVP (admin only accesses via Django admin)
- [x] Frontend is a simple management dashboard (read-only or basic CRUD)
- [x] API calls work against public `/add`, `/remove`, `.csv` endpoints
- [ ] Later: add login form and token auth when multi-user support added

**Later (Phase 2): Add multi-user support**
- Token authentication for API clients
- User registration and signup
- Per-user project ownership
- Fine-grained permissions

### 4.2 React Frontend Setup

- [x] Initialize Vite + React + TypeScript: `npm create vite@latest frontend -- --template react-ts`
- [x] Install dependencies: `npm install axios zustand react-router-dom`
- [ ] Optional: `npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p`
- [x] Setup Vite proxy for API calls: `http://localhost:8000` → Django backend
- [x] Create API client service: `src/services/api.ts` (axios wrapper)
- [x] Create main App component with React Router
- [ ] Create pages: ChoiceListsPage, ChoiceListDetailPage
- [x] Create components: ChoiceListTable, AddChoiceForm, DeleteChoiceButton (inline in App)
- [x] Setup styling with modern CSS
- [x] Run dev server: `npm run dev` (usually `http://localhost:5173`)
- [x] Both dev servers running and verified (backend :8000, frontend :5173)

**Vite Config (proxy backend requests):**
```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

**API Client Service:**
```typescript
// frontend/src/services/api.ts
import axios from 'axios'

const API = axios.create({
  baseURL: '/api',
})

export const apiClient = {
  getChoiceLists: () => API.get('/choice-lists/'),
  getChoiceList: (id: string) => API.get(`/choice-lists/${id}/`),
  addChoice: (listId: string, label: string) => 
    API.post(`/choice-lists/${listId}/choices/`, { label }),
  deleteChoice: (choiceId: string) => API.delete(`/choices/${choiceId}/`),
}
```

- [ ] Update `README.md` (auth section, frontend setup, environment variables)
- [ ] Update `HelpPage.tsx` (all new UI pages and features documented)
- [ ] Update `memory.md` with current project state (see §0)

---

## Phase 5: Local Testing (No Deployment Needed)

### 5.1 Development Server Testing

**Start Django dev server:**
```bash
python manage.py runserver 0.0.0.0:8000
```

**Test React Frontend:**
- Navigate to `http://localhost:5173` in browser
- Test listing choice lists
- Test viewing list details and choices
- Test adding/removing choices (calls Django API)
- Verify CSV export works

**Test Backend API directly (curl/Postman):**
- Test public KoboToolbox endpoints
- Test management API endpoints

**Test Admin Interface:**
- Go to `http://localhost:8000/admin/`
- Login with superuser credentials
- View/edit projects, choice lists, choices directly

### 5.2 API Testing with curl or Postman

**Get token (authentication):**
```bash
curl -X POST http://localhost:8000/api-token-auth/ \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}'
```

**Use token to test endpoints:**
```bash
curl -H "Authorization: Token YOUR_TOKEN" \
  http://localhost:8000/api/choice-lists/
```

**Test KoboToolbox endpoints:**
```bash
# Get CSV
curl http://localhost:8000/project123/mylist.csv

# Add choice (simple JSON, key doesn't matter, only the value)
curl -X POST http://localhost:8000/project123/mylist/add \
  -H "Content-Type: application/json" \
  -d '{"name":"Joshua Beretta"}'

# Remove choice (simple JSON, key doesn't matter, only the value)
curl -X POST http://localhost:8000/project123/mylist/remove \
  -H "Content-Type: application/json" \
  -d '{"name":"Joshua Beretta"}'
```

**Better option: Use Postman**
- Import API endpoints as collection
- Set Authorization header with token
- Test all endpoints with UI
- Save test cases for later use

### 5.3 Automated Testing (Django Test Framework)

**Create tests/test_api.py:**
```python
from django.test import TestCase, Client
from rest_framework.test import APIClient
from api.models import ChoiceList, Choice

class CSVExportTest(TestCase):
    def setUp(self):
        self.client = Client()
        
    def test_csv_export(self):
        # Create test data
        # Call GET /project/list.csv
        # Assert CSV format is correct
        pass
```

**Run tests:**
```bash
python manage.py test
```

### 5.4 Docker Testing (Local Containers)

**Create Dockerfile for backend:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
```

**Create Dockerfile for frontend:**
```dockerfile
FROM node:18-alpine
WORKDIR /app/frontend
COPY frontend/package*.json .
RUN npm install
COPY frontend/ .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
```

**Create docker-compose.yml:**
```yaml
version: '3.8'
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8000:8000"
    environment:
      - DEBUG=True
      - SECRET_KEY=dev-secret-key
    volumes:
      - ./backend:/app/backend

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app/frontend
      - /app/frontend/node_modules
    depends_on:
      - backend
```

**Run locally in Docker:**
```bash
docker-compose up
# Backend: http://localhost:8000
# Frontend: http://localhost:5173
```

### 5.5 Simulating KoboToolbox

**Option 1: Manual curl requests**
- Write a shell script with curl commands that simulate KoboToolbox REST calls
- Test add/remove workflows manually

**Option 2: Simple Python test script**
```python
import requests

BASE_URL = "http://localhost:8000"
PROJECT_ID = "project123"
LIST_NAME = "mylist"

# Get CSV
r = requests.get(f"{BASE_URL}/{PROJECT_ID}/{LIST_NAME}.csv")
print("CSV:", r.text)

# Add choice (simple JSON, key doesn't matter, only the value)
r = requests.post(f"{BASE_URL}/{PROJECT_ID}/{LIST_NAME}/add", 
    json={"name":"Joshua Beretta"})
print("Add response:", r.status_code, r.json())

# Remove choice (simple JSON, key doesn't matter, only the value)
r = requests.post(f"{BASE_URL}/{PROJECT_ID}/{LIST_NAME}/remove",
    json={"name":"Joshua Beretta"})
print("Remove response:", r.status_code)
```

**Option 3: Use ngrok for real KoboToolbox testing**
```bash
# Expose local dev server to internet
ngrok http 8000
# Use ngrok URL in KoboToolbox REST service config
# https://abc123.ngrok.io/{project_id}/{choice_list_name}.csv
```

- [ ] Update `README.md` (development setup, Docker instructions)
- [ ] Update `HelpPage.tsx` if testing reveals missing user-facing documentation
- [ ] Update `memory.md` with current project state (see §0)

---

## Stage 2 — Phases 6, 7, 8

The remaining phases are tracked in [`plan-stage2.md`](plan-stage2.md):

| Phase | Title |
|-------|-------|
| Phase 6 | Access Control, Project Sharing & Public Projects |
| Phase 7 | Collections |
| Phase 8 | Production Deployment |

Start there once Phase 5 is complete. Read this file (`plan.md`) first for project overview, URL conventions, and the `§0 memory.md` update convention.

<!-- Original phases 6-8 moved to plan-stage2.md -->

---

## MVP Timeline

**Goal: Get running in 3-4 weeks (adjusted for frontend)**

1. **Week 1:** Phases 1-2
   - Django backend project setup
   - Create models (Project, ChoiceList, Choice)
   - Run migrations
   - Create superuser for admin

2. **Week 2:** Phase 3
   - DRF API endpoints (3 core endpoints for KoboToolbox)
   - DRF API for choice list management
   - Test APIs with curl/Postman

3. **Week 3:** Phase 4
   - React + Vite frontend setup
   - Create pages and components
   - Setup API client service
   - Connect frontend to backend
   - Add Tailwind CSS styling

4. **Week 4:** Phase 5
   - Docker setup (both backend + frontend)
   - Manual testing (both UIs)
   - KoboToolbox integration test
   - Deploy locally or to staging server

**After MVP:**
- Add user authentication/registration
- Add CSV upload feature
- Add more comprehensive tests
- Move to PostgreSQL
- Setup production infrastructure
- API documentation
- Performance optimization