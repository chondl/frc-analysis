// compute.js — pure derivation of competitiveness-vs-survival series from compact records.
// Ported 1:1 from the validated Python analysis. Unit-tested with node, inlined into the page
// by build.py. No DOM, no D3.
//
// A record: {r, first, last, g, active:Set<year>, pct:{year->0..1}}
//   r=rookie_year, first/last = first/last active year in window, g=region index,
//   active = set of years the team played an official event (survival), pct = region-relative
//   EPA percentile for years that have one (region-year needs >=15 teams; else absent).
//
// Buckets: Bottom 10% (<0.10) / Below median (0.10-0.50) / Above median (>=0.50).

export const BUCKETS = ["Bottom 10%", "Below median", "Above median"];
export const bucketOf = p => p < 0.10 ? 0 : (p < 0.50 ? 1 : 2);
export const decileOf = p => Math.min(9, Math.floor(p * 10));

export function buildRecords(data) {
  const start = data.start, end = data.end;
  const records = [];
  for (const [tn, t] of Object.entries(data.teams)) {
    const active = new Set(), pct = {};
    for (const [off, pMil] of t.ys) {
      const y = start + off;
      active.add(y);
      if (pMil != null) pct[y] = pMil / 1000;
    }
    if (!active.size) continue;
    const ys = [...active].sort((a, b) => a - b);
    records.push({ r: t.r ?? ys[0], first: ys[0], last: ys[ys.length - 1], g: t.g, active, pct });
  }
  return { records, meta: { start, end, regions: data.regions, pullDate: data.pull_date } };
}

const isRookieInWindow = (rec, start, cap) =>
  rec.r === rec.first && rec.r >= start && rec.r <= cap;
const meanPct = (rec, ages) => {
  const v = [];
  for (const a of ages) { const p = rec.pct[rec.r + a]; if (p != null) v.push(p); }
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

// (1) Decile gradient: early (first-4-season mean) standing decile -> reach year 5 / 10.
export function gradient(records, start, end) {
  const out = {};
  for (let d = 0; d < 10; d++) out[d] = { s5: 0, n5: 0, s10: 0, n10: 0 };
  for (const rec of records) {
    if (!isRookieInWindow(rec, start, 2019)) continue;
    const e = meanPct(rec, [0, 1, 2, 3]);   // first four seasons (formative window)
    if (e == null) continue;
    const d = decileOf(e);
    if (rec.r <= 2019 && rec.r + 5 <= end) { out[d].n5++; if (rec.last >= rec.r + 5) out[d].s5++; }
    if (rec.r <= 2014 && rec.r + 10 <= end) { out[d].n10++; if (rec.last >= rec.r + 10) out[d].s10++; }
  }
  return out;
}

// reach year N by early bucket (for headline callouts / tests)
export function reachByEarlyBucket(records, start, end, horizon, cohortMax) {
  const out = [ {s:0,n:0}, {s:0,n:0}, {s:0,n:0} ];
  for (const rec of records) {
    if (!isRookieInWindow(rec, start, cohortMax)) continue;
    const e = meanPct(rec, [0, 1, 2, 3]);   // first four seasons (formative window)
    if (e == null || rec.r + horizon > end) continue;
    const b = bucketOf(e);
    out[b].n++; if (rec.last >= rec.r + horizon) out[b].s++;
  }
  return out;
}

// (2) Survival curves by early standing bucket. age 0..maxAge, % still active.
export function earlyCurves(records, start, end, maxAge) {
  const out = [0, 1, 2].map(() => ({}));
  const N = [0, 0, 0];
  for (const rec of records) {
    if (!isRookieInWindow(rec, start, end)) continue;
    const e = meanPct(rec, [0, 1, 2, 3]);   // first four seasons (formative window)
    if (e == null) continue;
    const b = bucketOf(e); N[b]++;
    for (let k = 0; k <= maxAge; k++) {
      if (rec.r + k > end) continue;
      const c = (out[b][k] ??= { s: 0, n: 0 });
      c.n++; if (rec.last >= rec.r + k) c.s++;
    }
  }
  return { curves: out, N };
}

// (3) Age-controlled: P(survive +3) by bucket within age bands.
const AGE_BANDS = [["new (0-2)", 0, 2], ["age 3-5", 3, 5], ["age 6-10", 6, 10], ["age 11+", 11, 99]];
export function ageControlled(records, start, end) {
  const out = {};
  for (const [name] of AGE_BANDS) out[name] = [ {s:0,n:0}, {s:0,n:0}, {s:0,n:0} ];
  for (const rec of records) {
    for (const y of rec.active) {
      if (y === 2020 || y === 2021 || y + 3 > end) continue;
      const p = rec.pct[y]; if (p == null) continue;
      const age = y - rec.r;
      const band = AGE_BANDS.find(b => age >= b[1] && age <= b[2]);
      if (!band) continue;
      const cell = out[band[0]][bucketOf(p)];
      cell.n++; if (rec.last >= y + 3) cell.s++;
    }
  }
  return out;
}
export const AGE_BAND_NAMES = AGE_BANDS.map(b => b[0]);

// (4) Recovery: teams that started Bottom 10% in year 1, survival curves split by their
// years-2-4 standing, plus an "started Above median" benchmark. age 0..maxAge.
export function recovery(records, start, end, maxAge) {
  const grp = { stayed: {}, midClimb: {}, topClimb: {}, benchmark: {} };
  const N = { stayed: 0, midClimb: 0, topClimb: 0, benchmark: 0 };
  const add = (key, rec) => {
    N[key]++;
    for (let k = 0; k <= maxAge; k++) {
      if (rec.r + k > end) continue;
      const c = (grp[key][k] ??= { s: 0, n: 0 });
      c.n++; if (rec.last >= rec.r + k) c.s++;
    }
  };
  for (const rec of records) {
    if (!isRookieInWindow(rec, start, 2016)) continue;
    const p1 = rec.pct[rec.r];
    if (p1 != null && p1 >= 0.50) add("benchmark", rec);
    if (p1 == null || p1 >= 0.10) continue;              // must have bombed year 1
    const later = meanPct(rec, [1, 2, 3]);
    if (later == null) continue;
    const b = bucketOf(later);
    add(b === 0 ? "stayed" : b === 1 ? "midClimb" : "topClimb", rec);
  }
  return { grp, N };
}

// (5) Veterans (age>=4): survival by bottom-decile streak length, plus climb-out recovery.
const isBot = (rec, y) => { const p = rec.pct[y]; return p != null && p < 0.10; };
function streak(rec, Y) { let k = 0, y = Y; while (isBot(rec, y)) { k++; y--; } return k; }
export function veteranStreak(records, start, end) {
  const g3 = [0, 1, 2, 3].map(() => ({ s: 0, n: 0 }));   // survive +3
  const g1 = [0, 1, 2, 3].map(() => ({ s: 0, n: 0 }));   // survive +1
  for (const rec of records) {
    for (const y of rec.active) {
      if (y === 2020 || y === 2021) continue;
      if (y - rec.r < 4) continue;
      if (rec.pct[y] == null) continue;
      const key = Math.min(3, streak(rec, y));
      if (y + 3 <= end) { g3[key].n++; if (rec.last >= y + 3) g3[key].s++; }
      if (y + 1 <= end) { g1[key].n++; if (rec.last >= y + 1) g1[key].s++; }
    }
  }
  return { g3, g1 };
}
export function veteranClimbOut(records, start, end) {
  const climbed = { s: 0, n: 0 }, stayed = { s: 0, n: 0 };
  for (const rec of records) {
    for (const y of rec.active) {
      if (y === 2020 || y === 2021 || y - rec.r < 4) continue;
      if (streak(rec, y) !== 1) continue;                // exactly a fresh one-year drop
      const ny = y + 1;
      if (rec.pct[ny] == null || ny + 2 > end) continue; // need next-year standing + horizon
      const surv = rec.last >= ny + 2 ? 1 : 0;
      if (rec.pct[ny] >= 0.10) { climbed.n++; climbed.s += surv; }
      else { stayed.n++; stayed.s += surv; }
    }
  }
  return { climbed, stayed };
}
