#!/usr/bin/env python3
"""
pull_teams.py — team nickname + city from TBA, for the California watch list.

../longevity/pull_participation.py already walks TBA's paged team list but keeps only
rookie_year/state/country. This pulls the same pages for the fields the table needs — nickname and
city — and writes teams.json (next to this script): team -> {nickname, city, postal}.

County is NOT available from TBA (nor are coordinates — every listed team has null lat/lng), so it
is derived from city in build.py. See ../docs/superpowers/specs/2026-07-14-california-watchlist-design.md.

Responses come from the repo's shared cache/tba/ (keyed by URL SHA1), which pull_participation.py
has already warmed — so this normally makes no network calls at all. See ../README.md.
"""
from __future__ import annotations
import hashlib, json, os, re, sys, time
import urllib.error, urllib.request

TBA_BASE = "https://www.thebluealliance.com/api/v3"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
CACHE_DIR = os.path.join(REPO, "cache", "tba")


def http_json(url, headers, *, retries=5):
    cp = os.path.join(CACHE_DIR, hashlib.sha1(url.encode()).hexdigest() + ".json")
    if os.path.exists(cp):
        with open(cp) as fh:
            return json.load(fh)
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.load(resp)
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(cp, "w") as fh:
                json.dump(data, fh)
            return data
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            last = e
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last = e
        time.sleep(0.5 * (2 ** attempt))
    raise RuntimeError(f"GET failed after {retries} tries: {url} ({last})")


def load_tba_key(path="~/thebluealliance_api_key.txt"):
    raw = open(os.path.expanduser(path)).read()
    toks = re.findall(r"[A-Za-z0-9]{40,}", raw)
    if not toks:
        sys.exit("no TBA key found in " + path)
    return toks[0]


def main():
    key = load_tba_key()
    H = {"X-TBA-Auth-Key": key, "User-Agent": "ca-watchlist-pull/1.0"}
    out, page = {}, 0
    while True:
        batch = http_json(f"{TBA_BASE}/teams/{page}", H) or []
        if not batch:
            break
        for t in batch:
            out[str(t["team_number"])] = {
                "nickname": t.get("nickname"),
                "city": t.get("city"),
                "postal": t.get("postal_code"),
            }
        page += 1
    with open(os.path.join(HERE, "teams.json"), "w") as fh:
        json.dump(out, fh)
    print(f"Wrote teams.json: {len(out)} teams", file=sys.stderr)


if __name__ == "__main__":
    main()
