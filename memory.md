# Choices — Project Memory
_Last updated: 2025-07-18_

## Current status
- Last completed phase: Phase 9 — Following & Customising Public Lists
- Currently working on: (nothing active)

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
- `0009_phase7_collections` — `Collection`, `CollectionProject`, `CollectionShare`
- `0010_collectionproject_one_collection_per_project` — adds unique constraint to `CollectionProject`
- `0011_phase9_user_follow_configs` — `UserChoiceListConfig`, `UserChoiceListColumn`, `UserChoiceExtraValue`

### Data model summary
```
Project(owner FK, name, slug, created_at, updated_at, is_public)
  └─ ChoiceList(project FK, name, slug, description, label_column_name, name_generation, name_max_length, require_auth, created_at, updated_at)
       ├─ ChoiceListColumn(choice_list FK, name, order)
       └─ Choice(choice_list FK, name, label, order, created_at, updated_at)
            └─ ChoiceExtraValue(choice FK, column FK, value)
ProjectShare(project FK, user FK, unique_together=('project','user'), created_at)
Collection(owner FK, name, slug [globally unique], description, is_public, created_at, updated_at)
  └─ CollectionProject(collection FK, project FK [on_delete=PROTECT], order; unique_together)
CollectionShare(collection FK, user FK, unique_together=('collection','user'), created_at)
UserChoiceListConfig(user FK, choice_list FK, label_column_name, created_at, updated_at; unique_together=user+choice_list)
  └─ UserChoiceListColumn(config FK, name, order; unique_together=config+name)
UserChoiceExtraValue(config FK, choice FK, column FK, value; unique_together=config+choice+column)
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

### Phase 7: Collections (migration 0009)

**Models added (`backend/api/models.py`):**
- `Collection(owner FK, name, slug [globally unique], description, is_public, created_at, updated_at)`
- `CollectionProject(collection FK, project FK [on_delete=PROTECT], order; unique_together)`
- `CollectionShare(collection FK, user FK, unique_together)`

**Authorization rules:**
| Action | Who |
|--------|-----|
| `GET /api/collections/` | Owner or shared user (Session Auth) |
| Create/update/delete collection | Owner only |
| Toggle `is_public` / manage shares | Owner only |
| Add/remove projects | Owner or shared user |
| `GET /api/collections/public/` | Anyone |
| `GET /api/collections/public/{id}/` | Anyone |

**Backend — `backend/api/permissions.py`:**
- `IsCollectionAuthorized`: True if owner or `CollectionShare` member

**Backend — `backend/api/serializers.py`:**
- `ProjectSerializer.collection_memberships` — `SerializerMethodField` returning `[{id, name, slug}]`
- `CollectionProjectSummarySerializer` — id, name, slug
- `CollectionSerializer` — full collection + role (owner/shared), owner_username, project_count, projects
- `PublicCollectionProjectSerializer` — project with full `choice_lists` (non-removed choices)
- `PublicCollectionSerializer` — collection + projects

**Backend — `backend/api/views.py`:**
- `CollectionViewSet`: `add_project`, `remove_project`, `shares`, `share`, `unshare` custom actions; `_require_owner()` / `_require_member()` helpers
- `PublicCollectionViewSet`: AllowAny, read-only, `?search=`; registered before router

**Backend — `backend/api/urls.py`:**
- `collections/public/` and `collections/public/<int:pk>/` registered before `include(router.urls)`

**Frontend — `frontend/src/services/api.ts`:**
- Interfaces: `CollectionMembership`, `CollectionProjectSummary`, `CollectionShare`, `Collection`, `PublicCollection`
- `Project.collection_memberships?: CollectionMembership[]`
- 10 new API methods: `getCollections`, `createCollection`, `getCollection`, `updateCollection`, `deleteCollection`, `addProjectToCollection`, `removeProjectFromCollection`, `getCollectionShares`, `shareCollection`, `unshareCollection`, `getPublicCollections`, `getPublicCollection`

**Frontend — `frontend/src/App.tsx`:**
- `/collections/public` and `/collections/public/:id` routes registered BEFORE `/collections` and `/collections/:id`
- "Collections" nav link (auth-required) and "Public Collections" nav link (always visible)

**Frontend — new pages:**
- `MyCollectionsPage.tsx` — create-collection form (auto-slug from name), own+shared collection cards, delete (owner only)
- `CollectionDetailPage.tsx` — settings panel (name/description/is_public toggle + share management), add/remove projects via dropdown
- `PublicCollectionsPage.tsx` — `?search=` filter, collection cards linking to detail
- `PublicCollectionDetailPage.tsx` — expandable project→list accordion, choices table, "Copy CSV URL", "My Collections →" link

**Frontend — `frontend/src/pages/ChoiceListsPage.tsx`:**
- Added `collection_memberships: {id, name, slug}[]` to grouped project data
- Renders purple `📁 collection-name` chip Links in project header rows → navigate to `/collections/{id}`

## Key decisions & notes
- SQLite for dev/staging — no PostgreSQL migration needed yet
- Slug uniqueness is scoped per owner for projects (not globally), enforced in `0006`
- Collection slugs are globally unique (not per-owner)
- `BaseAuthentication` must NOT be in `DEFAULT_AUTHENTICATION_CLASSES` — only on individual Kobo write views
- `KoboCSVExportView` must keep `authentication_classes=[]` (no `WWW-Authenticate` header leakage)
- `PermissionDenied` comes from `rest_framework.exceptions`, not `rest_framework.permissions`
- `Prefetch` name collision in views.py resolved with `from django.db.models import Prefetch as DjPrefetch`
- Public endpoint URLs must be registered before the DRF router in `urls.py`
- `from_label` is now the default name generation mode (changed in migration 0008)
- `CollectionViewSet` uses integer `id` as lookup field (not slug)
- `CollectionProject.project` uses `on_delete=PROTECT` — must remove from collection before deleting the project
- `CollectionShare` does NOT cascade project-level permissions — collection sharing is separate from project sharing
- `/collections/public` and `/collections/public/:id` React routes must be registered before `/collections/:id`
- `memory.md`, `README.md`, and `HelpPage.tsx` should all be updated at the end of each phase

### Phase 9: Following & Customising Public Lists (migration 0011)

**Models added (`backend/api/models.py`):**
- `UserChoiceListConfig(user, choice_list, label_column_name; unique_together=user+choice_list)` — one row per user per followed list
- `UserChoiceListColumn(config, name, order; unique_together=config+name)` — user-defined extra columns
- `UserChoiceExtraValue(config, choice, column, value; unique_together=config+choice+column)` — sparse cell values for user columns

**Backend:**
- `UserChoiceListConfigViewSet` — CRUD, `choices` action, `add_column`, `update_column`, `remove_column`, `import_csv` actions; scoped to `user=request.user`
- `ChoiceViewSet.set_user_extra_value` — PATCH `/api/choices/{id}/set_user_extra_value/` — validates config ownership and column membership
- `UserCustomCSVExportView` — AllowAny, `GET /{follower}/{project_slug}/custom/{list_slug}.csv`; outputs original + user columns with configurable label header
- URL pattern for custom export registered **BEFORE** Kobo patterns in `choices/urls.py` (critical ordering)
- `UserChoiceListConfigSerializer` includes `original_columns`, `export_url`, `label_column_name`, `original_label_column_name` plus nested `UserChoiceListColumnSerializer`

**Frontend:**
- `FollowingPage` — `/following` (auth-required) — lists followed configs, copy URL, unfollow
- `FollowedListDetailPage` — `/following/:configId` — label override, export URL card, CSV import, user column CRUD, choices table with inline editing of user-column cells
- Follow/Unfollow buttons added to `PublicProjectDetailPage` and `PublicCollectionDetailPage` (with "Follow all" bulk action)
- `useFollowedLists` hook for fetching followed list data
- "Following" nav link (auth-only) added to header

**Key notes:**
- `UserCustomCSVExportView` path must come before Kobo patterns — `custom` keyword prevents slug collision
- `import_csv` for user configs is upsert-only (never deletes choices from the underlying list)
- `set_user_extra_value` validates: config belongs to request.user AND column belongs to that config
- `original_columns` in serializer eliminates extra round-trip from frontend

## What's next
- (No active phase — Phase 9 was the last planned feature)

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
- `frontend/src/pages/MyCollectionsPage.tsx` — collection list + create form
- `frontend/src/pages/CollectionDetailPage.tsx` — collection settings, share management, project list
- `frontend/src/pages/PublicCollectionsPage.tsx` — public collection browser with search
- `frontend/src/pages/PublicCollectionDetailPage.tsx` — public collection with nested project/list/choices tree
- `nginx/nginx.conf` — reverse proxy config
- `frontend/src/hooks/useFollowedLists.ts` — `useFollowedLists`, `useFollowedList` hooks
- `frontend/src/pages/FollowingPage.tsx` — list of followed configs
- `frontend/src/pages/FollowedListDetailPage.tsx` — full customisation UI for a followed list
- `frontend/src/pages/PublicProjectDetailPage.tsx` — public project view (now with follow buttons)
- `frontend/src/pages/PublicCollectionDetailPage.tsx` — public collection view (now with follow buttons)
- `plan.md` — Stage 1 plan (Phases 1–5, all complete)
- `plan-stage2.md` — Stage 2 plan (Phases 6–8; all complete)
- `plan-modified-public-lists.md` — Phase 9 plan (complete)
