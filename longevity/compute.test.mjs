// Golden-value tests for compute.js — run: node longevity/compute.test.mjs
// Golden values come from the validated first-cut analysis (see the design spec).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildRecords, activeByYear, flows, cohortSurvival,
  departureByAgeYear, departureByGroupYear, departureByAgeBandsYear,
  standardizedRate, ageComposition, lifespanHistogram,
} from "./compute.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const participation = JSON.parse(readFileSync(join(HERE, "team_participation.json"), "utf8"));
const { records, meta } = buildRecords(participation);
const { start, end } = meta;

let failures = 0;
function check(name, ok, detail) {
  if (ok) { console.log(`  ok   ${name}`); }
  else { console.error(`  FAIL ${name} — ${detail}`); failures++; }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// 1) Population: 2020 peak
const active = activeByYear(records, start, end);
check("active[2020] == 3904", active[2020] === 3904, `got ${active[2020]}`);
check("active[2026] < active[2020] (below peak)", active[2026] < active[2020],
  `2026=${active[2026]} 2020=${active[2020]}`);

// 2) Cohort survival pooled year-2 ~ 74.3%
const cs = cohortSurvival(records, start, end);
let n2 = 0, s2 = 0;
for (const c of Object.keys(cs).map(Number)) {
  if (c + 2 > end) continue;
  const m = cs[c];
  n2 += m.N; s2 += (m.surv[2] ?? 0) * m.N;
}
const pooledY2 = s2 / n2;
check("pooled year-2 survival ~ 0.743", near(pooledY2, 0.743, 0.006), `got ${pooledY2.toFixed(4)}`);

// 3) Median completed lifespan == 3
const hist = lifespanHistogram(records, end);
const spans = [];
for (const [len, n] of Object.entries(hist)) for (let i = 0; i < n; i++) spans.push(Number(len));
spans.sort((a, b) => a - b);
const median = spans[Math.floor(spans.length / 2)];
check("median completed lifespan == 3", median === 3, `got ${median} (N=${spans.length})`);

// 4) Age composition: 16+ field share aged from ~11% (pre-COVID) to ~28% (post-COVID avg)
const comp = ageComposition(records, start, end);
const avg16 = (yrs) => yrs.reduce((s, y) => s + comp[y]["16+"], 0) / yrs.length;
const pre16 = avg16([2016, 2017, 2018, 2019]);
const post16 = avg16([2023, 2024, 2025, 2026]);
check("age16+ share pre-COVID ~ 0.111", near(pre16, 0.111, 0.02), `got ${pre16.toFixed(3)}`);
check("age16+ share post-COVID ~ 0.281", near(post16, 0.281, 0.02), `got ${post16.toFixed(3)}`);
check("median age 2026 ~ 10", near(comp.medianAge[2026], 10, 1), `got ${comp.medianAge[2026]}`);

// 5) Standardized departure rate 2022 ~ 21.7%
const std = standardizedRate(records, start, end, [2016, 2017, 2018, 2019]);
check("standardized dep rate 2022 ~ 0.217", near(std[2022].std, 0.217, 0.015),
  `got ${std[2022].std.toFixed(4)}`);

// 6) Flows sanity: rookies 2021 collapsed, big net drop
const fl = flows(records, start, end);
check("2021 net strongly negative (COVID)", fl[2021].net < -500, `got ${fl[2021].net}`);
check("deaths null for provisional 2026", fl[2026].deaths === null, `got ${fl[2026].deaths}`);

// 7) departureByAgeYear: young teams churn more than veterans (2024)
const dep = departureByAgeYear(records, start, end);
check("age1 dep rate > age16+ dep rate (2024)",
  dep[2024]["age1"].rate > dep[2024]["16+"].rate,
  `age1=${dep[2024]["age1"].rate.toFixed(3)} 16+=${dep[2024]["16+"].rate.toFixed(3)}`);

// 8) departureByGroupYear: single group reproduces the crude 2024 departure rate (~6.6%)
const grp1 = departureByGroupYear(records, start, end, () => "all");
check("group-all dep rate 2024 ~ 0.066", near(grp1[2024]["all"].rate, 0.066, 0.006),
  `got ${grp1[2024]["all"].rate.toFixed(4)}`);
// tranche split: post-COVID cohorts leave faster than veterans in a recent year (2024)
const tr = (r) => r.r <= 2008 ? "vet" : (r.r >= 2022 ? "post" : null);
const grp2 = departureByGroupYear(records, start, end, tr);
check("post-COVID tranche dep > veteran tranche (2024)",
  grp2[2024]["post"].rate > grp2[2024]["vet"].rate,
  `post=${grp2[2024]["post"].rate.toFixed(3)} vet=${grp2[2024]["vet"].rate.toFixed(3)}`);

// 9) departureByAgeBandsYear: young teams leave much more than veterans (2024)
const ab = departureByAgeBandsYear(records, start, end, [
  { key: "y1_3", lo: 0, hi: 2 }, { key: "y4_7", lo: 3, hi: 6 },
  { key: "y8_10", lo: 7, hi: 9 }, { key: "y11", lo: 10, hi: Infinity },
]);
check("age-band: young(1–3) dep > veteran(11+) dep, 2024",
  ab[2024]["y1_3"].rate > ab[2024]["y11"].rate,
  `young=${ab[2024]["y1_3"].rate.toFixed(3)} vet=${ab[2024]["y11"].rate.toFixed(3)}`);
check("age-band: veteran(11+) dep rate rose from 2018 to 2024",
  ab[2024]["y11"].rate > ab[2018]["y11"].rate,
  `2018=${ab[2018]["y11"].rate.toFixed(3)} 2024=${ab[2024]["y11"].rate.toFixed(3)}`);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
