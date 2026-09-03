import { hashState } from "./hash";
import { mulberry32 } from "./rng";
import { chaseNearest, createState, runTicks } from "./sim";
import { STEP } from "./clock";

const SEED = 12345;
const TICKS = 600;
const RUNS = 200;

const hex = (h: number) => "0x" + h.toString(16).padStart(8, "0");

function runOnce(seed: number, ticks: number) {
  return runTicks(createState(), chaseNearest, ticks, STEP, mulberry32(seed));
}

// Isınma turu: JIT'in sıcak yola girmesi için.
for (let i = 0; i < 20; i++) runOnce(SEED, TICKS);

const hashes = new Set<number>();
const times: number[] = [];
let lastScore = 0;

for (let i = 0; i < RUNS; i++) {
  const t0 = performance.now();
  const s = runOnce(SEED, TICKS);
  times.push(performance.now() - t0);
  hashes.add(hashState(s));
  lastScore = s.score;
}

times.sort((a, b) => a - b);
const total = times.reduce((a, b) => a + b, 0);
const median = times[times.length >> 1]!;
const p95 = times[Math.floor(times.length * 0.95)]!;

const stable = hashes.size === 1;

console.log("Orb Collector — determinizm + tick maliyeti");
console.log(
  `sahne: tohum=${SEED} · ${TICKS} tick (${(TICKS * STEP).toFixed(1)} sn sim) · ${RUNS} koşu\n`,
);

console.log("determinizm");
console.log(`  farklı hash sayısı : ${hashes.size} (beklenen 1)`);
console.log(`  hash               : ${[...hashes].map(hex).join(", ")}`);
console.log(`  skor               : ${lastScore}`);
console.log(`  sonuç              : ${stable ? "SABİT ✓" : "IRAKSADI ✗"}\n`);

console.log("maliyet");
console.log(`  koşu başına medyan : ${median.toFixed(3)} ms`);
console.log(`  koşu başına p95    : ${p95.toFixed(3)} ms`);
console.log(
  `  tick başına        : ${((median / TICKS) * 1000).toFixed(3)} µs`,
);
console.log(
  `  ${RUNS} koşu toplamı   : ${total.toFixed(1)} ms (${(RUNS * TICKS).toLocaleString("en-US")} tick)`,
);
console.log(
  `  16.7 ms bütçesinde : ~${Math.round(16.667 / (median / TICKS)).toLocaleString("en-US")} tick`,
);

if (!stable)
  throw new Error("determinizm bozuldu: aynı tohum farklı hash verdi");
