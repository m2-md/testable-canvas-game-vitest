# Orb Collector — Test Edilebilir Canvas Oyunu (Temiz Oda Mimarisi)

"Temiz Oda: Canvas Oyununu Test Edilebilir Yapan Şey Test Değil, Mimari" makalesinin
çalışan kodu. Küçük ama tam bir canvas oyunu (**Orb Collector**) ve onu headless
vitest'te kanıtlayan 10 test.

Fikir tek cümle: simülasyonu render'dan, rastgeleliği `Math.random`'dan, zamanı
`performance.now`'dan ayır. Geriye kalan `step(state, input, dt, rng)` saf bir
fonksiyondur — Node'da, worker'da, sunucuda, testte aynı sonucu verir.

## İçerik

- `src/sim.ts` — oyunun tek gerçeği. `State`, `step`, `runTicks`, `chaseNearest` (saf
  test botu). DOM yok, `Math.random` yok, `Date` yok. Tek import: `type Rng`.
- `src/rng.ts` — `mulberry32(seed)`: tohumlu PRNG. Aynı tohum → aynı dizi.
- `src/clock.ts` — `Clock` arayüzü (`systemClock` / `makeFakeClock`) + `FixedLoop`.
  Girdiyi kare başına değil **tick başına** örnekler; determinizmin sessiz şartı budur.
- `src/hash.ts` — `hashState`: bütün simülasyon durumunu tek 32-bit sayıya indiren
  FNV-1a. Float'lar bit bit karıştırılır, `-0` tuzağı `x + 0` ile kapatılır.
- `src/render.ts` — SADECE çizer. Karar vermez, durum değiştirmez. Testi yok, testi göz.
- `src/main.ts` + `index.html` — tarayıcıya bakan tek yüz: klavye → `Input`, rAF → `FixedLoop`,
  HUD'da tohum / skor / tick / hash.
- `src/bench-cli.ts` — aynı tohumlu simülasyonu 200 kez koşturur; hash sabitliğini ve
  tick maliyetini raporlar.
- `test/sim.test.ts` — 10 test: determinizm, golden hash, dt bölünmesi, mimari kurallar
  (`Math.random` ve DOM tuzakları), mutasyonsuzluk, oyun kuralları.

## Kurulum

```bash
npm install
```

## Çalıştırma

### Testler

```bash
npm test
```

Beklenen çıktı:

```
 ✓ test/sim.test.ts (10 tests) 9ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

Testler `node` ortamında koşar — `document` YOK, canvas YOK, WebGL YOK. Bir test bunu
doğrudan iddia eder: `expect(typeof document).toBe("undefined")`. Bu yüzden
`environment: "jsdom"` **ayarlanmamalıdır**.

### Bench — determinizm + tick maliyeti

```bash
npm run bench
```

Beklenen çıktı (sayılar makineye göre değişir; `farklı hash sayısı` her zaman 1 olmalı):

```
Orb Collector — determinizm + tick maliyeti
sahne: tohum=12345 · 600 tick (10.0 sn sim) · 200 koşu

determinizm
  farklı hash sayısı : 1 (beklenen 1)
  hash               : 0x353ca0ac
  skor               : 12
  sonuç              : SABİT ✓

maliyet
  koşu başına medyan : 0.027 ms
  koşu başına p95    : 0.081 ms
  tick başına        : 0.045 µs
  200 koşu toplamı   : 6.6 ms (120,000 tick)
  16.7 ms bütçesinde : ~370,378 tick
```

Hash kümesi birden büyük çıkarsa bench hata fırlatır: bir yerde odaya toz kaçmıştır.

### Canlı demo

> ⚠️ **`index.html`'i çift tıklayıp doğrudan açma.** Demo bir TypeScript modülü
> (`<script type="module" src="/src/main.ts">`) yükler; `file://` ile boş ekran görürsün.
> Tek çalıştırma yolu aşağıdaki Vite komutudur.

```bash
npm run dev
```

`http://localhost:5173/` açılır. **Ok tuşları veya WASD** ile mavi topu sürüp sarı
orb'lara değ; her temas skoru artırır. HUD'da:

```
tohum 12345 • skor 7 • tick 1042 • hash 9c1be3a4
```

Tohum sabit (12345), yani her açılışta aynı orb dizilimi doğar. İki tarayıcıda demoyu
açıp aynı tuşlara aynı sırayla basarsan aynı tick'te aynı hex sayıyı görmen gerekir —
determinizmin çıplak gözle kontrolü budur.

### Derleme

```bash
npm run build    # tsc && vite build
npm run preview  # üretim çıktısını servis et
```

## Golden hash notu

`test/sim.test.ts` içindeki `expect(hashState(s)).toBe(0x353ca0ac)` bir regresyon
kilididir. `step`'in matematiğini, sabitlerini (ACCEL 1800, FRICTION 3.2, SPAWN_EVERY 0.6,
MAX_ORBS 12, ORB_R 12, PLAYER_R 16, WORLD 800×600), `chaseNearest`'in ±2 px ölü bölgesini
veya `hashState`'in alan sırasını değiştirirsen bu sayı değişir. Değişiklik kasıtlıysa
hash'i güncelle; değilse bir şey oynatmışsındır.

## Lisans

MIT
