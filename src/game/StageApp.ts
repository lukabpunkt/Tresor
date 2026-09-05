/**
 * PIXI-Lifecycle (Architektur §9).
 *
 * **Ein** `Application`-Objekt fuer die gesamte Session: Es entsteht beim ersten Betreten
 * der Aufdeckung und wird danach wiederverwendet. Zwischen den Runden wird nur die Buehne
 * geleert, nie die App.
 *
 * Eine Uhr: Der PIXI-Ticker treibt GSAP (CLAUDE.md). Zwei RAF-Schleifen nebeneinander
 * wuerden bei Slow-Mo und Hit-Stop auseinanderlaufen — und genau davon lebt die letzte
 * Karte.
 */

import { Application, Assets, Container, Graphics, Sprite, type Spritesheet } from 'pixi.js';
/*
 * PIXI erzeugt Shader- und Uniform-Code per `new Function`. Unsere CSP verbietet
 * `unsafe-eval` (Architektur §9), deshalb der eval-freie Pfad — ohne ihn stirbt die
 * Buehne beim ersten Render mit "Current environment does not allow unsafe-eval".
 */
import 'pixi.js/unsafe-eval';
import gsap from 'gsap';
import { RENDER, STAGE } from '@/config/theme';

/**
 * Die drei Atlanten sind nach **Zeichenreihenfolge** geschnitten, nicht nach Thema
 * (ADR-14): hinter den Crooks, die Crooks, vor den Crooks. Genau drei Texturwechsel
 * pro Frame — und damit drei Draw-Calls (Audit A2).
 */
export interface StageAssets {
  /** Wand, Tisch, Laser, Tresor, Herr Kassel. */
  back: Spritesheet;
  /** Die Figuren. */
  crooks: Spritesheet;
  /** Karten, Requisiten und das Licht (Spotlight, Vignette). */
  front: Spritesheet;
}

const ATLASES = ['back', 'crooks', 'front'] as const;

/** Welche Aufloesung des Atlas passt zum Geraet? */
function atlasSuffix(): '@1x' | '@2x' {
  return (globalThis.devicePixelRatio ?? 1) > 1.25 ? '@2x' : '@1x';
}

function atlasUrl(name: string): string {
  return `${import.meta.env.BASE_URL}atlas/${name}${atlasSuffix()}.json`;
}

let assetsPromise: Promise<StageAssets> | undefined;
let assetsReady = false;

/**
 * Laedt alle Atlanten. Mehrfachaufrufe teilen sich dieselbe Promise, damit der Preload
 * waehrend der Verhandlung und das spaetere Betreten der Buehne nicht doppelt laden.
 */
export function loadStageAssets(): Promise<StageAssets> {
  assetsPromise ??= (async () => {
    const sheets = await Promise.all(ATLASES.map((name) => Assets.load<Spritesheet>(atlasUrl(name))));
    assetsReady = true;
    return Object.fromEntries(ATLASES.map((name, index) => [name, sheets[index]!])) as unknown as StageAssets;
  })().catch((error: unknown) => {
    // Netz weg waehrend des Vorlaufs: Beim Betreten der Buehne wird neu geladen.
    assetsPromise = undefined;
    throw error;
  });
  return assetsPromise;
}

/** True, sobald alle Atlanten im Speicher liegen. */
export function areStageAssetsReady(): boolean {
  return assetsReady;
}

export interface StageLayout {
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StageAppHandle {
  readonly app: Application;
  /** Alles Sichtbare haengt hier drin; gerechnet wird in Welteinheiten (1000 × 1000). */
  readonly world: Container;
  /** Bildschirmraum ueber der Welt — Vignette und Alarm-Blitz, unskaliert. */
  readonly overlay: Container;
  readonly layout: StageLayout;
  onLayout(listener: (layout: StageLayout) => void): () => void;
  /** Haengt das Canvas in ein Host-Element und startet den Ticker. */
  attach(host: HTMLElement): void;
  /** Nimmt das Canvas aus dem DOM und pausiert — die App bleibt am Leben. */
  detach(): void;
  /** Leert die Buehne zwischen zwei Runden; App und Pools bleiben bestehen. */
  clearWorld(): void;
  /** Gemessene Frame-Zeiten (Dev-Panel, Low-Effects-Erkennung). */
  frameTimes(): readonly number[];
  /** Echte WebGL-Draw-Calls des letzten Frames (Audit A2: ≤ 3 Batches). */
  drawCalls(): number;
  destroy(): void;
}

let handle: StageAppHandle | undefined;
let pending: Promise<StageAppHandle> | undefined;

/**
 * Erzeugt die App beim ersten Aufruf und gibt danach immer dieselbe Instanz zurueck.
 *
 * Die Sperre liegt auf der **Promise**, nicht auf dem fertigen Handle: `app.init()`
 * dauert auf einem Mittelklasse-Handy rund 280 ms, und in dieser Zeit ruft der Vorlauf
 * waehrend der Verhandlung und die Aufdeckung selbst beide hier herein. Eine Pruefung
 * nur auf `handle` liesse beide durch — zwei WebGL-Kontexte, zwei Ticker, die beide
 * `gsap.updateRoot()` mit ihrer eigenen Zeit fuettern. Genau daran ist der erste Anlauf
 * auf den Vorlauf gestorben (ADR-40 → ADR-41).
 */
export function getStageApp(): Promise<StageAppHandle> {
  if (handle) return Promise.resolve(handle);
  pending ??= createStageApp().catch((error: unknown) => {
    // Kein WebGL, Speicher voll: Der naechste Versuch soll es neu probieren duerfen.
    pending = undefined;
    throw error;
  });
  return pending;
}

async function createStageApp(): Promise<StageAppHandle> {
  const app = new Application();
  await app.init({
    /*
     * **Nicht von selbst loslaufen.** PixiJS startet den Ticker sonst noch in `init()`,
     * und der zeichnet ab da jeden Frame `app.stage` — auch eine Buehne, auf der nichts
     * steht. Solange die App erst beim Aufdecken entstand, war das folgenlos: Zwischen
     * `init()` und dem fertigen Raum lag kein einziger Frame. Seit dem Vorlauf liegt
     * dort die halbe Verhandlung, und das waeren dreissig Sekunden Rendern ins Leere
     * (ADR-41). Gezeichnet wird ab `attach()`.
     */
    autoStart: false,
    backgroundAlpha: 0,
    antialias: RENDER.antialias,
    autoDensity: true,
    resolution: Math.min(globalThis.devicePixelRatio ?? 1, RENDER.maxResolution),
    powerPreference: RENDER.powerPreference,
    preference: 'webgl',
  });

  const world = new Container();
  const overlay = new Container();
  app.stage.addChild(world, overlay);

  const layout: StageLayout = { scale: 1, x: 0, y: 0, width: 1, height: 1 };
  const layoutListeners = new Set<(value: StageLayout) => void>();

  /*
   * --- Eine Uhr: PIXI treibt GSAP ---
   *
   * Uebernommen wird sie erst beim **Anhaengen**, nicht schon beim Bauen der App. Mit
   * dem Vorlauf liegen zwischen beidem zehn Sekunden Verhandlung, und in dieser Zeit
   * stuende GSAPs Wurzel-Zeitleiste still, waehrend die Runde ihre Tweens anlegt —
   * eine angehaltene Uhr, an der schon Termine haengen. Beim ersten Frame holte PixiJS
   * das nach und riss der Show die Container unter den Fuessen weg
   * (`updateRenderable`, ADR-40/41).
   */
  let clockOwned = false;
  const ownClock = (): void => {
    if (clockOwned) return;
    clockOwned = true;
    gsap.ticker.remove(gsap.updateRoot);
  };
  let elapsed = 0;

  /* --- Frame-Zeiten fuer Dev-Panel und Low-Effects-Erkennung --- */
  const SAMPLES = 240;
  const samples = new Float32Array(SAMPLES);
  let sampleIndex = 0;
  let sampleCount = 0;

  /*
   * Draw-Calls ehrlich zaehlen: PIXI legt keinen offiziellen Zaehler offen, also werden
   * `drawElements`/`drawArrays` im WebGL-Kontext umschlossen. Das ist die Zahl, die im
   * A2-Audit zaehlt — nicht eine interne Batch-Liste, die auch mal veraltet sein kann.
   */
  let drawsThisFrame = 0;
  let drawsLastFrame = 0;
  instrumentDrawCalls(app, () => {
    drawsThisFrame++;
  });

  app.ticker.add(
    (ticker) => {
      drawsLastFrame = drawsThisFrame;
      drawsThisFrame = 0;
      elapsed += ticker.deltaMS;
      gsap.updateRoot(elapsed / 1000);
      samples[sampleIndex] = ticker.deltaMS;
      sampleIndex = (sampleIndex + 1) % SAMPLES;
      if (sampleCount < SAMPLES) sampleCount++;
    },
    undefined,
    -100
  );

  let host: HTMLElement | undefined;
  let observer: ResizeObserver | undefined;

  /**
   * Skaliert die Welt auf die **Breite** des Hosts.
   *
   * Das Spiel laeuft im Hochformat: Der Bildschirm ist deutlich hoeher als breit. Wuerde
   * die quadratische Welt komplett hineinpassen (`Math.min`), blieben oben und unten
   * breite leere Baender; wuerde sie die Diagonale fuellen (`Math.max`), waere seitlich
   * nur das mittlere Drittel des Halbkreises zu sehen — die aeusseren Karten laegen
   * ausserhalb des Bildes.
   *
   * Also: Breite exakt fuellen, vertikal zentrieren. Was ueber die Welt hinausragt, ist
   * Wand und Boden — `VaultRoom` zeichnet die bewusst grosszuegig ueber die Weltgrenzen
   * hinaus.
   */
  const relayout = (): void => {
    if (!host) return;
    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;
    app.renderer.resize(width, height);

    const scale = width / STAGE.worldSize;
    const x = 0;
    const y = (height - STAGE.worldSize * scale) / 2;

    world.scale.set(scale);
    world.position.set(x, y);

    layout.scale = scale;
    layout.x = x;
    layout.y = y;
    layout.width = width;
    layout.height = height;

    for (const listener of layoutListeners) listener(layout);
  };

  const onVisibility = (): void => {
    // Im Hintergrund kostet die Buehne nichts (Architektur §9).
    if (document.hidden) {
      app.ticker.stop();
      gsap.globalTimeline.pause();
    } else {
      gsap.globalTimeline.resume();
      app.ticker.start();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  handle = {
    app,
    world,
    overlay,
    layout,

    onLayout(listener) {
      layoutListeners.add(listener);
      listener(layout);
      return () => layoutListeners.delete(listener);
    },

    attach(target) {
      ownClock();
      host = target;
      target.append(app.canvas);
      observer?.disconnect();
      observer = new ResizeObserver(relayout);
      observer.observe(target);
      relayout();
      app.ticker.start();
    },

    detach() {
      observer?.disconnect();
      observer = undefined;
      app.canvas.remove();
      host = undefined;
      app.ticker.stop();
    },

    clearWorld() {
      world.removeChildren();
      overlay.removeChildren();
    },

    frameTimes() {
      return Array.from(samples.slice(0, sampleCount));
    },

    drawCalls() {
      return drawsLastFrame;
    },

    destroy() {
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
      app.destroy(true, { children: true });
      handle = undefined;
      pending = undefined;
    },
  };

  return handle;
}

let warmed = false;

/**
 * Legt den Renderer schon **vor** der Aufdeckung an — der Grund fuer den Ruckler
 * (ADR-40/41).
 *
 * `Application.init()` erzeugt den WebGL-Kontext und uebersetzt die Shader: auf einem
 * Mittelklasse-Handy rund 280 ms in einem einzigen Frame. Waehrend der Verhandlung faellt
 * das niemandem auf — im ersten Moment der Aufdeckung schon, denn dort liegt es genau
 * zwischen "Tresor oeffnen" und der ersten Karte.
 *
 * **Nur ueber `loadStageModules()` aufrufen.** Der Renderer bindet seine Render-Pipes an
 * die Module, die beim Anlegen geladen waren; wer ihn zu frueh baut, bekommt ihn ohne die
 * Pipes der Show. Warum das so ist und was es gekostet hat, steht in `stageModules.ts`.
 *
 * Gewaermt wird an einem **Wegwerf-Objekt**, nicht an `app.stage`: Deren erster
 * gerenderter Frame soll weiterhin der erste Frame der Aufdeckung sein. Darauf liegt je
 * eine Flaeche und ein Sprite aus jedem Atlas — die Flaeche uebersetzt die
 * Graphics-Shader, die Sprites die Batch-Shader, und nebenbei wandern die drei
 * Atlas-Texturen jetzt hier auf die GPU statt beim ersten Kartenflip. Das Canvas haengt
 * dabei nicht im DOM; gezeichnet wird trotzdem, und niemand sieht ein Standbild
 * aufblitzen.
 */
export async function warmStageApp(): Promise<void> {
  if (warmed) return;
  warmed = true;

  let stage: StageAppHandle;
  let assets: StageAssets;
  try {
    // Der Aufrufer hat beides schon angestossen; hier warten wir nur auf dieselbe Promise.
    [stage, assets] = await Promise.all([getStageApp(), loadStageAssets()]);
  } catch (error) {
    warmed = false;
    throw error;
  }

  const probe = new Container();
  probe.addChild(new Graphics().rect(0, 0, 8, 8).fill(0xffffff));
  for (const sheet of [assets.back, assets.crooks, assets.front]) {
    const texture = Object.values(sheet.textures)[0];
    if (texture) probe.addChild(new Sprite(texture));
  }

  try {
    for (let frame = 0; frame < RENDER.warmupFrames; frame++) {
      stage.app.renderer.render({ container: probe });
    }
  } finally {
    // Ohne `texture: true` — die Atlas-Texturen bleiben, sie werden gleich gebraucht.
    probe.destroy({ children: true });
  }
}

/** Aktuelle Welt-Transformation — Testwerkzeuge leiten daraus Bildausschnitte ab. */
export function stageLayout(): StageLayout | undefined {
  return handle?.layout;
}

/** Frame-Zeiten der laufenden Buehne — Testhilfe fuer `perf.spec.ts` (M3). */
export function stageFrameTimes(): readonly number[] {
  return handle?.frameTimes() ?? [];
}

/** Draw-Calls des letzten Frames — Audit A2. */
export function stageDrawCalls(): number {
  return handle?.drawCalls() ?? 0;
}

/** Nur fuer Tests: gibt den Singleton frei. */
export function resetStageApp(): void {
  handle?.destroy();
  handle = undefined;
  pending = undefined;
  assetsPromise = undefined;
  assetsReady = false;
  warmed = false;
}

/**
 * Legt einen Zaehler um die WebGL-Draw-Aufrufe. Schlaegt still fehl, wenn der Renderer
 * kein WebGL nutzt — dann liefert `drawCalls()` eben 0.
 */
function instrumentDrawCalls(app: Application, onDraw: () => void): void {
  const gl = (app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
  if (!gl) return;
  const drawElements = gl.drawElements.bind(gl);
  const drawArrays = gl.drawArrays.bind(gl);
  gl.drawElements = ((...args: Parameters<WebGLRenderingContext['drawElements']>) => {
    onDraw();
    return drawElements(...args);
  }) as WebGLRenderingContext['drawElements'];
  gl.drawArrays = ((...args: Parameters<WebGLRenderingContext['drawArrays']>) => {
    onDraw();
    return drawArrays(...args);
  }) as WebGLRenderingContext['drawArrays'];
}

/* ------------------------------------------------------------------ */
/* Low-Effects-Erkennung (Architektur §9)                              */
/* ------------------------------------------------------------------ */

interface DeviceInfo {
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

/**
 * Grobe Vorab-Einschaetzung anhand der Geraete-Angaben. Der zweite Teil der Regel — der
 * gemessene Frame-Median ueber die ersten 2 s — laeuft in `measureLowEffects()`.
 */
export function detectLowEffects(info: DeviceInfo = navigator as DeviceInfo): boolean {
  const memory = info.deviceMemory;
  const cores = info.hardwareConcurrency;
  if (memory !== undefined && memory <= RENDER.lowEffects.deviceMemoryMax) return true;
  if (cores !== undefined && cores <= RENDER.lowEffects.hardwareConcurrencyMax) return true;
  return false;
}

/** Median einer Frame-Zeit-Reihe. */
export function frameMedian(times: readonly number[]): number {
  if (times.length === 0) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

/**
 * Misst nach dem Betreten der Buehne und meldet, ob der Low-Effects-Modus greifen soll.
 * Loest mit `true` auf, wenn der Frame-Median ueber der Schwelle liegt.
 */
export function measureLowEffects(target: StageAppHandle): Promise<boolean> {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      resolve(frameMedian(target.frameTimes()) > RENDER.lowEffects.frameMedianMaxMs);
    }, RENDER.lowEffects.probeDurationMs);
  });
}
