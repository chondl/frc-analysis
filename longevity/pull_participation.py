#!/usr/bin/env python3
"""
pull_participation.py — data pull for the FRC Team Health & Longevity analysis.

For every FRC team, determine the set of years (2002..END_YEAR) in which it played
at least one OFFICIAL event (regional / district / district-cmp / cmp-division /
einstein). Also record TBA's authoritative rookie_year and location.

Writes team_participation.json (next to this script) for the JS tool to consume.

Every TBA HTTP response is cached under the repo's shared cache/tba/ directory
(keyed by URL SHA1), so re-runs — and other analyses in this repo — never re-pull.
Reuses the retry+cache HTTP pattern from build_offseason_table.py.
"""
from __future__ import annotations
import concurrent.futures as cf
import datetime
import hashlib, json, os, re, sys, time
import urllib.error, urllib.request

TBA_BASE = "https://www.thebluealliance.com/api/v3"
START_YEAR = 2002
END_YEAR = 2026  # last completed season
OFFICIAL_TYPES = {0, 1, 2, 3, 4, 5}  # exclude offseason=99, preseason=100

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
# Durable, shared TBA response cache (see longevity/README.md).
CACHE_DIR = os.path.join(REPO, "cache", "tba")


def _cache_path(url):
    return os.path.join(CACHE_DIR, hashlib.sha1(url.encode()).hexdigest() + ".json")


def http_json(url, headers, *, retries=5):
    cp = _cache_path(url)
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
                os.makedirs(CACHE_DIR, exist_ok=True)
                with open(cp, "w") as fh:
                    json.dump(None, fh)
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
    H = {"X-TBA-Auth-Key": key, "User-Agent": "longevity-pull/1.0"}
    def tba(path):
        return http_json(TBA_BASE + path, H)

    # 1) All teams -> rookie_year + location (paged full team objects).
    print("Fetching full team list...", file=sys.stderr)
    teams = {}
    page = 0
    while True:
        batch = tba(f"/teams/{page}") or []
        if not batch:
            break
        for t in batch:
            teams[t["team_number"]] = {
                "rookie_year": t.get("rookie_year"),
                "state": t.get("state_prov"),
                "country": t.get("country"),
            }
        page += 1
    print(f"  {len(teams)} teams total on TBA", file=sys.stderr)

    # 2) Official participation per year via events -> team keys.
    part = {}  # team_number -> set of years
    for year in range(START_YEAR, END_YEAR + 1):
        events = tba(f"/events/{year}") or []
        keys = [e["key"] for e in events if e.get("event_type") in OFFICIAL_TYPES]
        lists = {}
        with cf.ThreadPoolExecutor(max_workers=10) as ex:
            futs = {ex.submit(tba, f"/event/{k}/teams/keys"): k for k in keys}
            for done in cf.as_completed(futs):
                lists[futs[done]] = done.result() or []
        yr_teams = set()
        for lst in lists.values():
            for tk in lst:
                m = re.match(r"frc(\d+)", tk)
                if m:
                    yr_teams.add(int(m.group(1)))
        for tn in yr_teams:
            part.setdefault(tn, set()).add(year)
        print(f"  {year}: {len(keys)} official events, {len(yr_teams)} teams", file=sys.stderr)

    # 3) Assemble output: only in-window teams that played >=1 official event.
    out = {
        "start_year": START_YEAR,
        "end_year": END_YEAR,
        "pull_date": datetime.date.today().isoformat(),
        "teams": {},
    }
    for tn, meta in teams.items():
        years = sorted(part.get(tn, set()))
        if not years:
            continue
        out["teams"][str(tn)] = {
            "rookie_year": meta["rookie_year"],
            "state": meta["state"],
            "country": meta["country"],
            "years": years,
        }
    with open(os.path.join(HERE, "team_participation.json"), "w") as fh:
        json.dump(out, fh)
    print(f"Wrote team_participation.json: {len(out['teams'])} in-window teams "
          f"(pull_date {out['pull_date']})", file=sys.stderr)


if __name__ == "__main__":
    main()
