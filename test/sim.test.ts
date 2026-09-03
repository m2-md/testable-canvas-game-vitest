import { describe, it, expect } from "vitest";
import { chaseNearest, createState, runTicks, type Input } from "../src/sim";
import { mulberry32 } from "../src/rng";
import { hashState } from "../src/hash";
import { FixedLoop, makeFakeClock, STEP } from "../src/clock";

// Script instead of human hands: pure bot running towards nearest orb.
const script = chaseNearest;

const run = (seed: number, ticks: number) =>
  runTicks(createState(), script, ticks, STEP, mulberry32(seed));

describe("determinizm", () => {
  it("same tohum + same input → same state hash", () => {
    expect(hashState(run(12345, 600))).toBe(hashState(run(12345, 600)));
  });

  it("different tohum → different state hash", () => {
    expect(hashState(run(12345, 600))).not.toBe(hashState(run(999, 600)));
  });

  it("golden hash: expected state after 600 ticks", () => {
    const s = run(12345, 600);
    expect(s.tick).toBe(600);
    expect(s.score).toBe(12); // bot 10 saniyede 12 orb topluyor
    expect(hashState(s)).toBe(0x353ca0ac);
  });
});

describe("fixed step: frame subdivision does not alter result", () => {
  // same 10 saniye, three different FPS senaryosu — hepsi sahte saatle.
  const runAtFps = (fps: number, seconds: number) => {
    const clock = makeFakeClock(0);
    const loop = new FixedLoop(clock, createState(), mulberry32(12345));
    const frames = Math.round(seconds * fps);
    for (let i = 0; i < frames; i++) {
      clock.advance(1000 / fps);
      loop.tick(script);
    }
    return loop.curr;
  };

  it("60, 30 and 15 FPS birebir same state hash'i verir", () => {
    const a = runAtFps(60, 10);
    const b = runAtFps(30, 10);
    const c = runAtFps(15, 10);

    expect(a.tick).toBe(600);
    expect(hashState(b)).toBe(hashState(a));
    expect(hashState(c)).toBe(hashState(a));
  });
});

describe("mimari kurallar", () => {
  it("sim Math.random'a dokunmaz", () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error("sim used global randomness");
    };
    try {
      expect(() => run(7, 600)).not.toThrow();
    } finally {
      Math.random = original;
    }
  });

  it("sim DOM'a dokunmaz", () => {
    const trap = new Proxy(
      {},
      {
        get() {
          throw new Error("sim DOM'a dokundu");
        },
      },
    );
    const g = globalThis as Record<string, unknown>;
    g.document = trap;
    g.window = trap;
    try {
      expect(() => run(7, 600)).not.toThrow();
    } finally {
      delete g.document;
      delete g.window;
    }
  });

  it("canvas is truly absent in headless environment", () => {
    expect(typeof document).toBe("undefined");
  });

  it("step does not mutate input state", () => {
    const s0 = createState();
    const before = hashState(s0);
    runTicks(s0, script, 120, STEP, mulberry32(1));
    expect(hashState(s0)).toBe(before);
  });
});

describe("game rules", () => {
  const still: Input = { left: false, right: false, up: false, down: false };

  it("orbs spawn over time and stop at ceiling", () => {
    const s = runTicks(
      createState(),
      () => still,
      60 * 30,
      STEP,
      mulberry32(3),
    );
    expect(s.orbs.length).toBe(12);
  });

  it("conservation: collected + on field = spawned", () => {
    const s = runTicks(
      createState(),
      () => still,
      60 * 30,
      STEP,
      mulberry32(3),
    );
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score + s.orbs.length).toBe(s.nextId - 1);
  });
});
