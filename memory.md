# Choices — Project Memory
_Last updated: 2025-07-14_

## Current status
- Last completed phase: Phase 6 — Access Control, Project Sharing & Public Projects
- Currently working on: Phase 7 — Collections (not yet started)

## What is implemented

### Infrastructure & deployment
- Django 4.2 backend + Django REST Framework, SQLite database
- React 18 + TypeScript + Vite + Tailwind CSS + Zustand + React Router v6 + Axios + @dnd-kit
- Docker Compose: `backend`, `frontend`, `nginx` services; nginx reverse-proxies `/api/` and `/static/` to backend, all else to frontend dev server
- `Dockerfile.backend`, `Dockerfile.frontend`, `nginx/nginx.conf`
- `python-decouple` for env config (`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`)

### Auth (Phase 4)
- Session-based auth; users created via Django admin only (no public signup)
- `GET /api/auth/csrf/` — seeds CSRF cookie (called on LoginPage mount)
- `POST /api/auth/login/`, `POST /api/auth/logout/`, `GET /api/auth/me/`, `POST /api/auth/change-password/`
- DRF defaults: `SessionAuthentication` + `IsAuthenticated`
- Kobo CSV export view keeps `authentication_classes=[], permission_classes=[AllowAny]`
- Kobo write views use `SessionAuthentication + BasicAuthentication` + `IsProjectWriteAuthorized` (Phase 6)
- **Do NOT add `BasicAuthentication` to `DEFAULT_AUTHENTICATION_CLASSES`** — would cause browsers to show native Basic Auth dialogs on 401s
- Frontend: Zustand `authStore`, `LoginPage`, `ChangePasswordModal`; 401 interceptor in `api.ts` redirects to `/login`

### Models & migrations
- `0001_initial` — `Project`, `ChoiceList`, `Choice`
- `0002_project_owner` — `Project.owner` FK to User
- `0003_choicelistcolumn_choiceextravalue` — `ChoiceListColumn`, `ChoiceExtraValue`
- `0004_choicelist_label_column_name` — `ChoiceList.label_column_name`
- `0005_choicelist_name_generation` — `ChoiceList.name_generation`, `ChoiceList.name_max_length`
- `0006_project_slug_unique_per_owner` — slug uniqueness scoped to owner
- `0007_phase6_access_control` — `Project.is_public`, `ChoiceList.require_auth`, `ProjectShare`
- `0008_name_generation_default` — changed `name_generation` default from `'uuid'` to `'from_label'`

### Data model summary
```
Project(owner FK, name, slug, created_at, updated_at, is_public)
  └─ ChoiceList(project FK, name, slug, description, label_column_name, name_generation, name_max_length, require_auth, created_at, updated_at)
       ├─ ChoiceListColumn(choice_list FK, name, order)
       └─ Choice(choice_list FK, name, label, order, created_at, updated_at)
            └─ ChoiceExtraValue(choice FK, column FK, value)
ProjectShare(project FK, user FK, unique_together=('project','user'), created_at)
```

### KoboToolbox integration (Phases 2–3)
- `GET /{username}/{project_slug}/{list_slug}/export/{filename}.csv` — public CSV export (AllowAny, no WWW-Authenticate)
- `POST /{username}/{project_slug}/{list_slug}/add` — add choice (auth per `require_auth`)
- `POST /{username}/{project_slug}/{list_slug}/remove` — remove choice (soft-delete via `removed` system column)
- `POST /{username}/{project_slug}/{list_slug}/delete` — hard-delete choice (auth per `require_auth`)
- CSV Sniffer auto-detects delimiter; accepts `name` or `value` as ID column; always requires `label`

### Extra columns (Phase 3, migration 0003)
- `ChoiceListColumn(choice_list, name, order)` — extra named columns per list
- `ChoiceExtraValue(choice, column, value)` — sparse; missing row = blank
- Reserved column names (blocked server-side): `name`, `value`, `label`, `removed`, `protected`
- Column endpoints: `POST add_column/`, `PATCH update_column/`, `DELETE remove_column/`
- Cell value endpoint: `PATCH /api/choices/{id}/set_extra_value/ {column_id, value}`
- Both export views include extra columns (including removed/protected)

### System columns: removed & protected
- Implemented as `ChoiceListColumn` rows with values `"true"`/`"false"`; created lazily on first use
- New choices get `removed=false` and `protected=false` stamped automatically
- `protected=true` blocks `/remove` (soft-delete) endpoint — returns 403
- `protected=true` hides hard-delete button in UI, shows 🔒 Protected badge instead
- UI renders both as checkboxes (toggle), not editable text

### Name generation (Phase 5, migration 0005)
- `ChoiceList.name_generation`: `'from_label'` (default) or `'uuid'` (random 9-char shortuuid)
- `ChoiceList.name_max_length`: `PositiveIntegerField`, 0 = no limit
- `from_label` transform: lowercase → spaces→`_` → strip `[^a-z0-9_]` → truncate → uniqueness via `_2`, `_3` suffix
- Backend helper: `_generate_choice_name(choice_list, label)` in `views.py`
- UI: "Name generation" settings card in `ChoiceListDetailPage` (between Kobo integration panel and choices table)

### Phase 6: Access Control, Project Sharing & Public Projects (migration 0007)

**Models added:**
- `Project.is_public` (BooleanField, default=False) — owner can toggle; makes project discoverable publicly
- `ChoiceList.require_auth` (BooleanField, default=True) — per-list; if False, Kobo write endpoints are openly writable without credentials
- `ProjectShare(project, user, unique_together)` — grants shared users write access via Basic Auth and management UI

**Authorization rules:**
| Action | Who |
|--------|-----|
| CSV export | Anyone (AllowAny, no auth headers) |
| Kobo add/remove/delete | Anyone if `require_auth=False`; else owner or shared user (Basic Auth) |
| Management API reads | Owner or shared user (Session Auth) |
| Management API writes | Owner or shared user (Session Auth) |
| Toggle `require_auth` | Owner or shared user |
| Delete project / toggle `is_public` / manage shares | Owner only |
| `GET /api/projects/public/` | Anyone |
| `GET /api/projects/public/{id}/` | Anyone |

**Backend — `backend/api/permissions.py`:**
- `IsProjectWriteAuthorized`: returns True if `choice_list.require_auth=False`; else checks owner or `ProjectShare`

**Backend — `backend/api/views.py`:**
- `PermissionDenied` imported from `rest_framework.exceptions` (NOT `rest_framework.permissions`)
- Kobo write views: `authentication_classes=[SessionAuthentication, BasicAuthentication]`, `permission_classes=[IsProjectWriteAuthorized]`; each has a `get_choice_list()` method
- `ProjectViewSet` queryset: `Q(owner=user) | Q(shares__user=user)`.distinct(); `update()`/`destroy()` restricted to owner; custom actions: `shares`, `share`, `unshare`
- `PublicProjectViewSet`: AllowAny, read-only, supports `?search=`, annotates `list_count`; prefetches `choice_lists`, `columns`, `choices`, `choices__extra_values`
- Used `from django.db.models import Prefetch as DjPrefetch` to avoid collision with existing `Prefetch` import

**Backend — `backend/api/serializers.py`:**
- `PublicChoiceSerializer`: fields `[value, label, order]`
- `PublicChoiceListSerializer`: `choices` via `SerializerMethodField` filtering out removed choices
- `PublicProjectSerializer`: `owner_username`, `list_count` (annotated), `choice_lists`
- `ProjectSerializer`: added `role` (SerializerMethodField → `'owner'`/`'shared'`), `owner_username`, `is_public`
- `ChoiceListSerializer` / `ChoiceListDetailSerializer`: added `require_auth`

**Backend — `backend/api/urls.py`:**
- Public project endpoints registered BEFORE `include(router.urls)` so `/api/projects/public/` wins over `/{slug}/`

**Backend — `backend/api/admin.py`:**
- `ProjectShareAdmin` registered; `is_public` displayed on `ProjectAdmin`

**Frontend — `frontend/src/services/api.ts`:**
- Updated interfaces: `Project` (+ `owner_username`, `is_public`, `role`), `ChoiceList` (+ `require_auth`)
- New interfaces: `PublicChoice {value, label, order}`, `PublicChoiceList {id, slug, name, description, updated_at, choices: PublicChoice[]}`, `PublicProject`, `ProjectShare {username, created_at}`
- New methods: `getProjectShares(slug)`, `shareProject(slug, username)`, `removeProjectShare(slug, username)`, `getPublicProjects(search?)`, `getPublicProject(id)`

**Frontend — `frontend/src/pages/ChoiceListsPage.tsx`:**
- "My Projects" / "Public Projects" tab layout
- `PublicProjectsTab`: search bar, project cards linking to `/public/projects/{id}`
- `ProjectSettingsPanel`: `is_public` toggle + share management (list/add/remove)
- Owner-only: Settings, Delete buttons
- Badges: "Shared by [owner]" (amber), "Public" (green)

**Frontend — `frontend/src/pages/ChoiceListDetailPage.tsx`:**
- `require_auth` toggle in KoboToolbox Integration panel
- Basic Auth credentials note when enabled; amber security warning when disabled
- `from_label` as default fallback in `useState` and `useEffect`

**Frontend — `frontend/src/pages/PublicProjectDetailPage.tsx`:**
- Route: `/public/projects/:id` (added to `App.tsx` before protected routes)
- All lists expanded by default; accordion toggle per list
- Choices table (Name/Label) per list, filtered to non-removed choices
- "Copy CSV URL" button, "Back to Projects" link, "Manage this project" link for owners

## Key decisions & notes
- SQLite for dev/staging — no PostgreSQL migration needed yet
- Slug uniqueness is scoped per owner (not globally), enforced in `0006`
- `BasicAuthentication` must NOT be in `DEFAULT_AUTHENTICATION_CLASSES` — only on individual Kobo write views
- `KoboCSVExportView` must keep `authentication_classes=[]` (no `WWW-Authenticate` header leakage)
- `PermissionDenied` comes from `rest_framework.exceptions`, not `rest_framework.permissions`
- `Prefetch` name collision in views.py resolved with `from django.db.models import Prefetch as DjPrefetch`
- Public endpoint URLs must be registered before the DRF router in `urls.py`
- `from_label` is now the default name generation mode (changed in migration 0008)
- `memory.md`, `README.md`, and `HelpPage.tsx` should all be updated at the end of each phase

## What's next
- Phase 7: Collections — grouping of projects or choice lists into named collections for easier discovery
- Phase 8: Production Deployment — PostgreSQL, environment hardening, domain config for `choices.imtools.info`

## File/path quick-reference
- `backend/api/models.py` — all data models
- `backend/api/views.py` — all API views including Kobo and public views
- `backend/api/serializers.py` — all DRF serializers
- `backend/api/permissions.py` — `IsProjectWriteAuthorized`
- `backend/api/urls.py` — URL routing (public endpoints first, then router)
- `backend/api/admin.py` — admin registrations
- `backend/api/migrations/` — 0001–0008 applied
- `frontend/src/services/api.ts` — all API calls and TypeScript interfaces
- `frontend/src/store/authStore.ts` — Zustand auth state
- `frontend/src/pages/ChoiceListsPage.tsx` — project list, tabs, settings panel
- `frontend/src/pages/ChoiceListDetailPage.tsx` — choice list editor, Kobo integration, name generation
- `frontend/src/pages/PublicProjectDetailPage.tsx` — public read-only project/choices view
- `frontend/src/pages/LoginPage.tsx` — login form
- `frontend/src/pages/HelpPage.tsx` — user-facing help documentation
- `frontend/src/components/ChangePasswordModal.tsx` — password change modal
- `frontend/src/App.tsx` — routes (public project route added before protected routes)
- `nginx/nginx.conf` — reverse proxy config
- `plan.md` — Stage 1 plan (Phases 1–5, all complete)
- `plan-stage2.md` — Stage 2 plan (Phases 6–8; Phase 6 complete)
