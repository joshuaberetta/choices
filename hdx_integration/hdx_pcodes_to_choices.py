#!/usr/bin/env python3
"""
hdx_pcodes_to_choices.py

Downloads the HDX global pcodes dataset and syncs each country's admin-level
choices into the choices server:

  - One Project per country (slug = ISO-3 code lowercased, e.g. "sdn")
  - One ChoiceList per admin level (slug = "level_1", "level_2", …)
  - All projects placed in a single "Global Pcodes" collection, marked public

Usage
-----
    python hdx_pcodes_to_choices.py [--dry-run] [--country SDN] [--skip-download]

Config
------
Reads config.json from the current directory.  Add a `choices_config` block:

    {
      "choices_config": {
        "base_url": "https://choices.imtools.info",
        "username": "admin",
        "password": "..."
      }
    }
"""

import argparse
import csv
import json
import os
import sys
import warnings

warnings.filterwarnings("ignore")

import requests
from collections import defaultdict

from hdx.api.configuration import Configuration
from hdx.data.dataset import Dataset


COUNTRY_CODE_FILE = "country_code.csv"
COLLECTION_NAME = "Global Pcodes"
COLLECTION_SLUG = "global-pcodes"


# ---------------------------------------------------------------------------
# Config helpers (shared with hdx_pcodes_to_kobo.py)
# ---------------------------------------------------------------------------

def get_country_code_map():
    with open(COUNTRY_CODE_FILE) as f:
        reader = csv.DictReader(f)
        return {row["code"]: row["country"] for row in reader}


def get_config(config=None):
    if config is None:
        with open("config.json", "r") as f:
            config = json.loads(f.read())

    config.setdefault("pcodes_file", "global_pcodes.csv")
    config.setdefault("pcodes_path", "/tmp/global_pcodes.csv")
    return config


# ---------------------------------------------------------------------------
# HDX helpers (shared with hdx_pcodes_to_kobo.py)
# ---------------------------------------------------------------------------

def connect_to_hdx():
    Configuration.create(
        hdx_site="prod",
        user_agent="Kobo_pcodes",
        hdx_read_only=True,
    )


def download_global_pcodes(pcodes_file, pcodes_path):
    datasets = Dataset.search_in_hdx(pcodes_file)
    resources = Dataset.get_all_resources(datasets)

    url = None
    for resource in resources:
        if pcodes_file in resource["name"]:
            url = resource["url"]
            break

    if url is None:
        raise RuntimeError(f"Could not find resource '{pcodes_file}' in HDX results")

    resp = requests.get(url)
    resp.raise_for_status()
    with open(pcodes_path, "wb") as f:
        f.write(resp.content)


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_pcodes(pcodes_path):
    """
    Parse the global_pcodes.csv file and return:

        {
          "SDN": {1: [("SD01", "Khartoum"), ...], 2: [("SD01001", "Jebel Awlia"), ...]},
          "AFG": {...},
          ...
        }

    Row 0 (index 0 after the header) is a units/description row and is skipped,
    matching the behaviour of the original hdx_pcodes_to_kobo.py script.
    """
    import pandas as pd

    df = pd.read_csv(pcodes_path, low_memory=False)
    df.drop(0, inplace=True)  # drop units row

    result = defaultdict(lambda: defaultdict(list))
    for _, row in df.iterrows():
        country = str(row["Location"]).strip()
        try:
            level = int(row["Admin Level"])
        except (ValueError, TypeError):
            continue
        pcode = str(row["P-Code"]).strip()
        name = str(row["Name"]).strip()
        result[country][level].append((pcode, name))

    # Convert to plain dicts so callers don't need to worry about defaultdict
    return {country: dict(levels) for country, levels in result.items()}


# ---------------------------------------------------------------------------
# Choices server API client
# ---------------------------------------------------------------------------

class ChoicesClient:
    """Thin wrapper around the choices server REST API."""

    def __init__(self, choices_config, dry_run=False):
        self.base_url = choices_config["base_url"].rstrip("/")
        self.username = choices_config["username"]
        self.password = choices_config["password"]
        self.dry_run = dry_run
        self.session = requests.Session()

    def _url(self, path):
        return f"{self.base_url}/api/{path.lstrip('/')}"

    def _csrf(self):
        """Return the current CSRF token from the session cookie jar."""
        return self.session.cookies.get("csrftoken", "")

    def _headers(self):
        return {"X-CSRFToken": self._csrf(), "Referer": self.base_url}

    def login(self):
        # Seed the CSRF cookie
        self.session.get(self._url("auth/csrf/"))
        resp = self.session.post(
            self._url("auth/login/"),
            json={"username": self.username, "password": self.password},
            headers=self._headers(),
        )
        resp.raise_for_status()
        print(f"Logged in as {self.username}")

    # ------------------------------------------------------------------
    # Collection
    # ------------------------------------------------------------------

    def get_or_create_collection(self, name, slug):
        """Return the integer id of the named collection, creating it if needed."""
        resp = self.session.get(self._url("collections/"), headers=self._headers())
        resp.raise_for_status()
        data = resp.json()
        # data may be a paginated envelope or a plain list
        items = data.get("results", data) if isinstance(data, dict) else data
        for item in items:
            if item["name"] == name:
                collection_id = item["id"]
                if not item.get("is_public"):
                    self._patch_collection_public(collection_id)
                return collection_id

        # Not found — create it
        print(f"  Creating collection '{name}'")
        if self.dry_run:
            print(f"  [dry-run] POST /api/collections/ {{'name': '{name}', 'slug': '{slug}', 'is_public': True}}")
            return -1
        resp = self.session.post(
            self._url("collections/"),
            json={"name": name, "slug": slug, "is_public": True},
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()["id"]

    def _patch_collection_public(self, collection_id):
        if self.dry_run:
            print(f"  [dry-run] PATCH /api/collections/{collection_id}/ {{'is_public': True}}")
            return
        resp = self.session.patch(
            self._url(f"collections/{collection_id}/"),
            json={"is_public": True},
            headers=self._headers(),
        )
        resp.raise_for_status()

    # ------------------------------------------------------------------
    # Project
    # ------------------------------------------------------------------

    def get_or_create_project(self, slug, name):
        """Return project dict, creating it if it does not exist."""
        resp = self.session.get(self._url(f"projects/{slug}/"), headers=self._headers())
        if resp.status_code == 404:
            return self._create_project(slug, name)
        resp.raise_for_status()
        project = resp.json()
        if not project.get("is_public"):
            self._patch_project_public(slug)
            project["is_public"] = True
        return project

    def _create_project(self, slug, name):
        if self.dry_run:
            print(f"  [dry-run] POST /api/projects/ {{'slug': '{slug}', 'name': '{name}', 'is_public': True}}")
            return {"id": -1, "slug": slug, "name": name, "is_public": True}
        resp = self.session.post(
            self._url("projects/"),
            json={"slug": slug, "name": name, "is_public": True},
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    def _patch_project_public(self, slug):
        if self.dry_run:
            print(f"  [dry-run] PATCH /api/projects/{slug}/ {{'is_public': True}}")
            return
        resp = self.session.patch(
            self._url(f"projects/{slug}/"),
            json={"is_public": True},
            headers=self._headers(),
        )
        resp.raise_for_status()

    def add_project_to_collection(self, collection_id, project_id):
        if self.dry_run:
            print(f"  [dry-run] POST /api/collections/{collection_id}/add_project/ {{'project_id': {project_id}}}")
            return
        resp = self.session.post(
            self._url(f"collections/{collection_id}/add_project/"),
            json={"project_id": project_id},
            headers=self._headers(),
        )
        if resp.status_code == 400:
            # Already in collection or in another collection — treat as non-fatal
            detail = resp.json()
            print(f"    add_project: {detail}")
            return
        resp.raise_for_status()

    # ------------------------------------------------------------------
    # ChoiceList
    # ------------------------------------------------------------------

    def get_or_create_choice_list(self, project_id, project_slug, level):
        """Return choice list dict for level N within the project."""
        level_slug = f"level_{level}"
        level_name = f"Level {level}"
        resp = self.session.get(
            self._url("choice-lists/"),
            params={"project_slug": project_slug, "slug": level_slug},
            headers=self._headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        items = data.get("results", data) if isinstance(data, dict) else data
        if items:
            return items[0]

        # Not found — create
        if self.dry_run:
            print(f"  [dry-run] POST /api/choice-lists/ project={project_id} slug={level_slug}")
            return {"id": -1, "slug": level_slug, "name": level_name}
        resp = self.session.post(
            self._url("choice-lists/"),
            json={"project": project_id, "slug": level_slug, "name": level_name},
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------
    # CSV import
    # ------------------------------------------------------------------

    def import_choices(self, choice_list_id, entries, csv_dir="/tmp/choices"):
        """
        Replace all choices in the choice list.

        entries: list of (pcode, name) tuples

        Writes a temporary CSV to csv_dir, streams it to the server, then
        deletes it.  This keeps peak memory low for large admin levels.
        """
        if self.dry_run:
            print(f"  [dry-run] POST /api/choice-lists/{choice_list_id}/import/ ({len(entries)} rows)")
            return

        os.makedirs(csv_dir, exist_ok=True)
        tmp_path = os.path.join(csv_dir, f"cl_{choice_list_id}.csv")
        _write_csv(entries, tmp_path)
        try:
            with open(tmp_path, "rb") as fh:
                resp = self.session.post(
                    self._url(f"choice-lists/{choice_list_id}/import/"),
                    files={"file": ("choices.csv", fh, "text/csv")},
                    headers=self._headers(),
                )
            if not resp.ok:
                try:
                    detail = resp.json()
                except Exception:
                    detail = resp.text[:500]
                resp.raise_for_status()  # raises HTTPError with status message
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _deduplicate_labels(entries):
    """
    Return a new entries list where duplicate labels are disambiguated by
    appending the pcode in parentheses, e.g. "Sirba (SD04134)".

    Pcodes are always unique within a level so values are never changed.
    """
    from collections import Counter
    label_counts = Counter(name for _, name in entries)
    result = []
    for pcode, name in entries:
        if label_counts[name] > 1:
            unique_name = f"{name} ({pcode})"
        else:
            unique_name = name
        result.append((pcode, unique_name))
    return result


def _write_csv(entries, path):
    """Write (pcode, name) entries as a name/label CSV file, deduplicating labels."""
    deduped = _deduplicate_labels(entries)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["name", "label"])
        for pcode, name in deduped:
            writer.writerow([pcode, name])


# ---------------------------------------------------------------------------
# Per-country orchestration
# ---------------------------------------------------------------------------

def sync_country(client, collection_id, country_code, country_name, levels, csv_dir="/tmp/choices"):
    slug = country_code.lower()
    project = client.get_or_create_project(slug, country_name)
    project_id = project["id"]

    client.add_project_to_collection(collection_id, project_id)

    for level in sorted(levels.keys()):
        entries = levels[level]
        cl = client.get_or_create_choice_list(project_id, slug, level)
        cl_id = cl["id"]
        print(f"    level_{level}: {len(entries)} choices → choice-list {cl_id}")
        client.import_choices(cl_id, entries, csv_dir=csv_dir)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Sync HDX global pcodes into the choices server"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned API calls without modifying the server",
    )
    parser.add_argument(
        "--country",
        metavar="ISO3",
        help="Sync only this ISO-3 country code (e.g. SDN)",
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Skip the HDX download and reuse an existing local pcodes file",
    )
    args = parser.parse_args()

    config = get_config()
    country_code_map = get_country_code_map()

    if not args.skip_download:
        connect_to_hdx()
        print("Downloading global pcodes from HDX …")
        download_global_pcodes(config["pcodes_file"], config["pcodes_path"])
    else:
        print(f"Skipping download, using existing file: {config['pcodes_path']}")

    print("Parsing pcodes …")
    pcodes = parse_pcodes(config["pcodes_path"])
    print(f"  Found {len(pcodes)} countries")

    if args.country:
        code = args.country.upper()
        if code not in pcodes:
            print(f"ERROR: country code '{code}' not found in pcodes file", file=sys.stderr)
            sys.exit(1)
        pcodes = {code: pcodes[code]}

    choices_config = config.get("choices_config")
    if not choices_config:
        print("ERROR: 'choices_config' block missing from config.json", file=sys.stderr)
        sys.exit(1)

    client = ChoicesClient(choices_config, dry_run=args.dry_run)
    if args.dry_run:
        print("[dry-run mode — no changes will be made to the server]")
    client.login()

    collection_id = client.get_or_create_collection(COLLECTION_NAME, COLLECTION_SLUG)
    print(f"Collection '{COLLECTION_NAME}' id={collection_id}")

    errors = []
    for country_code, levels in pcodes.items():
        country_name = country_code_map.get(country_code, country_code)
        if country_name == country_code:
            print(f"  WARNING: '{country_code}' not in country_code.csv, using code as name")
        print(f"Syncing {country_code} ({country_name}) — {len(levels)} level(s)")
        try:
            sync_country(client, collection_id, country_code, country_name, levels, csv_dir="/tmp/choices")
        except Exception as exc:
            msg = f"  ERROR syncing {country_code}: {exc}"
            print(msg, file=sys.stderr)
            errors.append(msg)

    if errors:
        print(f"\nCompleted with {len(errors)} error(s):")
        for e in errors:
            print(f"  {e}")
    else:
        print("\nDone.")


if __name__ == "__main__":
    main()
