// compute.js — pure derivation of every longevity series from compact team records.
// Ported 1:1 from the validated Python first-cut analysis. No DOM, no D3: unit-testable
// with node and inlined verbatim into the single-file tool by build.py.
//
// A "record" is {r, f, l, mask}:
//   r    = TBA rookie_year (true first season, may predate the window)
//   f    = first active year within the window
//   l    = last active year within the window
//   mask = 25-bit active bitmask; bit i set  <=>  team active in year (start + i)
//
// Definitions (locked): active = played >=1 official event; lifespan = f..l (gaps count
// alive); confirmed-dead = l <= end-2; cohort = rookie_year in [start,end]; provisional
// years = end-1, end (deaths unconfirmable).

export const AGE_BANDS = [
  ["age1",  (a) => a === 0],
  ["age2_3",(a) => a >= 1 && a <= 2],
  ["age4_6",(a) => a >= 3 && a <= 5],
  ["age7_10",(a) => a >= 6 && a <= 9],
  ["age11_15",(a) => a >= 10 && a <= 14],
  ["16+",   (a) => a >= 15],
];
const bandOf = (age) => { for (const [n, p] of AGE_BANDS) if (p(age)) return n; return "16+"; };

// Active in calendar year y, from the bitmask.
const activeIn = (rec, y, start) => ((rec.mask >>> (y - start)) & 1) === 1;

export function buildRecords(participation) {
  const start = participation.start_year, end = participation.end_year;
  const records = [];
  for (const t of Object.values(participation.teams)) {
    const years = t.years;
    if (!years || !years.length) continue;
    let mask = 0;
    for (const y of years) mask |= (1 << (y - start));
    const f = years[0], l = years[years.length - 1];
    const r = (t.rookie_year != null) ? t.rookie_year : f;
    records.push({ r, f, l, mask, state: t.state, country: t.country });
  }
  return { records, meta: { start, end, pullDate: participation.pull_date } };
}

export function activeByYear(records, start, end) {
  const out = {};
  for (let y = start; y <= end; y++) out[y] = 0;
  for (const rec of records)
    for (let y = start; y <= end; y++) if (activeIn(rec, y, start)) out[y]++;
  return out;
}

export function flows(records, start, end) {
  const out = {};
  const active = activeByYear(records, start, end);
  for (let y = start; y <= end; y++)
    out[y] = { rookies: 0, returns: 0, departures: 0, deaths: 0, net: 0 };
  for (const rec of records) {
    if (rec.r === rec.f && rec.r >= start && rec.r <= end) out[rec.r].rookies++;
    if (rec.l <= end - 2) out[rec.l].deaths++;               // confirmed death year
    for (let y = start + 1; y <= end; y++) {
      const iy = activeIn(rec, y, start), ip = activeIn(rec, y - 1, start);
      if (ip && !iy) out[y].departures++;
      if (iy && !ip && y !== rec.f) out[y].returns++;
    }
  }
  let prev = null;
  for (let y = start; y <= end; y++) {
    out[y].net = prev === null ? 0 : active[y] - prev;
    if (y > end - 2) out[y].deaths = null;                   // provisional: unconfirmable
    prev = active[y];
  }
  return out;
}

export function cohortSurvival(records, start, end) {
  const cohorts = {};
  for (const rec of records) {
    if (rec.r === rec.f && rec.r >= start && rec.r <= end)
      (cohorts[rec.r] ??= []).push(rec);
  }
  const out = {};
  for (const c of Object.keys(cohorts).map(Number)) {
    const members = cohorts[c];
    const surv = {};
    for (let age = 0; age <= end - start; age++) {
      if (c + age > end) { surv[age] = null; continue; }
      surv[age] = members.filter((m) => m.l >= c + age).length / members.length;
    }
    out[c] = { N: members.length, surv };
  }
  return out;
}

export function departureByAgeYear(records, start, end) {
  const out = {};
  for (let y = start + 1; y <= end; y++) {
    const acc = {};
    for (const [n] of AGE_BANDS) acc[n] = { dep: 0, base: 0, rate: 0 };
    for (const rec of records) {
      if (!activeIn(rec, y - 1, start)) continue;
      const b = bandOf((y - 1) - rec.r);
      acc[b].base++;
      if (!activeIn(rec, y, start)) acc[b].dep++;
    }
    for (const [n] of AGE_BANDS) acc[n].rate = acc[n].base ? acc[n].dep / acc[n].base : 0;
    out[y] = acc;
  }
  return out;
}

// Departure rate per year, split by an arbitrary grouping of teams (groupOf(rec) -> key,
// or null to exclude). Used for the "departure rate by team generation" view: each cohort
// tranche's share leaving each year. base = teams in the group active in y-1; dep = of those,
// how many were absent in y.
export function departureByGroupYear(records, start, end, groupOf) {
  const out = {};
  for (let y = start + 1; y <= end; y++) {
    const acc = {};
    for (const rec of records) {
      if (!activeIn(rec, y - 1, start)) continue;
      const key = groupOf(rec);
      if (key == null) continue;
      (acc[key] ??= { dep: 0, base: 0, rate: 0 });
      acc[key].base++;
      if (!activeIn(rec, y, start)) acc[key].dep++;
    }
    for (const k in acc) acc[k].rate = acc[k].base ? acc[k].dep / acc[k].base : 0;
    out[y] = acc;
  }
  return out;
}

// Departure rate per year, split by team AGE band (bands = [{key, lo, hi}] on age =
// year - rookie_year; hi may be Infinity). Age changes with the year, so a team moves
// between bands over time. This is the "departure rate by team age over time" view.
export function departureByAgeBandsYear(records, start, end, bands) {
  const bandOfAge = age => { for (const b of bands) if (age >= b.lo && age <= b.hi) return b.key; return null; };
  const out = {};
  for (let y = start + 1; y <= end; y++) {
    const acc = {};
    for (const b of bands) acc[b.key] = { dep: 0, base: 0, rate: 0 };
    for (const rec of records) {
      if (!activeIn(rec, y - 1, start)) continue;
      const k = bandOfAge((y - 1) - rec.r);
      if (k == null) continue;
      acc[k].base++;
      if (!activeIn(rec, y, start)) acc[k].dep++;
    }
    for (const b of bands) acc[b.key].rate = acc[b.key].base ? acc[b.key].dep / acc[b.key].base : 0;
    out[y] = acc;
  }
  return out;
}

// Direct age-standardization: apply a fixed standard population (the age composition of
// standardYears) to each year's band-specific departure rates.
export function standardizedRate(records, start, end, standardYears) {
  const comp = ageComposition(records, start, end);
  const W = {};
  for (const [n] of AGE_BANDS) {
    W[n] = standardYears.reduce((s, y) => s + comp[y][n], 0) / standardYears.length;
  }
  const dep = departureByAgeYear(records, start, end);
  const young = ["age1", "age2_3"], vet = ["age11_15", "16+"];
  const Wy = young.reduce((s, n) => s + W[n], 0), Wv = vet.reduce((s, n) => s + W[n], 0);
  const out = {};
  for (let y = start + 1; y <= end; y++) {
    const rb = dep[y];
    let crudeDep = 0, crudeBase = 0, std = 0, ys = 0, vs = 0;
    for (const [n] of AGE_BANDS) {
      crudeDep += rb[n].dep; crudeBase += rb[n].base;
      std += rb[n].rate * W[n];
    }
    for (const n of young) ys += rb[n].rate * W[n];
    for (const n of vet) vs += rb[n].rate * W[n];
    out[y] = {
      crude: crudeBase ? crudeDep / crudeBase : 0,
      std,
      youngStd: Wy ? ys / Wy : 0,
      vetStd: Wv ? vs / Wv : 0,
    };
  }
  return out;
}

export function ageComposition(records, start, end) {
  const out = { medianAge: {} };
  for (let y = start; y <= end; y++) {
    const counts = {}; for (const [n] of AGE_BANDS) counts[n] = 0;
    const ages = [];
    let total = 0;
    for (const rec of records) {
      if (!activeIn(rec, y, start)) continue;
      const age = y - rec.r;
      counts[bandOf(age)]++;
      ages.push(age);
      total++;
    }
    const frac = {};
    for (const [n] of AGE_BANDS) frac[n] = total ? counts[n] / total : 0;
    out[y] = frac;
    ages.sort((a, b) => a - b);
    out.medianAge[y] = ages.length ? ages[Math.floor(ages.length / 2)] : 0;
  }
  return out;
}

export function lifespanHistogram(records, end) {
  const out = {};
  for (const rec of records) {
    if (rec.l <= end - 2 && rec.r === rec.f) {   // confirmed-dead, in-window rookie
      const len = rec.l - rec.r + 1;
      out[len] = (out[len] || 0) + 1;
    }
  }
  return out;
}
