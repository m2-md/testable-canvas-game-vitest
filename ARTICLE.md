# Temiz Oda: Canvas Oyununu Test Edilebilir Yapan Şey Test Değil, Mimari

*Simülasyonu render'dan, rastgeleliği tohumdan, zamanı duvar saatinden ayırınca oyun mantığı sıradan bir saf fonksiyona dönüşüyor — ve vitest'te 9 milisaniyede kanıtlanabiliyor.*

*Tahmini okuma süresi: 14 dakika*

---

Bir arkadaşım oyununu gösterdi, güzeldi. "Testi var mı?" diye sordum. Güldü.

"Oyun kodu test edilmez ki abi. Canvas var, rastgelelik var, `requestAnimationFrame` var. Neyi assert edeceğim, pikselleri mi?"

Bu cümleyi kaç kez duyduğumu sayamam. İçinde bir doğruluk payı da yok değil: gerçekten de bir canvas oyununun *ekranını* test etmek zordur, pahalıdır ve çoğu zaman değmez. Ama burada gizli bir sıçrama var. "Ekranı test edemem" ile "oyunumu test edemem" aynı cümle değil. Aradaki fark bir teknikte değil, bir mimaride saklı.

Bu seride sekiz-dokuz yazıdır aynı disiplini uyguluyoruz da adını hiç koymadık. Bugün adını koyuyoruz.

Yazı boyunca simülasyonu bir **temiz oda** (clean room) gibi düşüneceğim. Çip fabrikalarındaki o odalar var ya; içeri toz girmesin diye pencere açılmaz, dışarıdan hiçbir şey serbestçe sızmaz, ne gerekiyorsa bir geçiş kapağından elden verilir. Test edilebilir oyun mantığı tam olarak böyle bir odadır. Odanın içinde `document` diye bir şey yok; `Math.random` de, `performance.now` da içeri alınmaz. Oda, dışarısı ne verirse onunla çalışır ve sonucu geri uzatır. Odanın camdan bir duvarı vardır: render. Dışarıdan içeriyi izlersin ama oda seni görmez.

Bu odayı üç kesikle inşa edeceğiz. Her kesik, dışarıya açılan bir deliği kapatacak.

### Neden Oyun Kodu "Test Edilemez" Sanılır

Önce derdi dürüstçe kuralım. Tipik bir canvas oyununun kalbi şöyle görünür. Bunda utanılacak bir şey de yok; çoğumuz oraya böyle başlarız:

```ts
// ÖNCE — çalışır ama test edilemez. Bu dosya projede YOK, sadece derdin resmi.
const ctx = document.querySelector("canvas")!.getContext("2d")!;
let score = 0;
const orbs: { x: number; y: number }[] = [];
let last = performance.now();

function frame(now: number) {
  const dt = (now - last) / 1000;
  last = now;

  if (Math.random() < 0.02) {
    orbs.push({ x: Math.random() * 800, y: Math.random() * 600 });
  }

  player.x += player.vx * dt;
  ctx.clearRect(0, 0, 800, 600);
  for (const orb of orbs) {
    if (Math.hypot(orb.x - player.x, orb.y - player.y) < 28) score++;
    ctx.fillRect(orb.x, orb.y, 8, 8); // çizim ile kural aynı döngüde
  }
  requestAnimationFrame(frame);
}
```

Bu kodu test etmeye kalkışın. Nereden tutacaksınız?

`frame` fonksiyonunu çağıramazsınız, çünkü `ctx` yoksa ilk satırda patlar. Skoru sabitleyemezsiniz, çünkü `Math.random` her koşuda başka bir sahne kurar. Zamanı ilerletemezsiniz, çünkü `dt`'yi tarayıcının duvar saati belirliyor. Üstelik hiçbir şeyi `import` edemezsiniz; dosyanın en üst satırı çalışır çalışmaz `document`'a uzanıyor.

Üç bağımlılık, üç ayrı delik: **canvas**, rastgelelik, zaman. Ve üçü de aynı biçimde davranıyor: kodun içinden dışarıya, sizin kontrolünüz olmayan bir yere uzanıyorlar. Test yazamamanızın sebebi vitest'in yetersizliği değil. Sebep, odanın duvarlarında üç delik olması.

Peki bunu nasıl kapatırız?

### Birinci Kesme: Simülasyon vs Render

İlk kesik en büyüğü ve tek başına işin yarısını bitiriyor: oyunun *ne olduğunu* hesaplayan kod ile *nasıl göründüğünü* çizen kod ayrı dosyalarda yaşayacak.

Kural tek cümle: simülasyon dosyası hiçbir çizim çağrısı yapmaz, render dosyası hiçbir karar vermez.

Bu yazı için küçük ama tam bir oyun yazdım: **Orb Collector**. 800×600'lük bir kutuda ivmeyle hareket eden bir top, düzenli aralıklarla rastgele yerlerde beliren orb'lar, değince artan skor. Beş dakikada anlaşılır, ama içinde bir oyunun bütün zorlukları var: girdi, fizik, rastgele doğum, çarpışma, skor.

Önce durumun şekli. Sim'in bildiği her şey bu tipte:

```ts
// src/sim.ts
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
```

Dikkat edin: içinde ne renk var, ne sprite, ne canvas ölçüsü. Odanın içinde görsel diye bir kavram yok.

Ayarlar da aynı dosyada, sabit olarak duruyor:

```ts
// src/sim.ts (devamı)
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
```

Şimdi odanın kalbi. `step` fonksiyonu tek bir tick'i ilerletir: girdiyi alır, hızı günceller, duvarlara çarptırır, temas eden orb'ları toplar, zamanı gelmişse yenisini doğurur. Ve **yeni** bir `State` döndürür; kendisine verileni değiştirmez.

```ts
// src/sim.ts (devamı) — dosyanın tek import'u ve step fonksiyonu
import type { Rng } from "./rng";

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
```

Bu fonksiyonun tek bir satırı bile dışarıya uzanmıyor. `import` listesinde sadece bir tip var. Node'da, worker'da, sunucuda, testte, hepsinde aynı şekilde koşar.

Peki bu neyi mümkün kıldı? Şunu: oyunu oynamak için artık tarayıcıya ihtiyacım yok. Bir döngü yeter.

```ts
// src/sim.ts (devamı)
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
```

`runTicks`, bu yazının en sessiz ama en önemli fonksiyonu. Oyunu bir dizi saf çağrıya indirdiği anda test yazmak, kütüphane test etmek kadar sıradanlaşıyor.

Geriye bir "oyuncu" kalıyor. Testlerde tuş dizilerini elle yazmak yerine duruma bakıp karar veren saf bir bot kullanıyorum; kendisi de aynı odanın içinde yaşıyor:

```ts
// src/sim.ts (devamı)
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
```

`DEADZONE` küçük bir ayrıntı gibi duruyor ama olmazsa bot hedefin üstünde titreşir ve golden hash'in anlamı kalmaz.

Bu kesme seride yeni değil. OffscreenCanvas yazısında simülasyonu bir Web Worker'a taşıyabilmemizin tek sebebi buydu: worker'da `document` yok, ama sim zaten `document` bilmiyordu, o yüzden taşınırken tek satırı değişmedi. Authoritative sunucu yazısındaki `Room` çekirdeği de aynı sebeple 16 testle doğrulandı: hiç port açmadan, hiç WebSocket kurmadan. Saflık taşınabilirlik demek; taşınabilirlik de test edilebilirlik.

### İkinci Kesme: Rastgeleliği Tohumla

İkinci delik daha sinsi, çünkü kod çalışıyor gibi görünüyor. `Math.random()` bir hata vermez; sadece her koşuda başka bir dünya kurar.

Rastgeleliği oyundan atmıyoruz. Sadece kaynağını dışarıdan veriyoruz. Odaya zar giremez, zarı kapıdan biz uzatırız.

Seride bu iş için hep aynı üreteci kullandık, burada da onu kullanıyorum. mulberry32, on satırlık, hızlı, tohumlu bir PRNG (pseudo-random number generator, sözde rastgele sayı üreteci):

```ts
// src/rng.ts
/** 0..1 arası sayı üreten deterministik kaynak. */
export type Rng = () => number;

/** mulberry32: küçük, hızlı, tohumlu PRNG. Aynı tohum → aynı dizi. */
export function mulberry32(seed: number): Rng {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

Broad-phase yazısında 20.000 nesnelik sahneyi bununla kurmuştuk, çünkü ızgara ile brute-force'un *aynı* çift kümesini döndürdüğünü kanıtlamak için iki tarafın da aynı sahneyi görmesi gerekiyordu. Object pool yazısında da aynı üreteç vardı. Aynı alet, üçüncü kez sahnede.

Kritik detay tohumun kendisi değil, `step`'in imzası. `rng` bir parametre. Sim, üreteci nereden geldiğini bilmiyor; sadece çağırıyor. Testte tohumu 12345 veririz, bir sonraki testte 999, üçüncüsünde bug'ı üreten tohumu.

Burada küçük bir dürüstlük notu düşeyim. `mulberry32` bir closure ve içinde `s` değişkeni mutasyona uğruyor; `step` kelimenin kitabî anlamıyla saf (pure) değil, verilen rng'nin durumunu ilerletiyor. Tam saflık isteyen bir varyant mümkün: tohumu `State`'in içinde taşıyıp `[değer, yeniTohum]` döndüren bir `nextFloat`. Denedim, çalışıyor ama her rastgele çağrısında state'i elden ele dolaştırmak `step`'i epey çirkinleştiriyor. Determinizm garantisi ikisinde de aynı olduğu için ben okunabilir olanı seçtim. Bir netcode projesinde, rollback sırasında RNG'yi de geri sarman gerekiyorsa, tohumu state'e koymak daha doğru olur.

### Üçüncü Kesme: Zamanı Enjekte Et

Üçüncü delik zaman. `performance.now()` çağıran her satır, testin kontrol edemediği bir kaynağa bağlıdır. Testte "3 saniye geçti" diyebilmek için gerçekten 3 saniye beklemek zorunda kalıyorsanız, bir yerlerde yanlış bir bağımlılık vardır.

Çözüm arayüzü tek metotluk:

```ts
// src/clock.ts
import type { Rng } from "./rng";
import { step, type InputScript, type State } from "./sim";

/** Zamanın tek kapısı. Üretimde duvar saati, testte sahte saat. */
export interface Clock {
  now(): number; // milisaniye
}

export const systemClock: Clock = {
  now: () => performance.now(),
};

export interface FakeClock extends Clock {
  advance(ms: number): void;
}

/** Elle ilerletilen saat: test zamanı kendi eliyle yazar. */
export function makeFakeClock(start = 0): FakeClock {
  let t = start;
  return {
    now: () => t,
    advance(ms: number) {
      t += ms;
    },
  };
}
```

Client prediction yazısında bu numara ile ağ gecikmesini ölçmüştük: sahte saatle 100 ms "bekleyip" reconciliation'ın doğru kareye sardığını doğrulamak, gerçek 100 ms beklemekten hem hızlı hem güvenilirdi.

Şimdi saati döngüye takalım. Sabit adımlı döngüyü #5'te ayrıntısıyla kurmuştuk; buradaki tek fark, `performance.now()` yerine enjekte edilen `Clock`'u çağırması:

```ts
// src/clock.ts (devamı)
export const STEP = 1 / 60; // sabit fizik adımı (saniye)
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
   * Bir kare ilerlet: geçen gerçek zaman kadar 0..MAX_STEPS tık atar.
   * Girdi HER TIK'ta ayrı okunur — kare başına bir kez değil.
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
```

Bu sınıfın `requestAnimationFrame` diye bir şeyden haberi yok. rAF'ı `main.ts` çağırır, döngüye sadece "bir kare geçti" der. Odanın duvarında bir kapak daha kapandı.

Şu `tick(poll)` imzasında ise bir yara izi var. İlk yazdığımda `tick(input: Input)` idi: girdiyi kare başına bir kez alıp o karedeki bütün tick'lere aynı girdiyi veriyordum. Testler yeşildi. Sonra test "oyuncusunu" en yakın orb'a koşan bir bota çevirdim ve 15 FPS senaryosu 60 FPS'ten ayrıştı. Yarım saat fizikte hata aradım, hata fizikte değildi: bot girdisini state'e bakarak üretiyor, 15 FPS'te ise bir karede dört tick atılıyor ve bot dört tick boyunca *eski* duruma göre karar veriyordu. Girdiyi her tick'te ayrı sormak sorunu kapattı. Determinizm, adım büyüklüğünün sabit olmasıyla bitmiyor; girdi dizisinin de tick başına aynı olması gerekiyor.

### State Hash: Tek Sayıyla Eşitlik

Üç kesik tamam, oda kapandı. Şimdi test yazma sırası. Ve hemen pratik bir sorun çıkıyor.

600 tick sonrası iki dünyanın aynı olduğunu nasıl assert edeceğiz? `toEqual` ile bütün nesneyi karşılaştırabiliriz, çalışır da. Ama 12 orb'lu bir state bile göz için okunmaz bir çıktı üretir; hata mesajında hangi alanın kaydığını aramak eziyet olur. Bir de golden test (altın test) derdi var: "bu senaryo doğru sonucu veriyor" iddiasını kaynağa yazmak istiyorsanız, koca bir JSON'u teste gömmek istemezsiniz.

Bütün durumu tek bir sayıya indirelim. FNV-1a, bunun için gereğinden fazla iyi bir hash:

```ts
// src/hash.ts
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
```

O `x + 0` satırı üç dakikamı yedi. JavaScript'te `-0` ile `0` eşit sayılır (`-0 === 0` doğrudur) ama bit desenleri farklıdır ve hash'leri de farklı çıkar. Duvara çarpınca hızı sıfırlayan kodum bazen `-0` üretiyordu ve iki özdeş dünya farklı hash veriyordu. `x + 0` ifadesi `-0`'ı sessizce `+0` yapar. Bu tür şeyleri kimse ilk denemede bilmiyor; ben de bilmiyordum.

Float'ları yuvarlamak yerine bit bit hash'lediğime dikkat edin. Alternatifi `Math.round(x * 1000)` gibi bir kuantalama olurdu; kayan nokta gürültüsüne dayanıklı olurdu ama minik bir ıraksamayı da gizlerdi. Tek makinede determinizm kanıtlıyorsanız bitleri hash'leyin, sert olsun. Farklı CPU mimarileri arasında karşılaştırma yapacaksanız kuantalama daha gerçekçi bir seçim.

Artık koca bir dünya tek satıra sığıyor:

```ts
// örnek iddia biçimi — testlerde bütün dünya tek satırda karşılaştırılıyor
expect(hashState(a)).toBe(hashState(b));
```

### Headless Gerçek: vitest'te Canvas Yok

Şimdi kanıt kısmı. Ama önce dürüst bir sınır çizelim, çünkü bu seride bu sınır testlerin şeklini gerçekten belirledi.

vitest varsayılan olarak Node'da koşar. Node'da `document` yoktur, `HTMLCanvasElement` yoktur, `CanvasRenderingContext2D` yoktur, WebGL yoktur, WebGPU hiç yoktur. jsdom ortamına geçerseniz `document` gelir ama `canvas.getContext("2d")` yine `null` döner; gerçek bir 2D rasterizer için `node-canvas` gibi native bir bağımlılık kurmanız gerekir, WebGL için ayrı bir mesele, WebGPU için pratikte hiç.

Yani headless testte şunları test edemezsiniz: pikseller, shader çıktısı, çizim sırası, GPU davranışı, gerçek bir Worker'ın mesajlaşma zamanlaması.

Ama şunları çok rahat test edersiniz: fizik, çarpışma, skor, spawn kuralları, hasar, envanter, AI kararları, netcode reconciliation, kısacası oyunun *kuralları*. Ve dürüst olalım: bir oyunda bug'ların ezici çoğunluğu kurallarda çıkar, çizimde değil. SAT çarpışma yazısındaki 23 test tamamen saf geometriydi; hiçbiri canvas'a ihtiyaç duymadı ve hepsi gerçek bug yakaladı.

Testlerin ilk bölümü, üç kesmenin de tuttuğunu doğrudan iddia ediyor:

```ts
// test/sim.test.ts — projedeki TEK test dosyası (10 test)
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
```

Üçüncü test bir regresyon kilididir. `step` içindeki herhangi bir sayıyı, herhangi bir sıralamayı, herhangi bir formülü değiştirirseniz o hex sayı değişir ve test kırmızıya döner. Kasıtlı değişikliklerde yeni hash'i elle güncellersiniz; kasıtsızlarda ise testler size "bir şey oynattın" der. Bu, 200 satırlık bir davranış sözleşmesini tek satıra sığdırmanın en ucuz yolu.

Sırada sahte saatle sabit adım determinizmi var. #5'te aynı toplam süreyi 60/15/30 FPS'e bölüp fiziğin birebir aynı çıktığını göstermiştik; şimdi aynı iddiayı bütün oyun için, hash üzerinden kuruyoruz:

```ts
// test/sim.test.ts (devamı)
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
```

`clock.advance(1000 / fps)` satırı bu testin bütün numarası. Gerçekte 30 saniye geçmiyor (üç senaryo × 10 saniye); sahte saatin ibresini biz çeviriyoruz ve test 1.6 milisaniyede bitiyor.

Şimdi en sevdiğim kısım: mimari kuralın kendisini test etmek. Yorumda yazan kural, kural değildir; CI'da kırılan kural, kuraldır.

```ts
// test/sim.test.ts (devamı)
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
```

Birinci test tuzağı kuruyor: `Math.random` çağrılırsa fırlatıyor. Altı ay sonra biri `step` içine bir "ufak" `Math.random()` koyduğunda bu test onu yakalar. İkincisi aynı numarayı `document` ve `window` için Proxy ile yapıyor; sim herhangi bir global DOM alanına *bakarsa* bile patlar. Dördüncüsü ise saflığın öteki yarısını koruyor: `step` kendisine verilen state'i değiştirmiyor, çünkü değiştirseydi başlangıç state'inin hash'i 120 tick sonra farklı çıkardı.

Son grup sıradan oyun kuralları. Test edilebilir mimarinin asıl karşılığı burada görünüyor: bunlar artık özel bir şey değil, sıradan unit test.

```ts
// test/sim.test.ts (devamı)
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
```

Onuncu test bir korunum yasası (invariant): doğan her orb ya sahadadır ya da toplanmıştır, üçüncü bir ihtimal yok. Bu tür testleri seviyorum çünkü beklenen değeri elle hesaplamanız gerekmez; kural kendini söyler. Otuz saniyelik simülasyon, tek satırlık iddia.

On testin tamamı bende 9 milisaniyede koşuyor. Hiçbiri tarayıcı açmıyor.

Bir de determinizmin tek koşuda değil, tekrar tekrar tuttuğunu görmek istedim; `npm run bench` aynı tohumlu 600 tick'lik simülasyonu 200 kez koşturup hem hash kümesinin tekliğini hem de tick maliyetini raporluyor:

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

120.000 tick 6.6 milisaniye. Tick başına 45 nanosaniye, yani 16.7 ms'lik bir kare bütçesine üç yüz yetmiş bin tick sığıyor. Saf tutmanın bedelini "her tick'te yeni nesne" diye ödediğimizi birazdan konuşacağız; ama bu ölçekte o bedel, gürültünün altında kalıyor. Asıl kazanç şu satırda: 200 koşu, tek hash.

### Tarayıcıya Kalan Kısım

Peki oda kapandı da dışarısı ne oldu? Render tarafı, kelimenin tam anlamıyla, geriye kalan her şey:

```ts
// src/render.ts
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
```

Bu dosyanın testi yok ve olmasını da istemiyorum. Testi göz. Renk yanlışsa görürsünüz, sprite ters dönmüşse görürsünüz; katman sırasının bozulduğunu anlamak için de assert değil, bir bakış yetiyor. Buna karşılık "orb doğru anda mı doğdu" sorusunu gözle kontrol etmek imkânsızdır, o yüzden o soru odanın içinde kaldı.

İkisini birleştiren yer ise `main.ts`, yani oyunun tarayıcıya bakan tek yüzü:

```ts
// src/main.ts
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

// Klavye → Input. Tarayıcıya ait tek mantık burada, sim bunu bilmez.
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
  hud.textContent = `tohum ${SEED} • skor ${loop.curr.score} • tick ${loop.curr.tick} • hash ${hashHex(loop.curr)}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

HUD'a hash'i basmam küçük bir gösteriş değil. Demoyu iki tarayıcıda açıp aynı tuşlara aynı sırayla basarsanız, aynı tick'te aynı hex sayıyı görmeniz gerekir. Testin tarayıcıdaki karşılığı bu; determinizmi çıplak gözle kontrol etmenin en kestirme yolu.

Görsel doğrulamayı disipline sokmanın bir yolu daha var, ki serinin bir sonraki durağı orası: girdi kaydı ve replay. Girdi dizisini tick numaralarıyla kaydedip sonra aynen geri oynatabiliyorsanız, "şu bug'ı tekrar üret" cümlesi bir dosya alışverişine dönüşür. Odamız zaten deterministik olduğu için o özelliğin bedeli neredeyse sıfır: kaydedilecek şey sadece tohum ve girdiler.

Demo Vite ile çalışıyor; `npm run dev` deyip tarayıcıda açmanız yeterli, arka planda sunucu süreci yok. `file://` ile açarsanız modüller yüklenmez ve boş ekran görürsünüz — bunu ben yeterince kez yaşadım, siz yaşamayın.

### Test Edilebilir Mimarinin Bedeli

Şimdi yazının en az sevilen ama en dürüst kısmı. Bu mimari bedava değil.

Bir kere daha fazla dosya var. Tek `game.ts` yerine sim, rng, clock, hash, render, main dosyaları var; küçük bir oyunda bu, koda bakan birine gereksiz tören gibi görünebilir. İkincisi dolaylılık maliyeti: `performance.now()` yazacağınız yerde `this.clock.now()` yazıyorsunuz, `Math.random()` yerine parametre taşıyorsunuz. Üçüncüsü, `step`'in her tick'te yeni nesne döndürmesi çöp (garbage) üretiyor; object pool yazısında tam da bundan kaçınmak için uğraşmıştık. Binlerce nesneli bir simülasyonda saflığı mutasyonla değiş tokuş etmek gerekebilir; o zaman da "aynı state buffer'ı iki kopyada tut, aralarında takas et" gibi bir orta yol kurarsınız.

Ne zaman abartıdır? Game jam'de üç günde bitecek bir prototipte kesinlikle abartıdır; orada tek dosyada `Math.random` çağırıp geçin, kimse ölmez. Tek kişilik, kuralları basit, skoru olmayan bir sanat projesinde de gerek yok.

Ne zaman şarttır? Multiplayer'da tartışmasız, çünkü iki makinenin aynı sonucu üretmesi zaten oyunun temel şartı. Sonradan replay ya da kayıt özelliği isteyeceğiniz her oyunda öyle. Ekonomi, envanter, ilerleme sistemi gibi "yanlış hesaplarsa oyuncu kızar" alanlarında da. Bir de kimsenin baştan hesaba katmadığı sinsi bir kriter var: oyun altı aydan uzun yaşayacaksa.

Benim gözlemim şu: bu mimarinin maliyeti günlerle ölçülüyor, faydası aylarla. İlk hafta canınızı sıkar. Üçüncü ayda canınızın niye sıkıldığını hatırlamazsınız.

### Özetle:

1. Oyun kodunu test edilemez yapan üç bağımlılık var: canvas, global rastgelelik ve duvar saati. Üçü de kodun içinden dışarıya uzanır.
2. Birinci kesme, simülasyonu render'dan ayırmak: `step(state, input, dt, rng)` saf bir fonksiyon olur, render sadece çizer. Bu ayrım aynı zamanda kodu worker'a ve sunucuya taşınabilir kılar.
3. İkinci kesme, rastgeleliği tohumlamak: `mulberry32(seed)` ile üreteci dışarıdan enjekte edin; `Math.random` sim'in içinde asla geçmesin.
4. Üçüncü kesme, zamanı enjekte etmek: tek metotlu bir `Clock` arayüzü, üretimde `performance.now`, testte elle ilerletilen sahte saat.
5. `hashState` ile bütün durumu tek 32-bit sayıya indirin; golden hash testi 200 satırlık davranış sözleşmesini tek `expect`'e sığdırır. `-0` tuzağına dikkat.
6. Sabit adım determinizmi girdi diziliminden de etkilenir: girdiyi kare başına değil, tick başına örnekleyin.
7. Mimari kuralı yorumla değil testle koruyun: `Math.random`'a ve `document`'a tuzak kurun, sim onlara dokunursa test kırılsın.
8. Headless vitest'te canvas, WebGL, WebGPU ve gerçek Worker yok. Kuralları test edin, pikselleri tarayıcıya bırakın.
9. Bedeli gerçek: daha çok dosya, biraz dolaylılık, saflık yüzünden çöp üretimi. Prototipte abartı, uzun ömürlü ve çok oyunculu projelerde şart.

Altı kaynak dosya, bir bench, bir demo ve on test repoda: `npm test` on testi 9 milisaniyede bitiriyor, `npm run bench` 200 koşuda tek hash raporluyor, `npm run dev` demoyu açıyor.

Açılıştaki arkadaşıma verecek doğru cevabı epey geç buldum. Ona anlatmam gereken şey vitest değilmiş; "neyi assert edeceğim" sorusunun cevabı test kütüphanesinde değil, dosya sınırlarında duruyor. Bu seride hiçbir zaman "şimdi teste başlayalım" diye bir an olmadı, çünkü kodu ilk gün odaya kapatmıştık. Test yazmak bir aşama değil, bir sonuç. Mimariyi düzeltmediğiniz gün ise dünyanın en iyi test kütüphanesi bile size daha zarif bir çaresizlikten fazlasını veremiyor.

Odanın kapısını kapatın; içeride ne olup bittiğini kanıtlamak sıradan bir işe dönüşür. 🔬
