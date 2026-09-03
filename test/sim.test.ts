import { describe, it, expect } from "vitest";
import { chaseNearest, createState, runTicks, type Input } from "../src/sim";
import { mulberry32 } from "../src/rng";
import { hashState } from "../src/hash";
import { FixedLoop, makeFakeClock, STEP } from "../src/clock";

// El yerine senaryo: en yakın orb'a koşan saf bot.
const script = chaseNearest;

const run = (seed: number, ticks: number) =>
  runTicks(createState(), script, ticks, STEP, mulberry32(seed));

describe("determinizm", () => {
  it("aynı tohum + aynı girdi → aynı state hash", () => {
    expect(hashState(run(12345, 600))).toBe(hashState(run(12345, 600)));
  });

  it("farklı tohum → farklı state hash", () => {
    expect(hashState(run(12345, 600))).not.toBe(hashState(run(999, 600)));
  });

  it("golden hash: 600 tick sonrası beklenen durum", () => {
    const s = run(12345, 600);
    expect(s.tick).toBe(600);
    expect(s.score).toBe(12); // bot 10 saniyede 12 orb topluyor
    expect(hashState(s)).toBe(0x353ca0ac);
  });
});

describe("sabit adım: kare bölünmesi sonucu değiştirmez", () => {
  // Aynı 10 saniye, üç farklı FPS senaryosu — hepsi sahte saatle.
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

  it("60, 30 ve 15 FPS birebir aynı state hash'i verir", () => {
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
      throw new Error("sim global rastgelelik kullandı");
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

  it("headless ortamda canvas gerçekten yok", () => {
    expect(typeof document).toBe("undefined");
  });

  it("step girdi state'i mutasyona uğratmaz", () => {
    const s0 = createState();
    const before = hashState(s0);
    runTicks(s0, script, 120, STEP, mulberry32(1));
    expect(hashState(s0)).toBe(before);
  });
});

describe("oyun kuralları", () => {
  const still: Input = { left: false, right: false, up: false, down: false };

  it("orb'lar zamanla doğar ve tavanda durur", () => {
    const s = runTicks(
      createState(),
      () => still,
      60 * 30,
      STEP,
      mulberry32(3),
    );
    expect(s.orbs.length).toBe(12);
  });

  it("korunum: toplanan + sahadaki = doğan", () => {
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
