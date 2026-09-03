import { WORLD, type State } from "./sim";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * SADECE çizer. Karar vermez, durum değiştirmez, skor saymaz.
 * Bu dosyanın hiçbir satırı test edilmiyor; doğrulaması göz ile.
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

  // Oyuncu iki tık arasında enterpolasyonla çizilir.
  const x = lerp(prev.player.x, curr.player.x, alpha);
  const y = lerp(prev.player.y, curr.player.y, alpha);
  ctx.beginPath();
  ctx.arc(x, y, curr.player.r, 0, Math.PI * 2);
  ctx.fillStyle = "#4cc9f0";
  ctx.fill();
}
