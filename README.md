# Orb Collector — A Testable Canvas Game (Clean Room Architecture)

<!-- LINKS:BEGIN — üretildi: scripts/sync-repo-links.py · elle düzenleme -->
**▶ [Live demo](https://m2-md.github.io/testable-canvas-game-vitest/)** · [Source](https://github.com/m2-md/testable-canvas-game-vitest)
<!-- LINKS:END -->

Working code for the article "Clean Room: What Makes a Canvas Game Testable Is Not the
Tests, It's the Architecture". A small but complete canvas game (**Orb Collector**) and
the 10 tests that prove it in headless vitest.

The idea in one sentence: separate the simulation from the rendering, the randomness from
`Math.random`, and the time from `performance.now`. What is left, `step(state, input, dt, rng)`,
is a pure function — it gives the same result in Node, in a worker, on a server, in a test.

## Contents

- `src/sim.ts` — the single source of truth of the game. `State`, `step`, `runTicks`,
  `chaseNearest` (the pure test bot). No DOM, no `Math.random`, no `Date`. One import: `type Rng`.
- `src/rng.ts` — `mulberry32(seed)`: a seeded PRNG. Same seed → same sequence.
- `src/clock.ts` — the `Clock` interface (`systemClock` / `makeFakeClock`) + `FixedLoop`.
  It samples input **per tick**, not per frame; that is the quiet precondition of determinism.
- `src/hash.ts` — `hashState`: FNV-1a, reducing the whole simulation state into a single
  32-bit number. Floats are mixed bit by bit, and the `-0` trap is closed with `x + 0`.
- `src/render.ts` — it ONLY draws. It makes no decisions, it changes no state. It has no
  test; the test is your eye.
- `src/main.ts` + `index.html` — the only face turned toward the browser: keyboard → `Input`,
  rAF → `FixedLoop`, seed / score / tick / hash in the HUD.
- `src/bench-cli.ts` — runs the same seeded simulation 200 times; reports hash stability
  and tick cost.
- `test/sim.test.ts` — 10 tests: determinism, golden hash, dt subdivision, architectural
  rules (`Math.random` and DOM traps), non-mutation, game rules.

## Setup

```bash
npm install
```

## Running

### Tests

```bash
npm test
```

Expected output:

```
 ✓ test/sim.test.ts (10 tests) 9ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

The tests run in the `node` environment — NO `document`, NO canvas, NO WebGL. One test
asserts this directly: `expect(typeof document).toBe("undefined")`. That is why
`environment: "jsdom"` **must not be set**.

### Bench — determinism + tick cost

```bash
npm run bench
```

Expected output (the numbers vary by machine; `distinct hash count` must always be 1):

```
Orb Collector — determinism + tick cost
scene: seed=12345 · 600 ticks (10.0 s sim) · 200 runs

determinism
  distinct hash count : 1 (expected 1)
  hash                : 0x353ca0ac
  score               : 12
  result              : STABLE ✓

cost
  median per run      : 0.027 ms
  p95 per run         : 0.081 ms
  per tick            : 0.045 µs
  total over 200 runs : 6.6 ms (120,000 ticks)
  within a 16.7 ms budget : ~370,378 ticks
```

If the hash set comes out larger than one, the bench throws: dust got into the room somewhere.

### Live demo

> ⚠️ **Do not double-click `index.html` and open it directly.** The demo loads a TypeScript
> module (`<script type="module" src="/src/main.ts">`); over `file://` you will see a blank
> screen. The only way to run it is the Vite command below.

```bash
npm run dev
```

`http://localhost:5173/` opens. Drive the blue ball with the **arrow keys or WASD** and touch
the yellow orbs; every contact raises the score. In the HUD:

```
seed 12345 • score 7 • tick 1042 • hash 9c1be3a4
```

The seed is fixed (12345), so the same orb layout is born on every launch. If you open the
demo in two browsers and press the same keys in the same order, you should see the same hex
number at the same tick — that is determinism checked with the naked eye.

### Build

```bash
npm run build    # tsc && vite build
npm run preview  # serve the production output
```

## A note on the golden hash

The `expect(hashState(s)).toBe(0x353ca0ac)` inside `test/sim.test.ts` is a regression lock.
If you change the math of `step`, its constants (ACCEL 1800, FRICTION 3.2, SPAWN_EVERY 0.6,
MAX_ORBS 12, ORB_R 12, PLAYER_R 16, WORLD 800×600), the ±2 px dead zone of `chaseNearest`,
or the field order of `hashState`, this number changes. If the change was intentional, update
the hash; if it was not, you moved something.

## License

MIT
