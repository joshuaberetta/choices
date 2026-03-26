# Plan: HDX Global Pcodes → Choices Server

## Goal

Replace the XLSForm-based upload pipeline (`hdx_pcodes_to_kobo.py`) with a new script that:

1. Downloads the global pcodes file from HDX (unchanged).
2. For each country, splits choices by admin level into separate in-memory CSV payloads (`level_1.csv`, `level_2.csv`, … `level_N.csv`).
3. Creates/updates the corresponding data on the choices server:
   - One **Project** per country (e.g. "Sudan"), marked public.
   - One **ChoiceList** per admin level per country (slug `level_1`, `level_2`, …).
   - Choices imported via CSV (name = pcode, label = place name).
4. Groups all country projects into a single **"Global Pcodes" Collection**, also marked public.

The new script will be `hdx_pcodes_to_choices.py`. The existing `hdx_pcodes_to_kobo.py` is left unchanged for the KoboToolbox workflow.

---

## Architecture Overview

```
HDX API
  └─ global_pcodes.csv
       └─ parse into: {country_code: {level_n: [(pcode, name), ...]}}
            └─ for each country / level
                 └─ POST to choices server API
                      ├─ GET or create Collection "Global Pcodes"
                      ├─ GET or create Project (slug = country_code.lower())
                      │    └─ PATCH is_public = True
                      │    └─ POST add to collection
                      └─ GET or create ChoiceList (slug = level_N)
                           └─ POST import CSV (replaces choices)
```

---

## Phase 1: Config & Setup

### 1.1 Config file (`config.json` additions)

Add a `choices_config` block alongside the existing `kobo_config`:

```json
{
  "choices_config": {
    "base_url": "https://choices.imtools.info",
    "username": "admin",
    "password": "..."
  }
}
```

### 1.2 Script skeleton (`hdx_pcodes_to_choices.py`)

Reuse from existing script:
- `get_config()` — extend to parse `choices_config`
- `get_country_code_map()` — unchanged
- `connect_to_hdx()` — unchanged
- `download_global_pcodes()` — unchanged

New additions:
- `parse_pcodes(pcodes_path)` → `dict[country_code, dict[level_int, list[tuple[pcode, name]]]]`
- `ChoicesClient` class wrapping all API interactions
- `sync_country(client, collection_id, country_code, country_name, levels)` — per-country orchestration
- `main()` — top-level driver

---

## Phase 2: Data Parsing

### `parse_pcodes(pcodes_path) -> dict`

Read `global_pcodes.csv` (downloaded from HDX). The file has columns:
- `Location` — ISO-3 country code
- `Admin Level` — integer (1, 2, 3, …)
- `P-Code` — the pcode value
- `Name` — human-readable label

Skip row 0 (units/description row, same as existing script).

Return structure:
```python
{
  "SDN": {
    1: [("SD01", "Khartoum"), ("SD02", "North Darfur"), ...],
    2: [("SD01001", "Jebel Awlia"), ...],
  },
  "AFG": { ... },
  ...
}
```

---

## Phase 3: API Client (`ChoicesClient`)

All server interactions go through one authenticated session.

### 3.1 Authentication

```
GET  /api/auth/csrf/      → sets CSRF cookie
POST /api/auth/login/     → body: {username, password} → sets session cookie
```

Use a `requests.Session` so cookies persist across all calls. Store the CSRF token from the cookie (`csrftoken`) and send it as the `X-CSRFToken` header on all non-GET requests.

### 3.2 Collection: get or create "Global Pcodes"

```
GET  /api/collections/
```
Returns all collections owned by or shared with the authenticated user. No server-side name filter is supported — iterate the results client-side and match on `name == "Global Pcodes"`. If not found:
```
POST /api/collections/    body: {name: "Global Pcodes", slug: "global-pcodes", is_public: true}
```
Return the collection `id`.

Then ensure it is public if found but not yet public:
```
PATCH /api/collections/{id}/    body: {is_public: true}
```

### 3.3 Project: get or create per country

The project slug is `country_code.lower()` (e.g. `sdn` for Sudan).

**Get:** try
```
GET /api/projects/{slug}/
```
If 404, create:
```
POST /api/projects/    body: {name: <country_name>, slug: <country_code.lower()>}
```

After create (or if found but not yet public):
```
PATCH /api/projects/{slug}/    body: {is_public: true}
```

Add to collection (idempotent — server returns 400 if already added; catch and ignore):
```
POST /api/collections/{collection_id}/add_project/    body: {project_id: <project.id>}
```

### 3.4 ChoiceList: get or create per level

```
GET /api/choice-lists/?project_slug={project_slug}&slug={level_slug}
```
If results is empty, create:
```
POST /api/choice-lists/    body: {project: <project_id>, slug: "level_N", name: "Level N"}
```

### 3.5 Import choices into ChoiceList

Build a CSV string in memory:
```
name,label
SD01,Khartoum
SD02,North Darfur
...
```

POST as multipart/form-data:
```
POST /api/choice-lists/{id}/import/    file=<in-memory CSV>
```

This replaces all existing choices on every run (idempotent/refreshable).

---

## Phase 4: Orchestration (`main`)

```python
def main():
    config = get_config()
    country_code_map = get_country_code_map()   # code → full name
    connect_to_hdx()

    # 1. Download
    download_global_pcodes(config['pcodes_file'], config['pcodes_path'])

    # 2. Parse
    pcodes = parse_pcodes(config['pcodes_path'])

    # 3. Connect to choices server
    client = ChoicesClient(config['choices_config'])
    client.login()

    # 4. Ensure collection exists
    collection_id = client.get_or_create_collection("Global Pcodes", "global-pcodes")

    # 5. Per-country loop
    for country_code, levels in pcodes.items():
        country_name = country_code_map.get(country_code, country_code)
        print(f"Syncing {country_code} ({country_name}) — {len(levels)} levels")
        try:
            sync_country(client, collection_id, country_code, country_name, levels)
        except Exception as e:
            print(f"  ERROR: {e}")
            continue   # skip to next country; don't abort the whole run
```

---

## Phase 5: Error Handling & Idempotency

| Scenario | Handling |
|---|---|
| Collection already exists | GET it; PATCH if not public |
| Project already exists | GET it; PATCH if not public; add_project returns 400 → ignore |
| ChoiceList already exists | GET it; re-import replaces choices |
| Country code not in `country_code_map` | Use code as fallback name; log warning |
| HTTP error from choices server | Log and `continue` — don't abort whole run |
| HDX download error | Raise immediately (fatal) |

The script is designed to be re-run safely at any time: existing data is refreshed rather than duplicated.

---

## Phase 6: Testing

### 6.1 Dry-run mode

Add a `--dry-run` CLI flag (via `argparse`). When set:
- Skip all POST/PATCH calls to the choices server
- Print what would be created/updated
- Still download pcodes and parse them (validates data pipeline)

### 6.2 Single-country mode

Add `--country SDN` flag to sync only one country. Useful for testing before a full run.

### 6.3 Offline mode

Add `--skip-download` flag to reuse an already-downloaded `global_pcodes.csv` without hitting HDX again.

---

## File structure after implementation

```
choices/
  hdx_pcodes_to_kobo.py      # unchanged — still used for KoboToolbox workflow
  hdx_pcodes_to_choices.py   # new script
  config.json                # add choices_config block (not committed)
  country_code.csv           # unchanged
```

---

## API endpoint summary (choices server)

| Purpose | Method | URL |
|---|---|---|
| Get CSRF cookie | GET | `/api/auth/csrf/` |
| Login | POST | `/api/auth/login/` |
| List collections | GET | `/api/collections/` |
| Create collection | POST | `/api/collections/` |
| Update collection | PATCH | `/api/collections/{id}/` |
| Get project | GET | `/api/projects/{slug}/` |
| Create project | POST | `/api/projects/` |
| Update project | PATCH | `/api/projects/{slug}/` |
| Add project to collection | POST | `/api/collections/{id}/add_project/` |
| List choice lists | GET | `/api/choice-lists/?project_slug=…&slug=…` |
| Create choice list | POST | `/api/choice-lists/` |
| Import CSV into choice list | POST | `/api/choice-lists/{id}/import/` |

---

## Open questions / decisions

- **Slug collisions**: project slugs are `owner`+`slug` unique, so two different users can have `sdn`. The script should log in as one dedicated service account (e.g. `pcodes-bot`).
- **Country name sourcing**: `country_code_map` derives the display name from `country_code.csv`. If a country code appears in the pcodes file but not in `country_code.csv`, the code itself is used as the name and a warning is printed.
- **Level naming**: levels are named `Level 1`, `Level 2`, etc. The pcodes file doesn't include level names (e.g. "State", "District") — if per-country level labels are needed later, that's a future enhancement.
- **Re-run behaviour**: every run replaces all choices for every level of every country. This is intentional — it keeps the data in sync with the latest HDX source. Consider adding a `--since` date flag later if HDX provides change tracking.
