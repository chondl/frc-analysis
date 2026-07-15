// compute.test.mjs — run: node california/compute.test.mjs
// Golden values are from the design spec, cross-checked against the real data.json.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  YEARS, bucketOf, cellState, overallPct, buildRows, filterRows, sortRows,
} from "./compute.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(HERE, "data.json"), "utf8"));
const palette = JSON.parse(readFileSync(join(HERE, "palette.json"), "utf8"));
const rows = buildRows(data);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

// --- buckets: identical thresholds to the competitiveness page -------------------------------
t("bucketOf splits at .10 and .50", () => {
  assert.equal(bucketOf(0.0), 0);
  assert.equal(bucketOf(0.099), 0);
  assert.equal(bucketOf(0.10), 1);
  assert.equal(bucketOf(0.499), 1);
  assert.equal(bucketOf(0.50), 2);
  assert.equal(bucketOf(1.0), 2);
});

// --- cell states ------------------------------------------------------------------------------
t("cellState distinguishes notyet / gone / gap", () => {
  const rec = { first: 2018, last: 2024, ys: { 2023: 0.05 } };
  assert.deepEqual(cellState(rec, 2023), { kind: "pct", p: 0.05, bucket: 0 });
  assert.equal(cellState(rec, 2024).kind, "gap");   // within span, no pct
  assert.equal(cellState(rec, 2025).kind, "gone");  // after last season
  assert.equal(cellState({ first: 2025, last: 2026, ys: {} }, 2023).kind, "notyet");
});

t("6553 sat out 2023-24 and returned in 2025 — gap, not churn", () => {
  const r = rows.find(r => r.team === 6553);
  assert.equal(cellState(r, 2023).kind, "gap");
  assert.equal(cellState(r, 2024).kind, "gap");
  assert.equal(cellState(r, 2025).kind, "pct");
  assert.equal(cellState(r, 2026).kind, "gone");
});

t("every cell resolves to exactly one state, and the census matches the spec", () => {
  const c = { pct: 0, notyet: 0, gone: 0, gap: 0 };
  for (const r of rows) for (const y of YEARS) c[cellState(r, y).kind]++;
  assert.deepEqual(c, { pct: 268, notyet: 25, gone: 26, gap: 5 });
  assert.equal(c.pct + c.notyet + c.gone + c.gap, rows.length * 4);
});

// --- overall percentile -----------------------------------------------------------------------
t("overallPct averages only the years played", () => {
  assert.equal(overallPct({ ys: { 2023: 0.2, 2024: 0.4 } }), 0.30000000000000004);
  assert.equal(overallPct({ ys: {} }), null);
  const r = rows.find(r => r.team === 6553);   // played 2025 only, in-window
  assert.equal(r.overall, r.ys[2025]);
});

// --- membership -------------------------------------------------------------------------------
t("81 teams, every one with >=1 bottom-decile year", () => {
  assert.equal(rows.length, 81);
  assert.ok(rows.every(r => r.nBottom >= 1));
});

t("bottom-decile-year distribution matches the spec", () => {
  const d = {};
  for (const r of rows) d[r.nBottom] = (d[r.nBottom] || 0) + 1;
  assert.deepEqual(d, { 1: 57, 2: 16, 3: 7, 4: 1 });
});

t("no team on the list has a bottom-decile percentile >= .10", () => {
  for (const r of rows)
    for (const y of YEARS) {
      const s = cellState(r, y);
      if (s.kind === "pct" && s.bucket === 0) assert.ok(s.p < 0.10);
    }
});

// --- halves -----------------------------------------------------------------------------------
t("SoCal is exactly the ten counties FIRST names", () => {
  const SOCAL = new Set(["San Luis Obispo", "Kern", "San Bernardino", "Santa Barbara", "Ventura",
    "Los Angeles", "Orange", "Riverside", "San Diego", "Imperial"]);
  for (const r of rows) assert.equal(r.h, SOCAL.has(r.c) ? 1 : 0, `team ${r.team} (${r.c})`);
});

t("split is 51 SoCal / 30 NorCal, 16 counties", () => {
  assert.equal(rows.filter(r => r.h === 1).length, 51);
  assert.equal(rows.filter(r => r.h === 0).length, 30);
  assert.equal(new Set(rows.map(r => r.c)).size, 16);
});

// --- filters ----------------------------------------------------------------------------------
t("filters hide rows and never change the numbers", () => {
  assert.equal(filterRows(rows, {}).length, 81);
  assert.equal(filterRows(rows, { only2026: true }).length, 67);
  assert.equal(filterRows(rows, { half: "soc" }).length, 51);
  assert.equal(filterRows(rows, { half: "nor" }).length, 30);
  assert.equal(filterRows(rows, { half: "soc", only2026: true }).length, 45);
  assert.equal(filterRows(rows, { half: "nor", only2026: true }).length, 22);
  // 6981 is in Concord (Contra Costa) = northern; its numbers must not shift under a filter.
  const before = rows.find(r => r.team === 6981).overall;
  assert.equal(filterRows(rows, { half: "nor" }).find(r => r.team === 6981).overall, before);
  assert.equal(filterRows(rows, { half: "soc" }).find(r => r.team === 6981), undefined);
});

// --- sorting ----------------------------------------------------------------------------------
t("default sort is team number ascending", () => {
  const s = sortRows(rows, "team", 1);
  assert.equal(s[0].team, 867);
  assert.equal(s[s.length - 1].team, 11247);
});

t("a year sort puts absent cells last in BOTH directions", () => {
  const has = r => r.ys[2023] != null;
  for (const dir of [1, -1]) {
    const s = sortRows(rows, "2023", dir);
    const firstAbsent = s.findIndex(r => !has(r));
    assert.ok(firstAbsent > 0);
    assert.ok(s.slice(firstAbsent).every(r => !has(r)),
      `dir ${dir}: an absent 2023 cell ranked above a real percentile`);
  }
});

t("sorting is stable on ties via team number", () => {
  const s = sortRows(rows, "half", 1);
  const nor = s.filter(r => r.h === 0).map(r => r.team);
  assert.deepEqual(nor, [...nor].sort((a, b) => a - b));
});

t("string sorts respect direction", () => {
  const asc = sortRows(rows, "county", 1);
  const desc = sortRows(rows, "county", -1);
  assert.equal(asc[0].c, "Alameda");
  assert.equal(desc[0].c, "Ventura");
});

// --- contrast: the page is dark-only, so this is asserted, not eyeballed -----------------------
const hex = h => [0, 2, 4].map(i => parseInt(h.replace("#", "").slice(i, i + 2), 16));
const over = (tint, alpha, base) =>
  hex(tint).map((c, i) => Math.round(c * alpha + hex(base)[i] * (1 - alpha)));
const lum = rgb => {
  const [r, g, b] = rgb.map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (fg, bg) => {
  const [a, b] = [lum(fg), lum(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

t("every cell color clears WCAG AA (4.5:1) on its own tinted background", () => {
  for (const [name, c] of Object.entries(palette.cells)) {
    const r = ratio(hex(c.fg), over(c.tint, c.alpha, palette.surface));
    assert.ok(r >= 4.5, `${name}: ${r.toFixed(2)}:1 is below AA`);
    console.log(`      ${name.padEnd(9)} ${r.toFixed(2)}:1`);
  }
});

t("the five cell states each have a distinct color", () => {
  const fgs = Object.values(palette.cells).map(c => c.fg);
  assert.equal(new Set(fgs).size, fgs.length);
});

// Matches the sibling suites' convention: a bare `node compute.test.mjs` prints ALL PASS or throws.
console.log(`\n${n} tests\nALL PASS`);
