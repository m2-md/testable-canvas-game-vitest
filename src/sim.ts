import type { Rng } from "./rng";

export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export interface Orb {
  id: number;
  x: number;
  y: number;
  r: number;
}

export interface State {
  tick: number;
  time: number;
  player: { x: number; y: number; vx: number; vy: number; r: number };
  orbs: Orb[];
  score: number;
  nextId: number;
  spawnTimer: number;
}

export const WORLD = { w: 800, h: 600 };

const ACCEL = 1800; // px/s²
const FRICTION = 3.2; // 1/s
const MAX_ORBS = 12;
const SPAWN_EVERY = 0.6; // saniye
const ORB_R = 12;
const PLAYER_R = 16;

export function createState(): State {
  return {
    tick: 0,
    time: 0,
    player: { x: WORLD.w / 2, y: WORLD.h / 2, vx: 0, vy: 0, r: PLAYER_R },
    orbs: [],
    score: 0,
    nextId: 1,
    spawnTimer: 0,
  };
}

/**
 * Oyunun tek gerçeği. DOM yok, Math.random yok, Date.now yok.
 * Dışarıdan gelen (state, input, dt, rng) dörtlüsü sonucu tam belirler.
 */
export function step(state: State, input: Input, dt: number, rng: Rng): State {
  // 1) Girdi → ivme. Çapraz basılıysa hızı normalize et.
  let ax = 0;
  let ay = 0;
  if (input.left) ax -= 1;
  if (input.right) ax += 1;
  if (input.up) ay -= 1;
  if (input.down) ay += 1;
  if (ax !== 0 && ay !== 0) {
    ax *= Math.SQRT1_2;
    ay *= Math.SQRT1_2;
  }

  const p = state.player;
  let vx = p.vx + ax * ACCEL * dt;
  let vy = p.vy + ay * ACCEL * dt;

  const damp = Math.max(0, 1 - FRICTION * dt); // sürtünme
  vx *= damp;
  vy *= damp;

  let x = p.x + vx * dt;
  let y = p.y + vy * dt;

  // 2) Duvarlar
  if (x < p.r) {
    x = p.r;
    vx = 0;
  } else if (x > WORLD.w - p.r) {
    x = WORLD.w - p.r;
    vx = 0;
  }
  if (y < p.r) {
    y = p.r;
    vy = 0;
  } else if (y > WORLD.h - p.r) {
    y = WORLD.h - p.r;
    vy = 0;
  }

  // 3) Toplama: değen orb listeden düşer, skor artar.
  const orbs: Orb[] = [];
  let score = state.score;
  for (const orb of state.orbs) {
    const dx = orb.x - x;
    const dy = orb.y - y;
    const reach = orb.r + p.r;
    if (dx * dx + dy * dy <= reach * reach) {
      score += 1;
      continue;
    }
    orbs.push(orb);
  }

  // 4) Doğurma: rastgelelik SADECE parametreden gelen rng'den.
  let spawnTimer = state.spawnTimer + dt;
  let nextId = state.nextId;
  while (spawnTimer >= SPAWN_EVERY) {
    spawnTimer -= SPAWN_EVERY;
    if (orbs.length < MAX_ORBS) {
      orbs.push({
        id: nextId++,
        x: ORB_R + rng() * (WORLD.w - 2 * ORB_R),
        y: ORB_R + rng() * (WORLD.h - 2 * ORB_R),
        r: ORB_R,
      });
    }
  }

  return {
    tick: state.tick + 1,
    time: state.time + dt,
    player: { x, y, vx, vy, r: p.r },
    orbs,
    score,
    nextId,
    spawnTimer,
  };
}

/** Duruma bakıp girdi üreten deterministik senaryo (test "oyuncusu"). */
export type InputScript = (state: State) => Input;

/** N tick koştur — testlerin ve replay'in ortak koşucusu. */
export function runTicks(
  state: State,
  script: InputScript,
  ticks: number,
  dt: number,
  rng: Rng,
): State {
  let s = state;
  for (let i = 0; i < ticks; i++) s = step(s, script(s), dt, rng);
  return s;
}

/** Hiçbir tuşa basılmamış girdi. */
export const NO_INPUT: Input = {
  left: false,
  right: false,
  up: false,
  down: false,
};

const DEADZONE = 2; // px — bu eşiğin altında yön basılmaz

/**
 * Saf bot: en yakın orb'a doğru koşar. Testlerin "oyuncusu" bu.
 * Sadece state okur; ne rastgelelik ne zaman bilir.
 */
export function chaseNearest(state: State): Input {
  let target: Orb | undefined;
  let best = Infinity;
  for (const orb of state.orbs) {
    const dx = orb.x - state.player.x;
    const dy = orb.y - state.player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) {
      best = d2;
      target = orb;
    }
  }
  if (!target) return NO_INPUT;

  const dx = target.x - state.player.x;
  const dy = target.y - state.player.y;
  return {
    left: dx < -DEADZONE,
    right: dx > DEADZONE,
    up: dy < -DEADZONE,
    down: dy > DEADZONE,
  };
}
