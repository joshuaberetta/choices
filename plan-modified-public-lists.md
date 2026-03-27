# Plan: Following & Customising Public Lists

## Overview

Users need to "follow" public choice lists (reached via a public Collection or directly via a public Project) and maintain a **personal customised view** of those lists — primarily to rename column headers for XLSForm translations — without touching the original data.

Example use-case:
- Original list exports: `name, label`
- User A follows the list and their export gives: `name, label::Español (es)`
- User B follows the same list and their export gives: `name, label::French (fr)`
- User C adds two columns: `name, label::English (en), label::Español (es)` (with their own values)

The original list and its data are never modified by followers.

---

## Data Model (new tables)

### `UserChoiceListConfig`
The "follow" record. One per (user, choice_list) pair.

```python
class UserChoiceListConfig(models.Model):
    user        = models.ForeignKey(User, on_delete=models.CASCADE, related_name='followed_lists')
    choice_list = models.ForeignKey(ChoiceList, on_delete=models.CASCADE, related_name='follower_configs')
    label_column_name = models.CharField(
        max_length=255, blank=True, default='',
        help_text="Overrides the list's label_column_name in exports. Blank = inherit original."
    )
    # Placeholder for possible future name/value column header override:
    # name_column_name = models.CharField(max_length=255, blank=True, default='')
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'choice_list')
```

**In the CSV export** the effective label column name is:
```
config.label_column_name  OR  (if blank)  choice_list.label_column_name  OR  'label'
```

### `UserChoiceListColumn`
Extra columns the follower adds on top of the original list's columns. Values are per-choice.

```python
class UserChoiceListColumn(models.Model):
    config = models.ForeignKey(UserChoiceListConfig, on_delete=models.CASCADE, related_name='columns')
    name   = models.CharField(max_length=255)
    order  = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('config', 'name')
        ordering = ['order', 'id']
```

### `UserChoiceExtraValue`
The cell value for a user-added column on a specific choice.

```python
class UserChoiceExtraValue(models.Model):
    config  = models.ForeignKey(UserChoiceListConfig, on_delete=models.CASCADE, related_name='extra_values')
    choice  = models.ForeignKey(Choice, on_delete=models.CASCADE, related_name='user_extra_values')
    column  = models.ForeignKey(UserChoiceListColumn, on_delete=models.CASCADE, related_name='values')
    value   = models.TextField(blank=True, default='')

    class Meta:
        unique_together = ('config', 'choice', 'column')
```

**Notes on existing columns:** The original list's `ChoiceListColumn` rows and their `ChoiceExtraValue` rows appear unchanged in the follower's export. The user's `UserChoiceListColumn` rows are appended after the original extra columns.

---

## CSV Export Shape (for a follower)

| segment | source |
|---------|--------|
| `name` | Choice.value (original) |
| effective label header (user override or original) | Choice.label (original) |
| original extra columns | ChoiceListColumn + ChoiceExtraValue (original, read-only to follower) |
| user extra columns | UserChoiceListColumn + UserChoiceExtraValue (follower-owned) |

---

## API Endpoints (new)

All endpoints require `IsAuthenticated` (session auth).

### Follow / Unfollow

| Method | URL | Description |
|--------|-----|-------------|
| `POST`   | `/api/user-choice-lists/` | Follow a list. Body: `{choice_list: <id>}`. Returns config object. |
| `GET`    | `/api/user-choice-lists/` | List all followed configs for current user (with original list name, project name). |
| `GET`    | `/api/user-choice-lists/{id}/` | Get a single config. |
| `PATCH`  | `/api/user-choice-lists/{id}/` | Update `label_column_name` override. |
| `DELETE` | `/api/user-choice-lists/{id}/` | Unfollow (deletes config + user columns + user extra values). |

### Export

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/{follower_username}/{project_slug}/custom/{list_slug}.csv` | **Public**, no auth. CSV download with the follower's column customisations. |

**Auth model for export:** The export URL is **publicly accessible with no authentication**, matching the behaviour of the existing Kobo CSV endpoints. The URL is deterministic — derived from the follower's username, the original project slug, and the list slug — with a `/custom/` path segment to distinguish it from the original list's Kobo CSV URL. There is no secret token; the URL is enumerable but since it only exposes data from a public list with the follower's own column customisations, this is acceptable.

URL format:
```
/{follower_username}/{project_slug}/custom/{list_slug}.csv
```
Example:
```
/admin/sudan/custom/level_1.csv
```

This URL is returned in the `UserChoiceListConfig` serializer as `export_url` and displayed as a copy-link in the UI.

### User Extra Columns (CRUD)

| Method | URL | Description |
|--------|-----|-------------|
| `POST`   | `/api/user-choice-lists/{id}/add_column/` | Add a user column. Body: `{name}`. |
| `PATCH`  | `/api/user-choice-lists/{id}/update_column/` | Rename a user column. Body: `{column_id, name}`. |
| `DELETE` | `/api/user-choice-lists/{id}/remove_column/` | Delete a user column and all its values. Body: `{column_id}`. |
| `PATCH`  | `/api/choices/{choice_id}/set_user_extra_value/` | Set a cell value. Body: `{config_id, column_id, value}`. |

Alternatively, make user columns a nested resource: `POST /api/user-choice-lists/{id}/columns/` etc. — mirror the shape of existing column endpoints for consistency.

### CSV Import for User Extra Columns

| Method | URL | Description |
|--------|-----|--------------|
| `POST` | `/api/user-choice-lists/{id}/import/` | Upload a CSV to bulk-insert/update user extra column values. The CSV must contain a `name` (or `value`) column to match choices; remaining columns are treated as user extra column names to upsert. |

This lets a translator upload a spreadsheet of translated labels without clicking every cell. Unrecognised column names in the uploaded CSV are auto-created as new `UserChoiceListColumn` rows.

---

## Migrations

`0011_phase9_user_follow_configs.py`
- Create `UserChoiceListConfig`
- Create `UserChoiceListColumn`
- Create `UserChoiceExtraValue`

---

## Implementation Context (for a fresh agent)

### Key file locations

| File | Purpose |
|------|---------|
| `backend/api/models.py` | All Django models — add new models here |
| `backend/api/serializers.py` | All DRF serializers |
| `backend/api/views.py` | All ViewSets and APIViews |
| `backend/api/urls.py` | `/api/…` routes (DRF router + auth endpoints) |
| `backend/choices/urls.py` | Root-level routes — **this is where `UserCustomCSVExportView` must be registered**, alongside the existing `KoboCSVExportView` |
| `backend/api/admin.py` | Django admin registrations |
| `backend/api/migrations/` | Migrations (next will be `0011_…`) |
| `frontend/src/pages/` | React page components |
| `frontend/src/hooks/` | React data hooks (e.g. `useChoiceLists.ts`) |
| `frontend/src/services/api.ts` | All axios API calls |
| `frontend/src/App.tsx` | Routes and navigation header |

### Dev commands (run from `backend/`)
```bash
python manage.py makemigrations api   # after editing models.py
python manage.py migrate
python manage.py runserver            # dev server on :8000
python manage.py test api             # run backend tests
```
Frontend (run from `frontend/`): `npm run dev` — proxies `/api/` and `/<username>/` to `:8000` via Vite config.

### URL registration pattern
`choices/urls.py` (root) is where non-`/api/` URLs live. New export view goes here:
```python
# choices/urls.py — add alongside KoboCSVExportView imports and paths:
from api.views import ..., UserCustomCSVExportView

path('<str:follower_username>/<str:project_slug>/custom/<str:list_slug>.csv',
     UserCustomCSVExportView.as_view(), name='user-custom-csv-export'),
```
Must be declared **before** the existing `<str:username>/<str:project_id>/…` patterns to avoid the `custom` segment being swallowed as a `project_id`.

### Existing patterns to mirror exactly

**ViewSet authenticated by default** — `ProjectViewSet`/`ChoiceListViewSet`/`ChoiceViewSet` all use `IsAuthenticated` via DRF default settings. No need to declare `permission_classes` explicitly on `UserChoiceListConfigViewSet`.

**`add_column` / `update_column` / `remove_column`** on `ChoiceListViewSet` (lines 348–400 of `views.py`) are the exact pattern to mirror for `UserChoiceListConfigViewSet`. The only difference: no reserved system-column check is needed for user columns (all are user-created, none are system columns).

**`set_extra_value`** on `ChoiceViewSet` (line 423) is the pattern for the new user-extra-value action. Key difference: validate that `column` belongs to the given `config` (i.e. `UserChoiceListColumn.objects.get(id=column_id, config=config)`) and that `config.user == request.user`.

**`import_csv`** on `ChoiceListViewSet` (line 248) is the pattern for the new user-import action. Key difference: **do NOT delete existing choices** — this import only upserts `UserChoiceExtraValue` rows for matching choices (matched by `name`/`value`). Rows in the CSV with no matching choice are skipped (return a warning count). Auto-create missing `UserChoiceListColumn` rows.

**`export`** on `ChoiceListViewSet` (line 233) is the pattern for the authenticated `/api/…` detail export. The public `UserCustomCSVExportView` mirrors `KoboCSVExportView` (line 438) instead.

**Serializer with computed field** — see `ChoiceListSerializer.get_choices_count` for the pattern. `export_url` on `UserChoiceListConfigSerializer` should be a `SerializerMethodField` returning:
```python
def get_export_url(self, obj):
    return f"/{obj.user.username}/{obj.choice_list.project.slug}/custom/{obj.choice_list.slug}.csv"
```

**`perform_create` ownership pattern** — see `ProjectViewSet.perform_create` which calls `serializer.save(owner=self.request.user)`. Do the same: `serializer.save(user=self.request.user)`.

### Important constraints
- The `UserChoiceListConfig` import endpoint **upserts** values — it never deletes choices from the original list
- `UserChoiceListColumn` has no reserved/system names — all columns are freely renameable and deleteable
- The `ChoiceList` a user follows must belong to a project where `is_public=True` **or** where the user is owner/shared — check in `perform_create`
- The public export view should return 404 (via `get_object_or_404`) if the config does not exist; no other error handling needed

---

## Backend Implementation Notes

### ViewSet: `UserChoiceListConfigViewSet`
- `queryset` filtered to `user=request.user`
- `perform_create` sets `user=request.user`; validates the target `ChoiceList` belongs to a public project or a project the user can read
- No `export` action on the ViewSet — the export URL is a **separate standalone `AllowAny` view** (see below)
- `add_column`, `update_column`, `remove_column` actions mirror the identical actions on `ChoiceListViewSet`
- `import_csv` action handles bulk user-column value upload (see Phase 9.5)

### Public export view (`UserCustomCSVExportView`)
Modelled directly on `KoboCSVExportView`. Registered as a standalone path, `AllowAny`, no `authentication_classes`.

```python
class UserCustomCSVExportView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, follower_username, project_slug, list_slug):
        config = get_object_or_404(
            UserChoiceListConfig,
            user__username=follower_username,
            choice_list__project__slug=project_slug,
            choice_list__slug=list_slug,
        )
        cl        = config.choice_list
        name_col  = 'name'
        label_col = config.label_column_name or cl.label_column_name or 'label'
        orig_cols = list(cl.columns.order_by('order', 'id'))
        user_cols = list(config.columns.order_by('order', 'id'))

        output = StringIO()
        writer = csv.writer(output)
        writer.writerow([name_col, label_col]
                        + [c.name for c in orig_cols]
                        + [c.name for c in user_cols])

        for choice in cl.choices.prefetch_related('extra_values', 'user_extra_values').all():
            ev_map  = {ev.column_id: ev.value for ev in choice.extra_values.all()}
            uev_map = {uev.column_id: uev.value
                       for uev in choice.user_extra_values.filter(config=config)}
            writer.writerow(
                [choice.value, choice.label]
                + [ev_map.get(col.id, '')  for col in orig_cols]
                + [uev_map.get(col.id, '') for col in user_cols]
            )

        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{list_slug}.csv"'
        return response
```

**URL routing note:** Registered in `urls.py` alongside the existing `KoboCSVExportView` pattern, using `custom` as a literal path segment that can never conflict with a project slug:
```python
path('<str:follower_username>/<str:project_slug>/custom/<str:list_slug>.csv',
     UserCustomCSVExportView.as_view()),
```
This must be declared **before** any catch-all project/list slug patterns.

---

## Frontend

### New: "Following" tab in ChoiceListsPage (or dedicated page `/following`)

Shows all `UserChoiceListConfig` records for the current user. Each row shows:
- Original list name + project name + owner username
- Current label column override (editable inline)
- Link to the detail view
- Public CSV export URL (copyable, no auth)
- Unfollow button

### New: `FollowedListDetailPage` (`/following/:configId`)

Mirrors `ChoiceListDetailPage` layout, with these differences:
- **Header section**: shows the original list name with "following" badge; link back to the public project
- **Column override card** (new): shows the label column name with an edit field; a "name column override" field (optional, Phase 2)
- **Choices table**: 
  - Original columns (name, label, original extra columns) are **read-only** — displayed but not editable
  - User extra columns are editable (same inline-edit UX as the existing extra column cells)
  - "+ Add column" button adds a `UserChoiceListColumn`
- **Export URL card**: shows the full public export URL (e.g. `/admin/sudan/custom/level_1.csv`); copy-link button
- **Import card**: upload CSV to bulk-fill user extra columns (same UX as the existing list-level CSV import)

### "Follow" button surface points

Add a **"Follow"** button (requires `IsAuthenticated`) to:
- `PublicProjectDetailPage` — one "Follow" button per choice list row
- `PublicCollectionDetailPage` — "Follow all lists in this collection" shortcut (bulk-creates configs), plus individual per-list buttons
- `ChoiceListDetailPage` (when viewing a shared project you don't own) — can follow individual lists too

If the user already follows a list, show "Following ✓" with a link to their config instead.

### Follow button UX

```
[ Follow ]  →  (POST /api/user-choice-lists/ {choice_list: id})
               → on success: show toast "Added to your Following list"
               → button changes to "Following ✓ · Open"
```

---

## Permissions Summary

| Action | Rule |
|--------|------|
| Follow a list | Authenticated; list must be on a public project or a project the user can read |
| View UserChoiceListConfig | Config owner only |
| Edit label override / user columns | Config owner only |
| Export CSV (`/{follower}/{project}/custom/{list}.csv`) | **Anyone** — public, no auth required |
| Unfollow | Config owner only |

Followers **cannot**:
- Edit the original Choice values, label, or value
- Edit the original ChoiceListColumn names
- Edit original ChoiceExtraValue cells
- Delete or add choices to the original list

---

## Phase Breakdown

### Phase 9.1 — Data model & migration
- [ ] Add `UserChoiceListConfig`, `UserChoiceListColumn`, `UserChoiceExtraValue` models to `models.py`
- [ ] Register all three models in `admin.py`
- [ ] Write and run migration `0011_phase9_user_follow_configs.py`

### Phase 9.2 — Backend API
- [ ] Serializers: `UserChoiceListConfigSerializer` (includes computed `export_url`), `UserChoiceListColumnSerializer`, `UserChoiceExtraValueSerializer`
- [ ] `UserChoiceListConfigViewSet` (CRUD; `perform_create` validates list is readable by requesting user)
- [ ] Column CRUD actions on viewset: `add_column`, `update_column`, `remove_column` (mirror `ChoiceListViewSet` equivalents)
- [ ] `set_user_extra_value` action on `ChoiceViewSet`; body `{config_id, column_id, value}`; validates `config.user == request.user`
- [ ] `UserCustomCSVExportView` (standalone `AllowAny` view, see pseudocode in Backend Implementation Notes)
- [ ] Register all new URLs in `urls.py`: ViewSet router + standalone export path before existing Kobo CSV patterns
- [ ] `import_csv` action on `UserChoiceListConfigViewSet`: parse CSV, match rows by `name`/`value`, auto-create missing `UserChoiceListColumn` rows, upsert `UserChoiceExtraValue` rows

### Phase 9.3 — Frontend: Following tab & detail page
- [ ] Add `useFollowedLists` hook in `hooks/` (mirrors `useChoiceLists`)
- [ ] Add `/following` route and `FollowingPage` (table of all followed configs: list name, project, label override inline-edit, copy-link, unfollow)
- [ ] Add `/following/:configId` route and `FollowedListDetailPage`
- [ ] Column override settings card: editable `label_column_name` field (save on blur/enter via PATCH)
- [ ] Choices table: original columns (`name`, `label`, original extra cols) rendered read-only; user extra cols editable inline
- [ ] User extra column add / rename / delete (same UX as existing extra column UI in `ChoiceListDetailPage`)
- [ ] User extra value inline cell editing (same UX as existing `ChoiceExtraValue` cells)
- [ ] Export URL card: full URL display, copy-to-clipboard button
- [ ] Add "Following" nav link in `App.tsx` header (auth-only, between "Collections" and other links)

### Phase 9.4 — Follow buttons on public pages
- [ ] On page load, fetch current user's followed list IDs (`GET /api/user-choice-lists/`) to pre-populate button states
- [ ] `PublicProjectDetailPage`: "Follow" / "Following ✓ · Open" button per choice list row
- [ ] `PublicCollectionDetailPage`: per-list "Follow" / "Following ✓ · Open" button + "Follow all" bulk action
- [ ] On follow success: toast "Added to your Following list"; button state updates without page reload

### Phase 9.5 — CSV import frontend
- [ ] Import card in `FollowedListDetailPage`: file picker + upload button (same component pattern as existing list-level import card)
- [ ] On import success: reload config data; show row-count success toast
- [ ] Display import errors inline (e.g. unmatched name/value rows)

### Phase 9.6 — Docs & memory update
- [ ] Update `memory.md` (Phase 9 summary: models, new endpoints, URL conventions, follow UX)
- [ ] Update `README.md` (new section: Following lists, custom CSV URLs, CSV import)
- [ ] Update `frontend/src/pages/HelpPage.tsx` (user-facing explanation of Follow, custom export URL, bulk CSV import)

---

## Open Questions / Decisions Before Implementation

1. ~~**Token vs session export**~~ — **decided**: public URL `/{follower}/{project}/custom/{list}.csv`, no auth required, deterministic from (follower username + project slug + list slug), consistent with existing Kobo CSV behaviour.
2. **Follow scope** — for now, follow is per `ChoiceList`. Do we also need "follow a project" (auto-follows all lists in it, including future ones added later)? This could be Phase 9.6 if needed.
3. **Column override for original extra columns** — should a follower be able to *rename* an original extra column in their export (alias it)? Possibly via a `UserChoiceListColumnAlias(config, orig_column, alias_name)` model. Defer to Phase 9.6 unless requested.
4. ~~**Sync behaviour**~~ — **decided**: when a new choice is added to the original list, user extra values are simply blank for that choice (consistent with how existing extra columns work; no special handling needed).
5. **Deletion cascade** — if an original ChoiceList is deleted (or its project is made private), what happens to `UserChoiceListConfig` rows? The `CASCADE` on the FK will delete them; consider notifying users first or at least logging the event.
