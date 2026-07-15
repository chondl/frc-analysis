#!/usr/bin/env python3
"""
build.py — select California teams with a bottom-decile CA EPA season in 2023-2026, write compact
data.json, and inline compute.js + palette + data into template.html -> california.html.

Percentiles are the same region-relative percentiles the competitiveness page uses for the
California region: rank by EPA among all CA teams that played that season. Always statewide — the
page's NorCal/SoCal filter hides rows, it never recomputes numbers.

See ../docs/superpowers/specs/2026-07-14-california-watchlist-design.md.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
YEARS = [2023, 2024, 2025, 2026]

# FIRST California District Details (Rev. Feb 5, 2025): "The northern border of San Luis Obispo,
# Kern, and San Bernardino counties is the dividing line between Northern California and Southern
# California. Teams from those three counties, plus Santa Barbara, Ventura, Los Angeles, Orange,
# Riverside, San Diego, and Imperial counties are considered Southern California teams. Teams in
# the state's other 48 counties are considered Northern California teams."
SOCAL = {"San Luis Obispo", "Kern", "San Bernardino", "Santa Barbara", "Ventura",
         "Los Angeles", "Orange", "Riverside", "San Diego", "Imperial"}

# TBA has no county field and null coordinates for every team here, so county comes from city.
# This map decides the NorCal/SoCal column, so an unmapped city is a hard error below, never a
# default. Add entries here when a new city appears.
CITY_COUNTY = {
    "Alhambra": "Los Angeles", "Arcadia": "Los Angeles", "Atwater": "Merced",
    "Calipatria": "Imperial", "Camarillo": "Ventura", "Castaic": "Los Angeles",
    "Castro Valley": "Alameda", "Concord": "Contra Costa", "Coronado": "San Diego",
    "Danville": "Contra Costa", "El Centro": "Imperial", "El Segundo": "Los Angeles",
    "Escondido": "San Diego", "Fillmore": "Ventura", "Fremont": "Alameda",
    "Fresno": "Fresno", "Fullerton": "Orange", "Glendale": "Los Angeles",
    "Glendora": "Los Angeles", "Imperial Beach": "San Diego", "Irvine": "Orange",
    "La Mesa": "San Diego", "Lafayette": "Contra Costa", "Livingston": "Merced",
    "Long Beach": "Los Angeles", "Los Altos Hills": "Santa Clara",
    "Los Angeles": "Los Angeles", "Monterey": "Monterey", "Mountain View": "Santa Clara",
    "National City": "San Diego", "Newark": "Alameda", "North Hollywood": "Los Angeles",
    "Oceanside": "San Diego", "Orinda": "Contra Costa", "Oroville": "Butte",
    "Oxnard": "Ventura", "Palmdale": "Los Angeles", "Pasadena": "Los Angeles",
    "Pittsburg": "Contra Costa", "Port Hueneme": "Ventura",
    "Rancho Santa Margarita": "Orange", "Rosamond": "Kern", "Rosemead": "Los Angeles",
    "Salinas": "Monterey", "San Diego": "San Diego", "San Francisco": "San Francisco",
    "San Jose": "Santa Clara", "San Lorenzo": "Alameda", "San Marcos": "San Diego",
    "Santa Rosa": "Sonoma", "Seaside": "Monterey", "Studio City": "Los Angeles",
    "Sunnyvale": "Santa Clara", "Valencia": "Los Angeles", "Ventura": "Ventura",
    "Visalia": "Tulare", "Walnut": "Los Angeles", "Walnut Creek": "Contra Costa",
}


def read(p):
    with open(os.path.join(HERE, p)) as fh:
        return fh.read()


def ca_percentiles(epa, ca_teams):
    """(team, year) -> percentile, ranked by EPA among CA teams that played that season."""
    pct = {}
    for y in YEARS:
        lst = [(tn, epa[tn][str(y)]["epa"]) for tn in ca_teams
               if tn in epa and str(y) in epa[tn] and epa[tn][str(y)].get("epa") is not None]
        lst.sort(key=lambda x: x[1])
        n = len(lst)
        if n < 15:
            sys.exit(f"CA {y}: only {n} teams with EPA; too few to rank")
        for i, (tn, _) in enumerate(lst):
            pct[(tn, y)] = i / (n - 1)
        print(f"  {y}: {n} CA teams ranked", file=sys.stderr)
    return pct


def css_for(palette):
    out = []
    for name, c in palette["cells"].items():
        r, g, b = (int(c["tint"].lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
        out.append(f'  td.c-{name} {{ color:{c["fg"]}; '
                   f'background:rgba({r},{g},{b},{c["alpha"]}); }}')
    return "\n".join(out)


def main():
    epa = json.load(open(os.path.join(REPO, "competitiveness", "epa.json")))
    part = json.load(open(os.path.join(REPO, "longevity", "team_participation.json")))
    meta = json.load(open(os.path.join(HERE, "teams.json")))
    palette = json.load(open(os.path.join(HERE, "palette.json")))

    ca = {tn for tn, t in part["teams"].items()
          if t.get("country") == "USA" and t.get("state") in ("CA", "California")}
    pct = ca_percentiles(epa, ca)

    picked = sorted({tn for (tn, _), p in pct.items() if p < 0.10}, key=int)
    teams = {}
    for tn in picked:
        t = part["teams"][tn]
        m = meta.get(tn)
        if not m or not m.get("city"):
            sys.exit(f"team {tn}: no TBA city; re-run pull_teams.py")
        county = CITY_COUNTY.get(m["city"])
        if county is None:
            sys.exit(f"team {tn}: city {m['city']!r} not in CITY_COUNTY — add it "
                     f"(it decides the NorCal/SoCal column, so there is no safe default)")
        played = set(t["years"])
        ys = {}
        for y in YEARS:
            if y in played:
                # Every CA window season a team played has an EPA; if that ever stops holding,
                # cellState() would silently misread the year as a gap or as churn.
                if (tn, y) not in pct:
                    sys.exit(f"team {tn}: played {y} but has no EPA percentile")
                # floor, not round: floor(p*1000) < 100 exactly when p < 0.10, so the compact
                # encoding preserves bucket membership at the .10 and .50 boundaries. round()
                # snaps a qualifying .0995 up to 100 and the page then shows the team with no
                # bottom-decile year at all — the reason it is on the list, erased.
                ys[str(y)] = int(pct[(tn, y)] * 1000)
        # Every team is here because of a bottom-decile season, so the encoded data must still
        # show one. Guards the compact encoding against silently dropping the qualifying year.
        if not any(v < 100 for v in ys.values()):
            sys.exit(f"team {tn}: selected for a bottom-decile season, but no encoded year is "
                     f"below the 10th percentile ({ys}) — the encoding lost it")
        teams[tn] = {"n": m["nickname"] or f"Team {tn}", "c": county, "y": m["city"],
                     "h": 1 if county in SOCAL else 0,
                     "first": min(played), "last": max(played), "ys": ys}

    data = {"years": YEARS, "pull_date": part.get("pull_date"), "teams": teams}
    with open(os.path.join(HERE, "data.json"), "w") as fh:
        json.dump(data, fh)
    soc = sum(1 for t in teams.values() if t["h"] == 1)
    a26 = sum(1 for t in teams.values() if "2026" in t["ys"])
    print(f"Wrote data.json: {len(teams)} teams ({soc} SoCal / {len(teams) - soc} NorCal), "
          f"{a26} played 2026, {len({t['c'] for t in teams.values()})} counties", file=sys.stderr)

    template = read("template.html")
    compute = read("compute.js").replace("export function", "function").replace("export const", "const")
    html = (template
            .replace("/* PALETTE */", css_for(palette))
            .replace("<!-- COMPUTE -->", f"<script>{compute}</script>")
            .replace("<!-- DATA -->", f"<script>window.DATA={json.dumps(data)};</script>"))
    for m in ("/* PALETTE */", "<!-- COMPUTE -->", "<!-- DATA -->"):
        if m in html:
            sys.exit(f"marker not replaced: {m}")
    out = os.path.join(HERE, "california.html")
    with open(out, "w") as fh:
        fh.write(html)
    print(f"Wrote {out} ({os.path.getsize(out) // 1024} KB)", file=sys.stderr)


if __name__ == "__main__":
    main()
