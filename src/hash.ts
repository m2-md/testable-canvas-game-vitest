import type { State } from "./sim";

// Bir float'ın 64 bitini iki 32-bit parçaya bakmak için tek tampon.
const buf = new ArrayBuffer(8);
const f64 = new Float64Array(buf);
const u32 = new Uint32Array(buf);

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function mixU32(h: number, v: number): number {
  for (let i = 0; i < 4; i++) {
    h ^= (v >>> (i * 8)) & 0xff;
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}

/** Sayıyı bit bit karıştır: 0.1 ile 0.100000001 farklı hash verir. */
export function mixNumber(h: number, x: number): number {
  f64[0] = x + 0; // -0'ı +0'a çevirir; iki sıfır aynı hash'i vermeli
  return mixU32(mixU32(h, u32[0]), u32[1]);
}

/** Bütün simülasyon durumunu tek 32-bit sayıya indirger (FNV-1a). */
export function hashState(s: State): number {
  let h = FNV_OFFSET >>> 0;
  h = mixNumber(h, s.tick);
  h = mixNumber(h, s.time);
  h = mixNumber(h, s.score);
  h = mixNumber(h, s.nextId);
  h = mixNumber(h, s.spawnTimer);
  h = mixNumber(h, s.player.x);
  h = mixNumber(h, s.player.y);
  h = mixNumber(h, s.player.vx);
  h = mixNumber(h, s.player.vy);
  h = mixNumber(h, s.orbs.length);
  for (const orb of s.orbs) {
    h = mixNumber(h, orb.id);
    h = mixNumber(h, orb.x);
    h = mixNumber(h, orb.y);
  }
  return h >>> 0;
}

/** HUD'da göstermek için 8 haneli hex. */
export function hashHex(s: State): string {
  return hashState(s).toString(16).padStart(8, "0");
}
