import type { Rng } from "./rng";
import { step, type InputScript, type State } from "./sim";

/** Single gate of time. Wall clock in production, fake clock in tests. */
export interface Clock {
  now(): number; // milisaniye
}

export const systemClock: Clock = {
  now: () => performance.now(),
};

export interface FakeClock extends Clock {
  advance(ms: number): void;
}

/** Elle ilerletilen clock: test time kendi eliyle writes. */
export function makeFakeClock(start = 0): FakeClock {
  let t = start;
  return {
    now: () => t,
    advance(ms: number) {
      t += ms;
    },
  };
}

export const STEP = 1 / 60; // fixed physics step (seconds)
const MAX_STEPS = 5;
const MAX_FRAME = 0.25;
const EPS = 1e-9;

export class FixedLoop {
  private acc = 0;
  private last: number;
  prev: State;
  curr: State;
  alpha = 0;

  constructor(
    private clock: Clock,
    initial: State,
    private rng: Rng,
    private stepSize = STEP,
  ) {
    this.last = clock.now();
    this.prev = initial;
    this.curr = initial;
  }

  /**
   * Advance one frame: ticks 0..MAX_STEPS times according to elapsed real time.
   * Input is sampled separately on every TICK — not once per frame.
   */
  tick(poll: InputScript): number {
    const now = this.clock.now();
    let frameTime = (now - this.last) / 1000;
    this.last = now;
    if (frameTime > MAX_FRAME) frameTime = MAX_FRAME;
    this.acc += frameTime;

    let steps = 0;
    while (this.acc >= this.stepSize - EPS && steps < MAX_STEPS) {
      this.prev = this.curr;
      this.curr = step(this.curr, poll(this.curr), this.stepSize, this.rng);
      this.acc -= this.stepSize;
      steps++;
    }
    if (steps === MAX_STEPS && this.acc >= this.stepSize) this.acc = 0;

    this.alpha = this.acc / this.stepSize;
    return steps;
  }
}
