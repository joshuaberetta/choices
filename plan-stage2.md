# Choices Service - Stage 2 Plan

## Context

This document covers Stage 2 of the Choices Service project: access control, project sharing, public discoverability, collections, and production deployment.

**Before starting any task in this file, read [`plan.md`](plan.md) first** — it contains:
- Project overview and URL conventions
- The `§0 memory.md` update convention (follow it at the end of every phase here too)
- The completed Stage 1 phases (1–5): infrastructure, models, REST API, auth/frontend, local testing
- The codebase notes in [`memory.md`](memory.md) for the current implementation state

**Assumed complete before Stage 2 begins:** Phases 1–5 from `plan.md`. The Django backend (models, DRF API, session auth) and React frontend are running. Users are created via Django admin. Projects are scoped to their owner.

---

## Stage 2 — Phase Overview

| Phase | Title | Depends on |
|-------|-------|-----------|
| Phase 6 | Access Control, Project Sharing & Public Projects | Phases 1–5 |
| Phase 7 | Collections | Phase 6 |
| Phase 8 | Production Deployment | Phases 6–7 (or independently) |

---

## Phase 6: Access Control, Project Sharing & Public Projects

### 6.1 Overview

This phase introduces four related capabilities:

1. **Basic Auth on Kobo write endpoints** — `/add` and `/remove` require HTTP Basic Auth credentials by default; the CSV export (`/{slug}/{list}.csv` and `/api/choice-lists/{id}/export/`) stays unconditionally public.
2. **Per-list write-auth toggle** — owners or shared users can disable auth on a specific list's write endpoints (`/add`, `/remove`), making them openly writable without credentials. Auth is **required by default** (`require_auth = True`). When disabled, a security warning is shown in the UI.
3. **Project sharing** — a project owner can grant other registered server users access by username; shared users can use Basic Auth on the Kobo endpoints and can manage choices through the UI, but cannot delete the project or manage its sharing settings.
4. **Public projects** — an owner can mark a project as *public*, making its existence and CSV links discoverable by any anonymous user through a "Public Projects" view in the UI.

---

### 6.2 Database Changes

**Modify `Project` model:**
```python
is_public  = models.BooleanField(default=False)   # publicly listed/discoverable
```
*(Note: `updated_at` already exists on the model.)*

**Modify `ChoiceList` model:**
```python
require_auth = models.BooleanField(default=True)  # if False, /add and /remove are openly writable
```
*(Note: `updated_at` already exists on the model.)*

**New `ProjectShare` model:**
```python
class ProjectShare(models.Model):
    project    = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='shares')
    user       = models.ForeignKey(User,    on_delete=models.CASCADE, related_name='shared_projects')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('project', 'user')
```

**Required migration:**
- Add `Project.is_public` (default `False`)
- Add `ChoiceList.require_auth` (default `True`)
- Create `ProjectShare` table

---

### 6.3 Authorization Model

| Action | Who can perform it |
|--------|-------------------|
| `GET /{username}/{project_slug}/{list_slug}/export/{filename}.csv` | **Anyone** (always public, no auth) |
| `GET /api/choice-lists/{id}/export/` | Owner **or** shared user (Session Auth) |
| `POST /{username}/{project_slug}/{list_slug}/add` | **Anyone** if `require_auth=False`; otherwise owner **or** shared user (HTTP Basic Auth) |
| `POST /{username}/{project_slug}/{list_slug}/remove` | **Anyone** if `require_auth=False`; otherwise owner **or** shared user (HTTP Basic Auth) |
| `POST /{username}/{project_slug}/{list_slug}/delete` | **Anyone** if `require_auth=False`; otherwise owner **or** shared user (HTTP Basic Auth) |
| All `/api/*` write endpoints (choices, lists) | Owner **or** shared user (Session Auth) |
| Toggle `require_auth` on a list | Owner **or** shared user (via management API) |
| Delete project / toggle `is_public` / manage shares | **Owner only** |
| `GET /api/projects/public/` | **Anyone** (no auth) |
| `GET /api/projects/public/{id}/` | **Anyone** (no auth) |

**DRF authentication strategy for Kobo write endpoints:**
- Set `authentication_classes = [SessionAuthentication, BasicAuthentication]` directly on `KoboAddChoiceView`, `KoboRemoveChoiceView`, and `KoboDeleteChoiceView` — do **not** add `BasicAuthentication` to `REST_FRAMEWORK.DEFAULT_AUTHENTICATION_CLASSES` (Basic Auth is not needed for the management API and adding it globally would cause browsers to show a native Basic Auth login dialog on session-auth 401 responses)
- Kobo write views use the above auth classes + `IsProjectWriteAuthorized` permission (see §6.5)
- `IsProjectWriteAuthorized` checks `choice_list.require_auth` first — if `False`, the request is allowed unconditionally; otherwise the user must be authenticated and must be the project owner or a share member
- `KoboCSVExportView` (`/{username}/{project_slug}/{list_slug}/export/{filename}.csv`) keeps `authentication_classes=[]` and `permission_classes=[AllowAny]` — it must not be affected by any default authentication classes to avoid leaking `WWW-Authenticate` headers that could break KoboToolbox CSV fetches; the management API export (`/api/choice-lists/{id}/export/`) remains auth-protected as normal

**Shared user scope within the management API:**
- `ProjectViewSet` queryset expands to `owner=request.user OR shares__user=request.user`
- `ChoiceListViewSet` and `ChoiceViewSet` filter transitively through project ownership/shares
- A computed `role` field (`"owner"` or `"shared"`) on the project serializer drives frontend rendering

---

### 6.4 New & Modified API Endpoints

**New endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/projects/public/` | None | List public projects; supports `?search=` (name or owner username); returns `id`, `name`, `slug`, `owner_username`, `updated_at`, `list_count` |
| `GET` | `/api/projects/public/{id}/` | None | Public project detail with its choice lists and their `updated_at`; no edit controls |
| `GET` | `/api/projects/{slug}/shares/` | Owner only | List all shares: `[{username, created_at}]` |
| `POST` | `/api/projects/{slug}/share/` | Owner only | Body `{"username": "alice"}`; 400 if user not found |
| `DELETE` | `/api/projects/{slug}/share/{username}/` | Owner only | Remove share for that username |

**Modified endpoints:**

- `POST /{username}/{project_slug}/{list_slug}/add` — open to anyone if `require_auth=False`; otherwise requires `BasicAuthentication` + `IsProjectWriteAuthorized`; returns `401 Unauthorized` with `WWW-Authenticate: Basic` if credentials are missing/wrong and auth is required (`{username}` is the project owner's username, not the requesting user)
- `POST /{username}/{project_slug}/{list_slug}/remove` — same as above
- `POST /{username}/{project_slug}/{list_slug}/delete` — same as above (hard-delete; `KoboDeleteChoiceView`)
- `PATCH /api/choice-lists/{id}/` — `require_auth` is writable by owner or shared user
- `GET /api/projects/` — includes shared projects alongside owned; each project carries `role` and (for shared ones) `owner_username`
- `GET /api/projects/{slug}/` — accessible to owner and shared users
- `PATCH /api/projects/{slug}/` — `is_public` writable by owner only; shared users receive 403 on that field

**KoboToolbox Basic Auth configuration:**
KoboToolbox REST service settings accept a username and password. Use any Django account that is the project owner or a project share member:
```
Username: <django username>  (must be the project owner or a ProjectShare member)
Password: <django password>
URL (add):    https://choices.imtools.info/{owner_username}/{project_slug}/{list_slug}/add
URL (remove): https://choices.imtools.info/{owner_username}/{project_slug}/{list_slug}/remove
URL (CSV):    https://choices.imtools.info/{owner_username}/{project_slug}/{list_slug}/export/{filename}.csv  ← no creds needed
```

---

### 6.5 Permission Class

```python
# api/permissions.py
from rest_framework.permissions import BasePermission

class IsProjectWriteAuthorized(BasePermission):
    """
    Grants access to Kobo write endpoints (/add, /remove, /delete) based on the
    choice list's require_auth setting:
    - require_auth=False: allow anyone (no credentials needed)
    - require_auth=True:  allow only the project owner or a ProjectShare member
    """
    def has_permission(self, request, view):
        choice_list = view.get_choice_list()   # resolved in the view from the URL kwargs
        if not choice_list.require_auth:
            return True  # open write access — no credentials required
        if not request.user or not request.user.is_authenticated:
            return False
        project = choice_list.project
        return (
            project.owner == request.user
            or project.shares.filter(user=request.user).exists()
        )
```

**`get_choice_list()` method to add to each Kobo write view** (`KoboAddChoiceView`, `KoboRemoveChoiceView`, `KoboDeleteChoiceView`):

```python
def get_choice_list(self):
    """Used by IsProjectWriteAuthorized to resolve the choice list from URL kwargs."""
    # self.kwargs['username'] is the project OWNER's username (from the URL),
    # not necessarily the requester's credentials.
    project = get_object_or_404(
        Project,
        slug=self.kwargs['project_id'],
        owner__username=self.kwargs['username'],
    )
    return get_object_or_404(ChoiceList, project=project, slug=self.kwargs['choice_list_name'])
```

> `self.kwargs` is set automatically by Django's URL dispatcher on `APIView`. The permission class calls `view.get_choice_list()` before the view's `post()` runs, so the duplicate lookup is a minor inefficiency — acceptable given the simplicity.

---

### 6.6 Frontend Changes

**ChoiceListsPage — tab split:**
- **My Projects** tab (default): owned projects + projects shared with the current user
  - Shared projects show a "Shared by [owner_username]" badge
  - Owner-only controls (delete project, settings, share management) hidden for shared users
- **Public Projects** tab:
  - Search bar sending `?search=` to `/api/projects/public/`
  - Each card/row shows: project name, owner username, last updated date (of project or most recently updated list), list count
  - Clicking a public project opens a read-only view of its lists with CSV copy-links only — no edit controls
  - If the viewer is already the owner or a shared user, a "Go to My Projects" link is shown instead

**Project settings (new modal or expandable panel in project detail):**
- Toggle: **"Make this project public"** (patches `is_public`); owner-only
- **Sharing section**:
  - Current shares table: username, date added, "Remove" button
  - Add-by-username input + "Share" button; shows inline error if username not found
  - Owner cannot remove themselves; cannot share with a user who is already a share
- Panel hidden entirely (or shown read-only) for non-owners

**ChoiceListDetailPage — Kobo integration panel additions:**
- **Write-auth toggle**: "Require authentication for write endpoints" (default: on); owner or shared user only
  - Toggling **off** shows an inline warning: "Anyone with this URL can add or remove choices. Only disable this for trusted environments."
  - When off, the Kobo integration panel shows the add/remove URLs without credential instructions and notes that no auth is needed
- Show the Basic Auth credentials note: "Use your username and password when configuring KoboToolbox REST service" — **only shown when `require_auth=True`**
- Display the add/remove URLs (with or without credential format depending on `require_auth`)

**New API client calls (`api.ts`):**
```typescript
getPublicProjects: (search?: string) => API.get('/projects/public/', { params: { search } }),
getPublicProject:  (id: string)      => API.get(`/projects/public/${id}/`),
getProjectShares:  (id: string)      => API.get(`/projects/${id}/shares/`),
shareProject:      (id: string, username: string) =>
                     API.post(`/projects/${id}/share/`, { username }),
removeProjectShare:(id: string, username: string) =>
                     API.delete(`/projects/${id}/share/${username}/`),
updateProject:     (id: string, data: Partial<Project>) =>
                     API.patch(`/projects/${id}/`, data),
```

---

### 6.7 Security Considerations

- **Basic Auth over HTTPS only**: Basic Auth sends credentials as a base64-encoded header on every request. Must enforce HTTPS in production (Nginx redirect). Document a warning in development mode.
- **Open write access risk**: when `require_auth=False` on a list, any party that knows the URL can add or remove choices. This is intentional for low-security or internal workflows, but the UI must make this risk explicit with a visible warning on toggle.
- **`require_auth` defaults to `True`**: new lists are always protected; users must consciously opt out.
- **CSV export never challenges for credentials**: CSV export views must use `authentication_classes=[]` so that unauthenticated requests never receive a `401`/`403` — KoboToolbox fetches the CSV unconditionally and will error if challenged.
- **Username enumeration on share**: The `POST /share/` endpoint returns `400` if the username is not found, which reveals whether a username exists. Acceptable for an internal tool; if stricter privacy is needed, always return `200` and send a notification instead.
- **Share escalation prevention**: Shared users cannot invoke the share, unshare, or `is_public` endpoints — enforced at the permission layer, not just the UI.
- **CSRF**: Basic Auth requests from KoboToolbox are non-session and bypass CSRF; session-based UI calls retain normal CSRF protection.
- **Project slug exposure**: project slugs are already non-secret UUIDs in URLs; Basic Auth on write endpoints ensures the public-facing slug cannot be abused to inject choices without credentials.

---

### 6.8 Implementation Checklist

**Backend:**
- [ ] Add `is_public` field to `Project` model (`updated_at` already exists)
- [ ] Add `require_auth` (default `True`) field to `ChoiceList` model (`updated_at` already exists)
- [ ] Create `ProjectShare` model (`project` FK, `user` FK, `unique_together`)
- [ ] Run `python manage.py makemigrations && python manage.py migrate`
- [ ] Create `api/permissions.py` with `IsProjectWriteAuthorized` (checks `require_auth` first, then owner/share membership)
- [ ] Add `get_choice_list()` method to `KoboAddChoiceView`, `KoboRemoveChoiceView`, and `KoboDeleteChoiceView` (see §6.5 for implementation)
- [ ] Update `KoboAddChoiceView`, `KoboRemoveChoiceView`, and `KoboDeleteChoiceView` to use `authentication_classes = [SessionAuthentication, BasicAuthentication]` and `permission_classes = [IsProjectWriteAuthorized]`
- [ ] Confirm `KoboCSVExportView` keeps `authentication_classes=[]` and `permission_classes=[AllowAny]` — do NOT change global `DEFAULT_AUTHENTICATION_CLASSES`
- [ ] Expand `ProjectViewSet` queryset: `owner=user` **union** `shares__user=user` (use `.distinct()`)
- [ ] Add computed `role` field (`"owner"` / `"shared"`) to `ProjectSerializer`
- [ ] Add `owner_username`, `updated_at`, `list_count` to serializer for public endpoints
- [ ] Add `is_public` to `ProjectSerializer` (read/write for owner; read-only for shared users — enforce in `update()`)
- [ ] Add `require_auth` to `ChoiceListSerializer` (writable by owner or shared user; `updated_at` already in serializer)
- [ ] Implement share management actions on `ProjectViewSet`: `shares`, `share`, `unshare` (router actions)
- [ ] Implement `PublicProjectViewSet` (read-only, `AllowAny`, supports `?search=`); register its URL **before** `include(router.urls)` in `api/urls.py` so that `/api/projects/public/` takes precedence over the `{slug}` pattern (or use a separate prefix like `/api/public/projects/`)
- [ ] Register new routes in `api/urls.py`
- [ ] Update `ChoiceListViewSet` and `ChoiceViewSet` querysets to include shared-project data
- [ ] Add owner-only guard for `is_public`, `share`, `unshare` actions (raise `PermissionDenied` for shared users)

**Frontend:**
- [ ] Refactor `ChoiceListsPage` into "My Projects" / "Public Projects" tab layout
- [ ] Build `PublicProjectsPage` component: search bar, project cards with owner + `updated_at` + list count
- [ ] Build `PublicProjectDetailPage`: read-only list of choice lists + CSV copy-link per list
- [ ] Add project settings panel/modal: `is_public` toggle + share management section (add by username, list current shares, remove button)
- [ ] Show "Shared by [owner_username]" badge on shared projects in My Projects tab
- [ ] Conditionally hide owner-only controls (delete project, settings, share management) based on `role`
- [ ] Update `apiClient` in `api.ts` with new methods (see §6.6)
- [ ] Add "Require authentication for write endpoints" toggle to Kobo integration panel in `ChoiceListDetailPage` (owner/shared user only; defaults to on)
- [ ] Show inline security warning when `require_auth` is toggled off
- [ ] Conditionally show/hide Basic Auth credential instructions in Kobo integration panel based on `require_auth`
- [ ] Update `useChoiceLists` hook or add `useProjects` hook to surface `role` and shared-project data
- [ ] Update `README.md` (auth model, sharing, public projects, Basic Auth for KoboToolbox)
- [ ] Update `HelpPage.tsx` (sharing section, public projects section, Basic Auth credentials note)
- [ ] Update `memory.md` with current project state (see §0 in `plan.md`)

---

## Phase 7: Collections

### 7.1 Overview

Collections are named groupings of Projects. They are the top level of the content hierarchy and support the same public/share model introduced in Phase 6:

```
Collection
  └── Project ("Afghanistan")
        └── ChoiceList ("province")
              └── Choice
        └── ChoiceList ("district")
  └── Project ("Bangladesh")
        └── ChoiceList ("division")
```

**Primary use case:** a user creates a *Global PCodes* collection, adds one project per country, and each project holds admin-level choice lists (province, district, community, etc.). The whole collection can be made public so any KoboToolbox user can browse it and copy the CSV links.

**Key design decisions:**
- A project can belong to multiple collections (M2M via `CollectionProject`).
- Collection membership does **not** cascade project-level write permissions — project access is still controlled independently by `ProjectShare`.
- Making a collection public makes its project listing discoverable; it does not change who can edit its member projects.
- CSV export links are always public (no auth required) regardless of collection visibility — collection `is_public` only controls discoverability of the collection index.

---

### 7.2 Database Changes

**New `Collection` model:**
```python
class Collection(models.Model):
    name        = models.CharField(max_length=255)
    slug        = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    owner       = models.ForeignKey(User, on_delete=models.CASCADE,
                                    related_name='collections')
    is_public   = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
```

**New `CollectionProject` join model:**
```python
class CollectionProject(models.Model):
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE,
                                   related_name='collection_projects')
    project    = models.ForeignKey(Project, on_delete=models.CASCADE,
                                   related_name='collection_memberships')
    order      = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('collection', 'project')
        ordering = ['order']
```

**New `CollectionShare` model:**
```python
class CollectionShare(models.Model):
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE,
                                   related_name='shares')
    user       = models.ForeignKey(User, on_delete=models.CASCADE,
                                   related_name='shared_collections')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('collection', 'user')
```

**Required migration:** create all three tables.

---

### 7.3 Authorization Model

| Action | Who can perform it |
|--------|-------------------|
| Browse/search public collections | **Anyone** |
| View a public collection's project & list index | **Anyone** |
| Access CSV links within a collection | **Anyone** (always public) |
| Create a collection | Any authenticated user |
| Add / remove projects from a collection | Collection owner **or** CollectionShare member |
| Rename, change description, toggle `is_public` | **Collection owner only** |
| Share / unshare a collection | **Collection owner only** |
| Delete a collection | **Collection owner only**; does **not** delete member projects |

---

### 7.4 API Endpoints

**Public (no auth):**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/collections/public/` | List public collections; `?search=` on name, description, owner username; returns `id`, `name`, `slug`, `owner_username`, `description`, `project_count`, `updated_at` |
| `GET` | `/api/collections/public/{id}/` | Collection detail: metadata + list of member projects (each with `list_count`, `updated_at`) including their CSV links |

**Authenticated:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/collections/` | My collections (owned + shared); each includes `role` (`"owner"` / `"shared"`), `owner_username`, `project_count` |
| `POST` | `/api/collections/` | Create collection |
| `GET` | `/api/collections/{id}/` | Detail |
| `PATCH` | `/api/collections/{id}/` | Update; `is_public` owner-only |
| `DELETE` | `/api/collections/{id}/` | Delete (owner only) |
| `POST` | `/api/collections/{id}/add_project/` | Body `{"project_id": "..."}` — owner or shared member |
| `DELETE` | `/api/collections/{id}/remove_project/{project_id}/` | Owner or shared member |
| `GET` | `/api/collections/{id}/shares/` | List shares (owner only) |
| `POST` | `/api/collections/{id}/share/` | Body `{"username": "..."}` (owner only) |
| `DELETE` | `/api/collections/{id}/share/{username}/` | Owner only |

---

### 7.5 Navigation & UI

**Top-level navigation — new entry:** Collections (alongside existing My Projects / Public Projects).

**My Collections page (`/collections`):**
- Lists owned collections + collections shared with the current user
- Each row/card shows: collection name, description excerpt, owner (for shared), project count, `updated_at`, public badge
- "New Collection" button
- Shared collections: "Shared by [owner_username]" badge; no delete/settings access

**Collection detail page (`/collections/{id}`):**
- Project list: each project shows name, list count, `updated_at`
- Click a project → navigates to that project's existing detail page
- **Add Project** control: dropdown of the current user's owned/shared projects → POST `add_project`
- **Remove Project** button per row (owner or shared member only)
- **Collection settings panel** (owner only): name, description, `is_public` toggle, share management (add by username, current shares table, remove button)
- Breadcrumb: `Collections > Collection Name`

**Public Collections page (`/collections/public`):**
- Search bar → `?search=` to `/api/collections/public/`
- Cards: name, owner username, description excerpt, project count, `updated_at`

**Public Collection detail page (`/collections/public/{id}`):**
- Read-only list of member projects
- Expand project → reveals its choice lists with CSV copy-link per list
- No edit controls
- If the viewer is already owner or shared member, show "Go to My Collections" link instead of read-only view

**Project detail page — collection context:**
- Show a "Collections" chip/tag for each collection this project belongs to; clicking navigates to that collection

**New `apiClient` methods (`api.ts`):**
```typescript
getCollections:              ()                   => API.get('/collections/'),
createCollection:            (data: {...})        => API.post('/collections/', data),
updateCollection:            (id, data)           => API.patch(`/collections/${id}/`, data),
deleteCollection:            (id)                 => API.delete(`/collections/${id}/`),
getPublicCollections:        (search?: string)    => API.get('/collections/public/', { params: { search } }),
getPublicCollection:         (id)                 => API.get(`/collections/public/${id}/`),
addProjectToCollection:      (collId, projectId)  => API.post(`/collections/${collId}/add_project/`, { project_id: projectId }),
removeProjectFromCollection: (collId, projectId)  => API.delete(`/collections/${collId}/remove_project/${projectId}/`),
getCollectionShares:         (id)                 => API.get(`/collections/${id}/shares/`),
shareCollection:             (id, username)       => API.post(`/collections/${id}/share/`, { username }),
removeCollectionShare:       (id, username)       => API.delete(`/collections/${id}/share/${username}/`),
```

---

### 7.6 Security Considerations

- **No permission escalation through collections:** being a `CollectionShare` member of a collection does not grant any access to modify the projects inside it. Those projects still require their own `ProjectShare` entry.
- **Public collection does not expose private project contents:** browsing a public collection only reveals the project name and list names. The CSV content itself is always public, but this is by design (it's the same as direct CSV URLs which are already public). Private list contents (choice values) are exposed only via the CSV, which is intentional.
- **Slug uniqueness:** collection slugs are globally unique (like project slugs); they are non-secret and safe to use in URLs.
- **Cascade caution:** deleting a collection must NOT cascade-delete its member projects — enforced via `ForeignKey(on_delete=PROTECT)` or explicit check in the delete view.

---

### 7.7 Implementation Checklist

**Backend:**
- [ ] Create `Collection`, `CollectionProject`, `CollectionShare` models
- [ ] Run `python manage.py makemigrations && python manage.py migrate`
- [ ] Register models in `api/admin.py`
- [ ] Create `IsCollectionWriteAuthorized` permission (owner or `CollectionShare` member)
- [ ] Implement `CollectionViewSet` with `add_project`, `remove_project`, `shares`, `share`, `unshare` actions
- [ ] Implement `PublicCollectionViewSet` (read-only, `AllowAny`, `?search=`)
- [ ] Register routes in `api/urls.py`
- [ ] Add `role`, `owner_username`, `project_count`, `updated_at` to `CollectionSerializer`
- [ ] Add collection membership list (id, name, slug) to `ProjectSerializer`
- [ ] Guard `is_public`, delete, share/unshare as owner-only (raise `PermissionDenied` for shared users)

**Frontend:**
- [ ] Add "Collections" entry to main navigation
- [ ] Build `MyCollectionsPage` (`/collections`): list owned + shared, create button
- [ ] Build `CollectionDetailPage` (`/collections/{id}`): project list, add/remove project, settings panel
- [ ] Build `PublicCollectionsPage` (`/collections/public`): search + cards
- [ ] Build `PublicCollectionDetailPage` (`/collections/public/{id}`): read-only + CSV links
- [ ] Add collection membership chips to `ChoiceListsPage` project rows (or project detail header)
- [ ] Update `apiClient` in `api.ts` with collection methods (see §7.5)
- [ ] Update `README.md` (data model, collections API, navigation changes)
- [ ] Update `HelpPage.tsx` (collections section, use-case example with pcodes hierarchy)
- [ ] Update `memory.md` with current project state (see §0 in `plan.md`)

---

## Phase 8: Production Deployment

### 8.1 Overview

Hardens the service for a public-facing deployment at `choices.imtools.info`. Can be done after Phase 6 alone or after both Phase 6 and Phase 7, depending on readiness.

---

### 8.2 Implementation Checklist

- [ ] Nginx reverse proxy setup (routes to Django via Gunicorn)
- [ ] Let's Encrypt HTTPS (required for Basic Auth to be safe — see Phase 6 security notes)
- [ ] PostgreSQL database (migrate from SQLite; update `settings.py` and `requirements.txt`)
- [ ] Switch Django to production settings: `DEBUG=False`, proper `ALLOWED_HOSTS`, `SECRET_KEY` from env
- [ ] Production server setup (systemd or Docker Compose with restart policies)
- [ ] Health checks & monitoring
- [ ] Error logging (Sentry)
- [ ] Automated testing & CI/CD
- [ ] Update `README.md` (production deployment section — Nginx, HTTPS, PostgreSQL, env vars)
- [ ] Update `HelpPage.tsx` if any production-specific user guidance is needed
- [ ] Update `memory.md` with current project state (see §0 in `plan.md`)
