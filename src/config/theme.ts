/**
 * Design-Tokens — abgeleitet aus `docs/02-ART-DIRECTION.md`.
 * Einzige Quelle fuer Farben, Motion und Typo-Skala im TS-Code.
 * Das CSS-Pendant liegt in `src/styles/tokens.css` und muss synchron bleiben
 * (`tests/unit/config.test.ts` prueft das automatisch).
 */

/* ------------------------------------------------------------------ */
/* Spielerfarben (Art Direction §2 / GDD §3.1) — identisch zu Drinkshot */
/* ------------------------------------------------------------------ */

export const PLAYER_COLORS = [
  { id: 'red', hex: 0xff4757, shade: 0xc0392b, symbol: 'circle', nickname: 'Rudi' },
  { id: 'blue', hex: 0x3b82f6, shade: 0x1e5bb8, symbol: 'triangle', nickname: 'Blue' },
  { id: 'green', hex: 0x2ed573, shade: 0x1e9e52, symbol: 'square', nickname: 'Gustav' },
  { id: 'yellow', hex: 0xffd32a, shade: 0xd4a800, symbol: 'star', nickname: 'Yoshi' },
  { id: 'purple', hex: 0xaf73ee, shade: 0x7b3fbf, symbol: 'diamond', nickname: 'Lilo' },
  { id: 'orange', hex: 0xff7f50, shade: 0xcc5a2e, symbol: 'heart', nickname: 'Olli' },
  { id: 'pink', hex: 0xff6b9d, shade: 0xc94a78, symbol: 'bolt', nickname: 'Pinky' },
  { id: 'cyan', hex: 0x18dcff, shade: 0x0fa6c2, symbol: 'cross', nickname: 'Turbo' },
] as const;

export type ColorId = (typeof PLAYER_COLORS)[number]['id'];
export type SymbolId = (typeof PLAYER_COLORS)[number]['symbol'];

export const COLOR_IDS = PLAYER_COLORS.map((c) => c.id) as readonly ColorId[];

const COLOR_BY_ID = new Map<ColorId, (typeof PLAYER_COLORS)[number]>(PLAYER_COLORS.map((c) => [c.id, c]));

export function colorById(id: ColorId): (typeof PLAYER_COLORS)[number] {
  const found = COLOR_BY_ID.get(id);
  if (!found) throw new Error(`Unbekannte ColorId: ${id}`);
  return found;
}

/** Auf Gelb, Cyan und Gruen steht `ink`, sonst `paper` (Kontrastregel Art Direction §2). */
const DARK_TEXT_COLORS: readonly ColorId[] = ['yellow', 'cyan', 'green'];

export function textColorOn(id: ColorId): number {
  return DARK_TEXT_COLORS.includes(id) ? UI_COLORS.ink : UI_COLORS.paper;
}

/* ------------------------------------------------------------------ */
/* UI-Farben (Art Direction §2)                                        */
/* ------------------------------------------------------------------ */

export const UI_COLORS = {
  /** Tiefer als Drinkshot — der Tresorraum ist nachts. */
  bgDeep: 0x0b0a14,
  bgPanel: 0x1a1830,
  bgPanelRaised: 0x262345,
  paper: 0xfff8e7,
  ink: 0x1a1024,

  /** Primary CTA, Muenzen, Tresor-Glanz, Jackpot. */
  gold: 0xffc93c,
  goldShade: 0xc9961a,

  /** Tresorkoerper und Zahlenrad. */
  steel: 0x8c93a8,
  steelDark: 0x4a506a,

  /** Tischdecke im Tresorraum. */
  velvet: 0x5b1e3a,
  velvetLight: 0x7a2a50,

  /** TEILEN-Karte, "Ehre"-Banner. */
  share: 0x2ed573,
  shareShade: 0x1e9e52,

  /** STEHLEN-Karte, Alarm, Meineid. */
  steal: 0xff2d55,
  stealShade: 0xb8163a,

  /** Laser-Deko im Ruhezustand — wechselt bei Alarm auf `steal`. */
  laser: 0x18dcff,

  /** Spotlight-Kegel. */
  spot: 0xfff1c4,
} as const;

/** Alpha des Spotlight-Kegels (Art Direction §2). */
export const SPOT_ALPHA = 0.18;

/** Laser-Linien im Ruhezustand (Art Direction §6). */
export const LASER = {
  alpha: 0.35,
  /** Alle 3 s wandern die Linien auf neue Positionen. */
  moveIntervalMs: 3000,
} as const;

/** Alarm-Modus: der Raum flackert rot (Art Direction §6). */
export const ALARM = {
  overlayAlpha: 0.25,
  pulses: 3,
} as const;

/* ------------------------------------------------------------------ */
/* Typografie (Art Direction §3)                                       */
/* ------------------------------------------------------------------ */

export const FONTS = {
  display: '"Luckiest Guy", "Comic Sans MS", system-ui, sans-serif',
  body: '"Nunito", system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;

/** Groessen-Skala in px (root 16). */
export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  '2xl': 40,
  hero: 64,
  mega: 96,
} as const;

/** Sticker-Look: Outline-Stroke + Drop-Shadow fuer Display-Zahlen. */
export const STICKER = {
  strokeWidthPx: 4,
  strokeColor: UI_COLORS.ink,
  shadowOffsetYPx: 4,
  shadowColor: UI_COLORS.ink,
} as const;

/** Split-Flap-Zaehler unter dem Tresor (Art Direction §3). */
export const FLIP_COUNTER = {
  flapMs: 120,
  ease: 'back.out(2)',
} as const;

/* ------------------------------------------------------------------ */
/* Motion (Art Direction §7 + Drinkshot §9)                            */
/* ------------------------------------------------------------------ */

export const MOTION = {
  fast: 120, // Tap-Feedback
  base: 260, // Screen-Elemente
  slow: 420, // Wipes, grosse Panels
  easeOvershoot: 'back.out(2.5)',
  easeSnappy: 'power3.inOut',
  easeDrop: 'bounce.out',
  easeElastic: 'elastic.out(1, 0.4)',
  wipeMs: 320,
  sheetMs: 260,
  sheetEase: 'cubic-bezier(.2,.9,.3,1.2)',
  countUpMs: 620,
  staggerMs: 70,
} as const;

/** Alias fuer die DOM-Helfer in `ui/animate.ts` — dieselben Werte, sprechender Name. */
export const UI_TIMING = MOTION;

/* ------------------------------------------------------------------ */
/* Animations-Konstanten der Inszenierungen (Art Direction §7)         */
/* ------------------------------------------------------------------ */

export const ANIM: {
  hitStopMs: number;
  squashScaleX: number;
  squashScaleY: number;
  squashMs: number;
  followThroughMs: readonly [number, number];
  shakeMs: number;
  shakeAmplitudePx: number;
  outcomeMinMs: number;
  outcomeMaxMs: number;
} = {
  hitStopMs: 80,
  squashScaleX: 1.3,
  squashScaleY: 0.7,
  squashMs: 60,
  followThroughMs: [100, 150] as const,
  shakeMs: 250,
  shakeAmplitudePx: 12,
  /** Erlaubte Dauer einer OutcomeSequence (Architektur §7, Audit A4). */
  outcomeMinMs: 2000,
  outcomeMaxMs: 8000,
} as const;

/* ------------------------------------------------------------------ */
/* Partikel-Budget (Art Direction §8)                                  */
/* ------------------------------------------------------------------ */

export const PARTICLE_BUDGET = {
  coinRain: { max: 60, lifeMs: 1800 },
  confetti: { max: 100, lifeMs: 2500 },
  vaultSmoke: { max: 8, lifeMs: 700 },
  stars: { max: 8, lifeMs: 900 },
  sealShards: { max: 3, lifeMs: 1200 },
  tireSmoke: { max: 10, lifeMs: 600 },
  /** Harte Obergrenze aktiver Sprites auf der Buehne. */
  maxActiveSprites: 200 as number,
} as const;

/* ------------------------------------------------------------------ */
/* Buehne / Rendering (Architektur §9)                                 */
/* ------------------------------------------------------------------ */

export const STAGE = {
  /** Logische Weltgroesse, aufloesungsunabhaengig. */
  worldSize: 1000,
  /** Radius des Karten-Halbkreises auf dem Samttisch (fix, Art Direction §6). */
  arcRadius: 400,
  /** Karten werden bei 7-8 Spielern kleiner, der Halbkreis bleibt gleich gross. */
  cardScale: { default: 1, crowded: 0.8 },
  crowdedFrom: 7,
  /** Kamera faehrt auf die aktive Karte. */
  cardZoom: 1.15 as number,
  panMs: 400,
  /** Crook-Hoehe in Welteinheiten, abhaengig von der Spielerzahl. */
  crookHeight: { min: 170, max: 220 } as const,
  headRatio: 0.45,
  blinkIntervalMs: [2000, 5000] as const,
  blinkDurationMs: 120,
} as const;

export const RENDER = {
  maxResolution: 2,
  antialias: false,
  powerPreference: 'high-performance',
  /** Low-Effects-Auto-Detect-Schwellen (Architektur §9). */
  lowEffects: {
    deviceMemoryMax: 3,
    hardwareConcurrencyMax: 4,
    frameMedianMaxMs: 22,
    probeDurationMs: 2000,
  },
  /** Frame-Budget auf dem Referenzgeraet. */
  budgetMs: { update: 4, render: 8 },
  /**
   * Wie oft der Vorlauf sein Wegwerf-Objekt rendert, bevor die Aufdeckung kommt
   * (ADR-41). Der erste Frame legt den WebGL-Kontext an und uebersetzt die Shader, der
   * zweite laeuft bereits durch die aufgewaermten Pipelines — und belegt damit, dass
   * genau das passiert ist.
   */
  warmupFrames: 2,
} as const;

/* ------------------------------------------------------------------ */
/* Crook-Ausstattung (Art Direction §5)                                */
/* ------------------------------------------------------------------ */

/** Huete aus Drinkshot plus die Beanie des Ganoven. */
export const HAT_IDS = ['none', 'cap', 'party', 'tophat', 'helmet', 'crown', 'beanie'] as const;
export type HatId = (typeof HAT_IDS)[number];

export const HAT_CHANCE = 0.6;

/** Anteil der Crooks im Ringelshirt (Art Direction §5). */
export const STRIPES_CHANCE = 0.5;

/** Gesichter: die aus Drinkshot plus die vier neuen des Tresors (Art Direction §5). */
export const FACE_IDS = [
  'neutral',
  'blink',
  'happy',
  'ouch',
  'x_eyes',
  'wave',
  'smug',
  'jaw_drop',
  'guilty',
  'innocent',
] as const;
export type FaceId = (typeof FACE_IDS)[number];

/**
 * Crook-Hoehe fuer eine Spielerzahl. Zwischen 3 und 8 Spielern linear interpoliert,
 * damit der Halbkreis nie zugestopft wirkt und kleine Runden gross aussehen.
 */
export function crookHeightFor(playerCount: number): number {
  const clamped = Math.min(8, Math.max(3, playerCount));
  const t = (clamped - 3) / 5;
  return STAGE.crookHeight.max + (STAGE.crookHeight.min - STAGE.crookHeight.max) * t;
}

/** Karten-Scale fuer eine Spielerzahl (Art Direction §6). */
export function cardScaleFor(playerCount: number): number {
  return playerCount >= STAGE.crowdedFrom ? STAGE.cardScale.crowded : STAGE.cardScale.default;
}

/** Hex-Zahl -> CSS-Farbstring. */
export function hex(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}
