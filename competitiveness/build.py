#!/usr/bin/env python3
"""
build.py — compute region-relative EPA percentiles, write compact data.json, and inline
D3 + compute.js + data into template.html -> competitiveness.html (single self-contained page).
"""
import json, os, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
START, END = 2002, 2026

ABBR = {'AL':'Alabama','AK':'Alaska','AZ':'Arizona','AR':'Arkansas','CA':'California','CO':'Colorado','CT':'Connecticut','DE':'Delaware','FL':'Florida','GA':'Georgia','HI':'Hawaii','ID':'Idaho','IL':'Illinois','IN':'Indiana','IA':'Iowa','KS':'Kansas','KY':'Kentucky','LA':'Louisiana','ME':'Maine','MD':'Maryland','MA':'Massachusetts','MI':'Michigan','MN':'Minnesota','MS':'Mississippi','MO':'Missouri','MT':'Montana','NE':'Nebraska','NV':'Nevada','NH':'New Hampshire','NJ':'New Jersey','NM':'New Mexico','NY':'New York','NC':'North Carolina','ND':'North Dakota','OH':'Ohio','OK':'Oklahoma','OR':'Oregon','PA':'Pennsylvania','RI':'Rhode Island','SC':'South Carolina','SD':'South Dakota','TN':'Tennessee','TX':'Texas','UT':'Utah','VT':'Vermont','VA':'Virginia','WA':'Washington','WV':'West Virginia','WI':'Wisconsin','WY':'Wyoming','DC':'District of Columbia'}
REGION_ORDER = ["Michigan","California","Texas","Northeast","Mid-Atlantic","Southeast","Midwest","West","Canada","International"]
REGION_STATES = {
  "Northeast":   ["New York","New Jersey","Massachusetts","Connecticut","New Hampshire","Maine","Vermont","Rhode Island"],
  "Mid-Atlantic":["Pennsylvania","Maryland","Delaware","District of Columbia","West Virginia","Virginia","North Carolina"],
  "Southeast":   ["Florida","Georgia","South Carolina","Tennessee","Alabama","Mississippi","Kentucky","Arkansas","Louisiana"],
  "Midwest":     ["Minnesota","Wisconsin","Iowa","Missouri","Kansas","Nebraska","North Dakota","South Dakota","Ohio","Indiana","Illinois","Oklahoma"],
  "West":        ["Washington","Oregon","Arizona","Colorado","Nevada","Utah","New Mexico","Idaho","Montana","Wyoming","Hawaii","Alaska"],
}
S2R = {"Michigan":"Michigan","California":"California","Texas":"Texas"}
for r, ss in REGION_STATES.items():
    for s in ss: S2R[s] = r
def ns(s): return ABBR.get(s, s) if s else s
def nc(c): return 'USA' if c == 'United States' else ('Türkiye' if c == 'Turkey' else c)
def region_of(country, state):
    c = nc(country)
    if c == "Canada": return "Canada"
    if c != "USA": return "International"
    return S2R.get(ns(state), "West")   # unmapped US (PR/Guam) -> West

def read(p):
    with open(os.path.join(HERE, p)) as fh: return fh.read()

def main():
    epa = json.load(open(os.path.join(HERE, "epa.json")))
    part = json.load(open(os.path.join(REPO, "longevity", "team_participation.json")))
    ridx = {name: i for i, name in enumerate(REGION_ORDER)}

    # region per team (from participation location)
    team_region = {}
    for tn, t in part["teams"].items():
        team_region[tn] = region_of(t.get("country"), t.get("state"))

    # region-relative EPA percentile per (region, year): rank by EPA among region-year teams
    byRY = defaultdict(list)
    for tn, ty in epa.items():
        if tn not in team_region: continue
        reg = team_region[tn]
        for ystr, d in ty.items():
            if d.get("epa") is None: continue
            byRY[(reg, int(ystr))].append((tn, d["epa"]))
    pct = {}  # (tn, year) -> percentile 0..1
    for (reg, y), lst in byRY.items():
        if len(lst) < 15: continue
        lst.sort(key=lambda x: x[1]); n = len(lst)
        for i, (tn, e) in enumerate(lst):
            pct[(tn, y)] = i / (n - 1)

    # compact records: active years from participation, percentile where available
    teams = {}
    for tn, t in part["teams"].items():
        years = t["years"]
        if not years: continue
        reg = team_region[tn]
        ys = []
        for y in years:
            p = pct.get((tn, y))
            ys.append([y - START, (round(p * 1000) if p is not None else None)])
        teams[tn] = {"r": t["rookie_year"], "g": ridx[reg], "ys": ys}

    data = {"start": START, "end": END, "pull_date": part.get("pull_date"),
            "regions": REGION_ORDER, "teams": teams}
    with open(os.path.join(HERE, "data.json"), "w") as fh:
        json.dump(data, fh)
    print(f"Wrote data.json: {len(teams)} teams", file=sys.stderr)

    # inline into template -> competitiveness.html
    tpl = os.path.join(HERE, "template.html")
    if not os.path.exists(tpl):
        print("template.html not present yet; wrote data.json only", file=sys.stderr); return
    template = read("template.html")
    d3 = open(os.path.join(REPO, "longevity", "vendor", "d3.v7.min.js")).read()
    compute = read("compute.js").replace("export function", "function").replace("export const", "const")
    html = (template
            .replace("<!-- D3 -->", f"<script>{d3}</script>")
            .replace("<!-- COMPUTE -->", f"<script>{compute}</script>")
            .replace("<!-- DATA -->", f"<script>window.DATA={json.dumps(data)};</script>"))
    for m in ("<!-- D3 -->", "<!-- COMPUTE -->", "<!-- DATA -->"):
        if m in html: sys.exit(f"marker not replaced: {m}")
    out = os.path.join(HERE, "competitiveness.html")
    with open(out, "w") as fh: fh.write(html)
    print(f"Wrote {out} ({os.path.getsize(out)//1024} KB)", file=sys.stderr)

if __name__ == "__main__":
    main()
