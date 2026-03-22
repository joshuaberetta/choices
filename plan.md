# Choices Service - Action Plan

## Project Overview
A web service that integrates into KoboToolbox workflows to manage external choice lists. Hosted at `choices.imtools.info`, it provides an REST API for KoboToolbox to dynamically add/remove options, plus a web UI for management.

**Key Endpoints:**
- `GET /{project_id}/{choice_list_name}.csv` - Returns choice list as CSV
- `POST /{project_id}/{choice_list_name}/add` - Add choice option
- `POST /{project_id}/{choice_list_name}/remove` - Remove choice option

---

## Phase 1: Project Setup & Infrastructure (Foundation)

### 1.1 Project Initialization
- [ ] Initialize git repository
- [ ] Create Python virtual environment (venv)
- [ ] Install Django and dependencies: `pip install django djangorestframework psycopg2-binary python-decouple shortuuid`
- [ ] Run `django-admin startproject choices`
- [ ] Create main app: `python manage.py startapp api`
- [ ] Set up .gitignore and .env for configuration
- [ ] Initialize database (PostgreSQL or SQLite for MVP)

### 1.2 Technology Stack
- **Framework:** Django + Django REST Framework (built-in auth, admin, ORM)
- **Database:** SQLite for MVP (quick start), PostgreSQL later for production
- **Authentication:** Django's built-in User model + tokens
- **API:** Django REST Framework (minimal code, lots of features)
- **Frontend:** Django templates (no separate JS framework needed initially)
- **Containerization:** Docker + Docker Compose (Phase 2)

### 1.3 Project Structure
```
choices/
├── manage.py
├── choices/ (project folder)
│   ├── settings.py (configuration)
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── api/ (main app)
│   ├── migrations/
│   ├── models.py (User, Project, ChoiceList, Choice)
│   ├── views.py (APIs + web views)
│   ├── serializers.py (DRF serializers)
│   ├── urls.py (route definitions)
│   ├── admin.py (admin interface)
│   └── templates/ (HTML for web UI)
├── static/ (CSS, JS)
├── db.sqlite3 (SQLite database for MVP)
├── requirements.txt
├── .env
└── Dockerfile (Phase 2)
```

---

## Phase 2: Database Models (MVP)

### 2.1 Database Schema - MVP (Simple)
**Models:**
- `User` - Django's built-in User model (no custom code)
- `Project` - name, owner (FK to User), created_at
- `ChoiceList` - name, project (FK), description, created_at
- `Choice` - value, label, choice_list (FK), order

**Key constraints:**
- Unique constraint: (project, name) for ChoiceList
- User can only see their own projects

### 2.2 Create Django Models
- [ ] Define Project model in api/models.py
- [ ] Define ChoiceList model
- [ ] Define Choice model
- [ ] Register all models in api/admin.py (Django admin handles CRUD)
- [ ] Run: `python manage.py makemigrations && python manage.py migrate`

---

## Phase 3: REST API for KoboToolbox (MVP)

### 3.1 MVP API Endpoints (Core Only)

**KoboToolbox Integration (Priority):**
- [ ] `GET /{project_id}/{choice_list_name}.csv` - Export as CSV
- [ ] `POST /{project_id}/{choice_list_name}/add` - Add choice (append mode)
- [ ] `POST /{project_id}/{choice_list_name}/remove` - Remove choice (delete mode)

**Web Admin API (for management UI):**
- [ ] `GET /api/choice-lists/` - List all user's choice lists
- [ ] `GET /api/choice-lists/{id}/` - Get one list with all choices
- [ ] `POST /api/choices/` - Create a choice
- [ ] `DELETE /api/choices/{id}/` - Delete a choice

### 3.2 KoboToolbox Request/Response Format

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

### 3.3 Append Mode Logic (`/add` endpoint)
1. Extract first value from JSON body: `"Joshua Beretta"`
2. Check if choice with this text already exists in the list
3. **If exists:** Return success (idempotent, no error)
4. **If not exists:** 
   - Generate short unique ID (8-10 chars, alphanumeric): `sgdgbs324`
   - Create choice with (value=generated_id, label="Joshua Beretta")
   - Return success with choice_id

### 3.4 Remove Mode Logic (`/remove` endpoint)
1. Extract first value from JSON body: `"Joshua Beretta"`
2. Find choice where label matches "Joshua Beretta"
3. **If found:** Delete it, return success
4. **If not found:** Return success (idempotent, no error)

### 3.5 Short ID Generation
Use `shortuuid` library for readable, shorter IDs:
```python
import shortuuid

def generate_short_id():
    # Generate short UUID like: sgdgbs324
    return shortuuid.ShortUUID().random()
```

**Installation:**
```bash
pip install shortuuid
```

**Add to requirements.txt:**
```
shortuuid>=1.0.0
```

### 3.6 Implementation (Use DRF)
- [ ] Create DRF Serializers for ChoiceList and Choice models
- [ ] Create DRF ViewSets for CRUD (auto-generates endpoints)
- [ ] Configure router for API URLs
- [ ] Add permission classes: `IsAuthenticated`, owner-only access
- [ ] Create function-based views for CSV and KoboToolbox endpoints
- [ ] Implement JSON body parsing and validation
- [ ] Handle missing/invalid JSON gracefully

**Django REST Framework handles (out of box):**
- ✓ JSON serialization
- ✓ Validation
- ✓ Error responses with proper status codes
- ✓ Filtering and pagination
- ✓ API documentation

---

## Phase 4: Authentication & Web UI (MVP)

### 4.1 Authentication (Django Built-in)
- [ ] Enable Django admin: create superuser (`python manage.py createsuperuser`)
- [ ] Add Token authentication: `pip install djangorestframework`
- [ ] Install `rest_framework.authtoken` in INSTALLED_APPS
- [ ] Create token endpoint: `POST /api-token-auth/` (DRF provides this)
- [ ] API clients send token in `Authorization: Token <token>` header

**No custom auth code needed!**

### 4.2 Authorization (Django Permissions)
- [ ] Add `get_queryset()` override: users see only their objects
- [ ] Add custom permission: `IsOwner` check for list ownership
- [ ] Protect API endpoints with permission classes

### 4.3 Web Interface (Django Templates - MVP)
- [ ] Create Django app for web UI: `python manage.py startapp web`
- [ ] Setup base template with Bootstrap CSS (CDN)
- [ ] Dashboard: list all user's choice lists (table view)
- [ ] Add list form: create new choice list
- [ ] View list details: table of choices with delete buttons
- [ ] Add choice form: create new choice for a list
- [ ] Download CSV button
- [ ] Simple style with Bootstrap, no JavaScript framework needed

### 4.4 Web Views & Forms
- [ ] View: List all choice lists (GET)
- [ ] View: Create choice list (GET form + POST)
- [ ] View: List detail with choices (GET)
- [ ] View: Add choice form (GET + POST)
- [ ] View: Delete choice (POST with confirmation)
- [ ] Use Django forms for validation

---

## Phase 5: Local Testing (No Deployment Needed)

### 5.1 Development Server Testing

**Start Django dev server:**
```bash
python manage.py runserver 0.0.0.0:8000
```

**Test Web UI:**
- Navigate to `http://localhost:8000/` in browser
- Create user account or use superuser
- Test creating choice lists
- Test adding/removing choices
- Download CSV button

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

**Create basic Dockerfile:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
RUN python manage.py migrate
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
```

**Create docker-compose.yml:**
```yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DEBUG=True
      - SECRET_KEY=dev-secret-key
```

**Run locally in Docker:**
```bash
docker-compose up
# Access at http://localhost:8000
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

---

## Phase 6: Production Deployment (Later)

**Defer to Phase 2 of project:**
- [ ] Nginx reverse proxy setup
- [ ] Let's Encrypt HTTPS
- [ ] PostgreSQL database (migrate from SQLite)
- [ ] Production server setup
- [ ] Health checks & monitoring
- [ ] Error logging (Sentry)
- [ ] Automated testing & CI/CD

---

## Phase 6: Production Deployment (Later)

**Defer to Phase 2 of project:**
- [ ] Nginx reverse proxy setup
- [ ] Let's Encrypt HTTPS
- [ ] PostgreSQL database (migrate from SQLite)
- [ ] Production server setup
- [ ] Health checks & monitoring
- [ ] Error logging (Sentry)
- [ ] Automated testing & CI/CD

---

## MVP Timeline

**Goal: Get running in 2-3 weeks**

1. **Week 1:** Phases 1-2
   - Django project setup
   - Create models (Project, ChoiceList, Choice)
   - Run migrations
   - Create superuser for admin

2. **Week 2:** Phases 3-4
   - DRF API endpoints (3 core endpoints for KoboToolbox)
   - DRF API for web UI management
   - Token auth setup
   - Web UI with Django templates (list view, add forms)

3. **Week 3:** Phase 5
   - Docker setup (Dockerfile + docker-compose)
   - Manual testing
   - KoboToolbox integration test
   - Deploy locally or to staging server

**After MVP:**
- Add CSV upload feature
- Add more comprehensive tests
- Move to PostgreSQL
- Setup production infrastructure
- API documentation
- Performance optimization