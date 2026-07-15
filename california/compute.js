// compute.js — pure derivation for the California bottom-decile watch list.
// Unit-tested with node (compute.test.mjs), inlined into the page by build.py. No DOM.
//
// A record from data.json: {n, c, y, h, ys:{year->pct|null}, first, last}
//   n=nickname, c=county, y=city, h=half (0=NorCal, 1=SoCal), first/last = first/last season
//   played (any year, not just the window), ys = statewide-CA EPA percentile per window year the
//   team played. Percentiles are always statewide — filters hide rows, never recompute numbers.
//
// Buckets match the competitiveness page exactly: Bottom 10% / Below median / Above median.

export const YEARS = [2023, 2024, 2025, 2026];
export const bucketOf = p => (p < 0.10 ? 0 : p < 0.50 ? 1 : 2);

// Cell state for a team-year. Absence splits three ways, and the split is the point:
// "gone" is the churn this page is about, "notyet" is a team that didn't exist, "gap" is a team
// that sat out and came back.
export function cellState(rec, year) {
  const p = rec.ys[year];
  if (p != null) return { kind: "pct", p, bucket: bucketOf(p) };
  if (year < rec.first) return { kind: "notyet" };
  if (year > rec.last) return { kind: "gone" };
  return { kind: "gap" };
}

// Mean of the team's percentiles over the years it actually played — the same derivation as
// meanPct() on the competitiveness page, so the number agrees with the parent.
export function overallPct(rec) {
  const v = YEARS.map(y => rec.ys[y]).filter(p => p != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

export const playedIn = (rec, year) => rec.ys[year] != null;
export const bottomYears = rec => YEARS.filter(y => rec.ys[y] != null && rec.ys[y] < 0.10).length;

export function buildRows(data) {
  return Object.entries(data.teams).map(([tn, t]) => {
    // data.json stores percentiles as integer per-mille (as the competitiveness page does);
    // everything downstream works in 0..1 fractions.
    const ys = {};
    for (const [k, v] of Object.entries(t.ys)) ys[+k] = v / 1000;
    const rec = { team: +tn, n: t.n, c: t.c, y: t.y, h: t.h, ys, first: t.first, last: t.last };
    rec.overall = overallPct(rec);
    rec.active26 = playedIn(rec, 2026);
    rec.nBottom = bottomYears(rec);
    return rec;
  });
}

// half: "all" | "nor" | "soc"; only2026: boolean. Hides rows only.
export function filterRows(rows, { half = "all", only2026 = false } = {}) {
  return rows.filter(r => {
    if (half === "nor" && r.h !== 0) return false;
    if (half === "soc" && r.h !== 1) return false;
    if (only2026 && !r.active26) return false;
    return true;
  });
}

// Sort by any column. Nulls (a year not played, or no overall) always sort last regardless of
// direction — an absent value is not a low value, and letting it rank as one would put churned
// teams at the "worst" end of an ascending percentile sort.
export function sortRows(rows, key, dir = 1) {
  const val = r =>
    key === "team" ? r.team
    : key === "name" ? (r.n || "")
    : key === "county" ? r.c
    : key === "city" ? r.y
    : key === "half" ? (r.h === 0 ? "Northern California" : "Southern California")
    : key === "overall" ? r.overall
    : r.ys[+key];
  const out = [...rows];
  out.sort((a, b) => {
    const x = val(a), y = val(b);
    const xn = x == null, yn = y == null;
    if (xn || yn) return xn && yn ? a.team - b.team : xn ? 1 : -1;
    const c = typeof x === "string" ? x.localeCompare(y) : x - y;
    return c !== 0 ? c * dir : a.team - b.team;
  });
  return out;
}
