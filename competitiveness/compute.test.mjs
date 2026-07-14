// Golden-value tests for compute.js — run: node competitiveness/compute.test.mjs
// Goldens from the validated Python analysis (see the design spec §3).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildRecords, gradient, reachByEarlyBucket, earlyCurves, ageControlled,
  recovery, veteranStreak, veteranClimbOut,
} from "./compute.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(HERE, "data.json"), "utf8"));
const { records, meta } = buildRecords(data);
const { start, end } = meta;

let fail = 0;
const near = (a, b, t) => Math.abs(a - b) <= t;
const pctv = c => c.n ? c.s / c.n : 0;
function check(name, ok, detail) {
  if (ok) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} — ${detail}`); fail++; }
}

// region count sanity
check("10 regions", meta.regions.length === 10, meta.regions.join(","));

// (1) decile gradient 33% -> 80%
const g = gradient(records, start, end);
check("decile 0 reach yr5 ~0.33", near(pctv({s:g[0].s5,n:g[0].n5}), 0.33, 0.04), `${pctv({s:g[0].s5,n:g[0].n5}).toFixed(3)}`);
check("decile 9 reach yr5 ~0.80", near(pctv({s:g[9].s5,n:g[9].n5}), 0.80, 0.06), `${pctv({s:g[9].s5,n:g[9].n5}).toFixed(3)}`);
check("gradient monotonic-ish (d0<d4<d8)",
  pctv({s:g[0].s5,n:g[0].n5}) < pctv({s:g[4].s5,n:g[4].n5}) && pctv({s:g[4].s5,n:g[4].n5}) < pctv({s:g[8].s5,n:g[8].n5}), "not monotonic");

// (2) reach by early bucket
const r5 = reachByEarlyBucket(records, start, end, 5, 2019).map(pctv);
check("early buckets reach yr5 ~ 33/55/70", near(r5[0],0.33,0.04)&&near(r5[1],0.55,0.04)&&near(r5[2],0.70,0.04), r5.map(x=>x.toFixed(2)).join("/"));
const r10 = reachByEarlyBucket(records, start, end, 10, 2014).map(pctv);
check("early buckets reach yr10 ~ 23/41/58", near(r10[0],0.23,0.05)&&near(r10[1],0.41,0.05)&&near(r10[2],0.58,0.05), r10.map(x=>x.toFixed(2)).join("/"));

// (2b) survival curves exist and fan (top > bottom at age 5)
const ec = earlyCurves(records, start, end, 16);
check("early curves fan at age 5 (top>bottom)", pctv(ec.curves[2][5]) > pctv(ec.curves[0][5]),
  `${pctv(ec.curves[2][5]).toFixed(2)} vs ${pctv(ec.curves[0][5]).toFixed(2)}`);

// (3) age-controlled monotonic within bands; new ~ 62/69/80
const ac = ageControlled(records, start, end);
const nw = ac["new (0-2)"].map(pctv);
check("age-controlled new band ~ 62/69/80", near(nw[0],0.62,0.04)&&near(nw[1],0.69,0.04)&&near(nw[2],0.80,0.04), nw.map(x=>x.toFixed(2)).join("/"));
const v11 = ac["age 11+"].map(pctv);
check("age 11+ bucket monotonic 78/87/96", near(v11[0],0.78,0.05)&&near(v11[2],0.96,0.03)&&v11[0]<v11[1]&&v11[1]<v11[2], v11.map(x=>x.toFixed(2)).join("/"));

// (4) recovery at age 5: stayed ~44, climbed-top ~76
const rec = recovery(records, start, end, 16);
check("recovery yr5 stayed ~0.44", near(pctv(rec.grp.stayed[5]),0.44,0.06), `${pctv(rec.grp.stayed[5]).toFixed(2)}`);
check("recovery yr5 topClimb ~0.76", near(pctv(rec.grp.topClimb[5]),0.76,0.06), `${pctv(rec.grp.topClimb[5]).toFixed(2)}`);
check("recovery: topClimb > stayed at yr5", pctv(rec.grp.topClimb[5]) > pctv(rec.grp.stayed[5]), "no");

// (5) veteran streaks: not-bottom ~0.90, bottom groups ~0.70-0.73, roughly flat
const vs = veteranStreak(records, start, end).g3.map(pctv);
check("veteran not-bottom survive+3 ~0.90", near(vs[0],0.896,0.03), vs[0].toFixed(3));
check("veteran bottom-1yr survive+3 ~0.73", near(vs[1],0.728,0.04), vs[1].toFixed(3));
check("veteran: bottom hit is real (not-bottom >> bottom)", vs[0] - vs[1] > 0.10, `${(vs[0]-vs[1]).toFixed(3)}`);
const co = veteranClimbOut(records, start, end);
check("veteran climb-out > stay-down", pctv(co.climbed) > pctv(co.stayed) && near(pctv(co.climbed),0.865,0.05),
  `${pctv(co.climbed).toFixed(3)} vs ${pctv(co.stayed).toFixed(3)}`);

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
