import { WORLD, type State } from "./sim";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Pure renderer. Makes no decisions, mutates no state, counts no score.
 * No line in this file is tested; validation is visual.
 */
export function render(
  ctx: CanvasRenderingContext2D,
  prev: State,
  curr: State,
  alpha: number,
): void {
  ctx.fillStyle = "#12141c";
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  for (const orb of curr.orbs) {
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd166";
    ctx.fill();
  }

  // Player is rendered by interpolating between two ticks.
  const x = lerp(prev.player.x, curr.player.x, alpha);
  const y = lerp(prev.player.y, curr.player.y, alpha);
  ctx.beginPath();
  ctx.arc(x, y, curr.player.r, 0, Math.PI * 2);
  ctx.fillStyle = "#4cc9f0";
  ctx.fill();
}
