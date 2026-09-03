import { FixedLoop, systemClock } from "./clock";
import { hashHex } from "./hash";
import { render } from "./render";
import { mulberry32 } from "./rng";
import { WORLD, createState, type Input } from "./sim";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
canvas.width = WORLD.w;
canvas.height = WORLD.h;
const ctx = canvas.getContext("2d")!;
const hud = document.querySelector<HTMLSpanElement>("#hud")!;

const SEED = 12345;
const loop = new FixedLoop(systemClock, createState(), mulberry32(SEED));

// Keyboard -> Input. The only browser-specific logic lives here; sim is agnostic.
const input: Input = { left: false, right: false, up: false, down: false };
const keymap: Record<string, keyof Input> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  a: "left",
  d: "right",
  w: "up",
  s: "down",
};

addEventListener("keydown", (e) => {
  const k = keymap[e.key];
  if (k) {
    input[k] = true;
    e.preventDefault();
  }
});
addEventListener("keyup", (e) => {
  const k = keymap[e.key];
  if (k) input[k] = false;
});

function frame() {
  loop.tick(() => input);
  render(ctx, loop.prev, loop.curr, loop.alpha);
  hud.textContent = `seed ${SEED} • score ${loop.curr.score} • tick ${loop.curr.tick} • hash ${hashHex(loop.curr)}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
