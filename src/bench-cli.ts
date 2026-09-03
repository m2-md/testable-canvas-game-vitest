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

// Warmup round: allows JIT to enter hot path.
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
  `scene: seed=${SEED} · ${TICKS} ticks (${(TICKS * STEP).toFixed(1)} s sim) · ${RUNS} runs\n`,
);

console.log("determinizm");
console.log(`  distinct hashes    : ${hashes.size} (expected 1)`);
console.log(`  hash               : ${[...hashes].map(hex).join(", ")}`);
console.log(`  skor               : ${lastScore}`);
console.log(`  result             : ${stable ? "STABLE ✓" : "DIVERGED ✗"}\n`);

console.log("maliyet");
console.log(`  median per run     : ${median.toFixed(3)} ms`);
console.log(`  p95 per run        : ${p95.toFixed(3)} ms`);
console.log(
  `  per tick           : ${((median / TICKS) * 1000).toFixed(3)} µs`,
);
console.log(
  `  ${RUNS} runs total     : ${total.toFixed(1)} ms (${(RUNS * TICKS).toLocaleString("en-US")} ticks)`,
);
console.log(
  `  in 16.7 ms budget  : ~${Math.round(16.667 / (median / TICKS)).toLocaleString("en-US")} ticks`,
);

if (!stable)
  throw new Error("determinism broken: same seed produced different hash");
