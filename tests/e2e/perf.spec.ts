/**
 * Performance der Buehne (Architektur §9, Audit A2/A3).
 *
 * A2 fragt nach dem **Raum**: acht Crooks, Laser, Tresor, 60 s ohne Frame-Drops,
 * hoechstens drei Draw-Batches, flacher Heap. Genau das misst dieser Test.
 *
 * Die Show selbst (Tempo-Kurve, Stalls, Slow-Mo, Outcome-Sequenzen) kommt in M3 und
 * bekommt dort ihren eigenen Fall.
 *
 * Zwei Dinge machen Frame-Zeiten auf CI-Rechnern wertlos: kein GPU-Treiber (dann rendert
 * Chromium per SwiftShader in Software) und ein ausgelasteter Runner. Der Test erkennt
 * den Software-Fall und ueberspringt dann **nur** die Zeitmessung — Draw-Calls und Heap
 * bleiben in jedem Fall pruefbar, denn die haengen nicht an der Hardware.
 */

import { expect, test, type Page } from '@playwright/test';
import { atScreen, openVault, playChoices, setPlayerCount, skipNegotiation } from './helpers';

/** Wie lange gemessen wird. Der A2-Check nennt 60 s; hier reichen 20 s fuer ein Urteil. */
const MEASURE_MS = 20_000;
/** Aus Architektur §9 (Referenzgeraet). */
const BUDGET = { p50: 16.7, p95: 33 } as const;

/**
 * Grenzen fuer **einzelne** Frames waehrend der Show (ADR-40).
 *
 * Das Dev-Panel zeigt einen gleitenden Median — der glaettet genau das weg, was man als
 * Ruckler sieht. Deshalb misst dieser Test zusaetzlich jeden Frame roh.
 *
 * `maxMs` ist bewusst hoch: Beim Betreten der Aufdeckung legt PixiJS den WebGL-Kontext an
 * und uebersetzt die Shader — gemessen rund 280 ms in einem Frame, auf einem vierfach
 * gedrosselten Kern. Der Wert deckelt einen **bekannten** Aussetzer, damit er nicht
 * unbemerkt waechst; er behauptet nicht, dass es keinen gaebe.
 */
const FRAME_LIMITS = { maxMs: 300, overBudget: 33, maxOverBudget: 4 } as const;
/** Audit A2: eine Textur je Ebene, also drei Wechsel pro Frame (ADR-14). */
const MAX_DRAW_CALLS = 3;

/** Rendert Chromium in Software? Dann sind Frame-Zeiten eine Eigenschaft des Rechners. */
async function isSoftwareRenderer(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (!info) return false;
    const renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
    return /swiftshader|llvmpipe|software/i.test(renderer);
  });
}

/** Liest die Kennzahlen aus dem Dev-Panel. */
async function readStats(page: Page): Promise<{ ms: number; draws: number }> {
  return page.evaluate(() => {
    const values = document.querySelectorAll('.dev__stats dd');
    return {
      ms: Number.parseFloat(values[1]?.textContent ?? '0'),
      draws: Number.parseInt(values[2]?.textContent ?? '0', 10),
    };
  });
}

/** Faehrt eine Runde mit acht Spielern bis auf die Buehne und haelt sie dort an. */
async function openStageWithEightCrooks(page: Page): Promise<void> {
  // `hold=1` stoppt den Karten-Takt: Die Buehne bleibt stehen und laesst sich messen.
  await page.goto('./?dev=1&hold=1');
  await page.getByRole('button', { name: 'Spielen' }).click();
  const confirm = page.getByRole('button', { name: 'Los' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await atScreen(page, 'lobby');

  await setPlayerCount(page, 8);
  await openVault(page);
  await skipNegotiation(page);
  await playChoices(page, ['share', 'share', 'share', 'share', 'share', 'share', 'steal', 'steal']);
  await page.getByRole('button', { name: 'Tresor öffnen' }).click();
  await atScreen(page, 'reveal');
  // Warten, bis die Buehne wirklich steht — vorher misst man das Aufbauen.
  await expect(page.locator('.dev__stats')).toBeVisible();
  await page.waitForTimeout(2500);
}

test.describe('Buehne', () => {
  test.slow();

  test('acht Crooks laufen ohne Frame-Drops und mit ≤ 3 Draw-Calls', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));

    await openStageWithEightCrooks(page);
    const software = await isSoftwareRenderer(page);

    /*
     * Kassel redet waehrend der Messung durchgehend: Seine Sprechblase ist der teuerste
     * Einzelteil der Buehne (ADR-16), und ohne sie misst man den einfachen Fall.
     */
    const speak = page.getByRole('button', { name: 'Kassel' });

    const frames: number[] = [];
    const draws: number[] = [];
    const step = 250;
    for (let elapsed = 0; elapsed < MEASURE_MS; elapsed += step) {
      if (elapsed % 5000 === 0) await speak.click();
      await page.waitForTimeout(step);
      const stats = await readStats(page);
      if (stats.ms > 0) frames.push(stats.ms);
      draws.push(stats.draws);
    }

    expect(frames.length).toBeGreaterThan(10);

    /*
     * Draw-Calls sind das eigentliche Architektur-Versprechen: drei Atlanten, drei
     * Texturwechsel. Sie haengen nicht an der Hardware und werden deshalb immer geprueft.
     */
    expect(Math.max(...draws)).toBeLessThanOrEqual(MAX_DRAW_CALLS);
    expect(Math.min(...draws)).toBeGreaterThan(0);

    const sorted = [...frames].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)]!;
    const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
    console.info(
      `[perf] p50 ${p50.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · draws ≤ ${Math.max(...draws)}`
    );

    test.skip(software, 'Software-Renderer: Frame-Zeiten sagen nichts ueber das Spiel aus.');
    expect(p50).toBeLessThanOrEqual(BUDGET.p50);
    expect(p95).toBeLessThanOrEqual(BUDGET.p95);
    expect(problems).toEqual([]);
  });

  test('haelt den Speicher flach', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'performance.memory gibt es nur in Chromium.');

    await openStageWithEightCrooks(page);
    const heap = async (): Promise<number> =>
      page.evaluate(
        () =>
          (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0
      );

    const before = await heap();
    await page.waitForTimeout(MEASURE_MS);
    const after = await heap();

    /*
     * Ein Sprite-Pool, der jede Sekunde neu allokiert, faellt hier auf. Zehn Prozent
     * Luft, weil der GC seine eigene Taktung hat und nicht auf Tests wartet.
     */
    expect(after).toBeLessThanOrEqual(before * 1.1 + 2_000_000);
  });
});

test.describe('Reveal-Show', () => {
  test.slow();

  /**
   * Die Show ist der Lastfall, den A3 meint: acht Karten drehen sich mit Stalls, die
   * Kamera faehrt, der Alarm blitzt, Zaehler ploppen. Gemessen wird **waehrend** sie
   * laeuft, nicht auf der stehenden Buehne.
   */
  test('haelt das Frame-Budget waehrend der Aufdeckung', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));

    // Ohne `hold`: Die Show startet von selbst.
    await page.goto('./?dev=1');
    await page.getByRole('button', { name: 'Spielen' }).click();
    const confirm = page.getByRole('button', { name: 'Los' });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await atScreen(page, 'lobby');

    await setPlayerCount(page, 8);
    await openVault(page);
    await skipNegotiation(page);
    await playChoices(page, ['share', 'share', 'share', 'share', 'share', 'share', 'steal', 'steal']);
    /*
     * Jeden Frame roh mitschreiben, bevor die Show anfaengt. Der gleitende Median aus dem
     * Dev-Panel sagt, wie es sich im Schnitt anfuehlt; diese Liste sagt, ob es geruckelt
     * hat (ADR-40).
     */
    await page.evaluate(() => {
      const window_ = globalThis as unknown as { __frames?: number[] };
      window_.__frames = [];
      let last = performance.now();
      const tick = (now: number): void => {
        window_.__frames?.push(now - last);
        last = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.getByRole('button', { name: 'Tresor öffnen' }).click();
    await atScreen(page, 'reveal');

    const software = await isSoftwareRenderer(page);
    const frames: number[] = [];
    const draws: number[] = [];

    // Solange messen, wie die Show laeuft — sie endet von selbst.
    for (let elapsed = 0; elapsed < 24_000; elapsed += 250) {
      const stillRunning = await page.evaluate(
        () => document.querySelector<HTMLElement>('#app > section')?.dataset['screen'] === 'reveal'
      );
      if (!stillRunning) break;
      await page.waitForTimeout(250);
      const stats = await readStats(page).catch(() => ({ ms: 0, draws: 0 }));
      if (stats.ms > 0) frames.push(stats.ms);
      if (stats.draws > 0) draws.push(stats.draws);
    }

    expect(frames.length).toBeGreaterThan(20);
    expect(Math.max(...draws)).toBeLessThanOrEqual(MAX_DRAW_CALLS);

    /* --- Einzelne Frames: Gab es Ruckler? --- */
    const raw = await page.evaluate(
      () => (globalThis as unknown as { __frames?: number[] }).__frames ?? []
    );
    const worst = Math.max(...raw);
    const overBudget = raw.filter((ms) => ms > FRAME_LIMITS.overBudget);
    console.info(
      `[perf/frames] ${raw.length} Frames · schlechtester ${worst.toFixed(0)} ms · ` +
        `${overBudget.length} ueber ${FRAME_LIMITS.overBudget} ms`
    );

    const sorted = [...frames].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)]!;
    const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
    console.info(
      `[perf/show] p50 ${p50.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · draws ≤ ${Math.max(...draws)}`
    );

    test.skip(software, 'Software-Renderer: Frame-Zeiten sagen nichts ueber das Spiel aus.');
    expect(p50).toBeLessThanOrEqual(BUDGET.p50);
    expect(p95).toBeLessThanOrEqual(BUDGET.p95);

    // Der bekannte Aussetzer beim Renderer-Aufbau darf nicht wachsen (ADR-40).
    expect(worst, `schlechtester Frame ${worst.toFixed(0)} ms`).toBeLessThanOrEqual(FRAME_LIMITS.maxMs);
    expect(
      overBudget.length,
      `${overBudget.length} Frames ueber ${FRAME_LIMITS.overBudget} ms: ${overBudget.map((ms) => ms.toFixed(0)).join(', ')}`
    ).toBeLessThanOrEqual(FRAME_LIMITS.maxOverBudget);

    expect(problems).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Der Aussetzer beim Betreten der Buehne (ADR-40)                     */
/* ------------------------------------------------------------------ */

test.describe('Gedrosselt', () => {
  test.slow();

  /**
   * Dasselbe noch einmal, aber mit **vierfach gedrosselter CPU**.
   *
   * Ohne Drosselung sieht man nichts; auf einem echten Handy ruckte es beim Aufdecken
   * sichtbar — gemeldet aus dem Spiel, nicht aus dem Test. Gedrosselt war der Grund
   * messbar: PixiJS legte beim Betreten der Aufdeckung den WebGL-Kontext an und
   * uebersetzte die Shader.
   *
   * Seit ADR-41 passiert das waehrend der Verhandlung. Gegen denselben Ablauf, nur mit
   * abgeschaltetem Vorlauf gemessen, sind es zwei Messreihen:
   *
   * | | ohne Vorlauf | mit Vorlauf |
   * |---|---|---|
   * | schlechtester Frame | 133 ms · 116 ms | 67 ms · 84 ms |
   * | Frames ueber 33 ms | 4 · 4 | 1 · 1 |
   *
   * Die Grenzen hier sind bewusst weiter als die gemessenen Werte: Auf einer belasteten
   * Maschine schwankte derselbe Code zwischen 67 und 183 ms. Der Test sichert die
   * Groessenordnung gegen einen Rueckfall — er misst nicht das Rauschen.
   */
  test('haelt den Aussetzer beim Buehnen-Aufbau in Grenzen', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'CPU-Drosselung gibt es nur ueber das CDP.');

    await page.goto('./');
    await page.getByRole('button', { name: 'Spielen' }).click();
    const confirm = page.getByRole('button', { name: 'Los' });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await atScreen(page, 'lobby');

    const software = await isSoftwareRenderer(page);

    await setPlayerCount(page, 4);
    await openVault(page);
    await skipNegotiation(page);
    await playChoices(page, ['share', 'share', 'share', 'steal']);

    await page.evaluate(() => {
      const scope = globalThis as unknown as { __frames?: number[] };
      scope.__frames = [];
      let last = performance.now();
      const tick = (now: number): void => {
        scope.__frames?.push(now - last);
        last = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    // Ab hier so langsam wie ein Mittelklasse-Handy.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await page.getByRole('button', { name: 'Tresor öffnen' }).click();
    await atScreen(page, 'reveal');
    // Bis die erste Karte offen liegt — der Aufbau ist dann sicher durch.
    await page.waitForFunction(
      () => (document.querySelector<HTMLElement>('.screen--reveal')?.dataset['revealed'] ?? '') !== '',
      undefined,
      { timeout: 60_000 }
    );
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    const raw = await page.evaluate(
      () => (globalThis as unknown as { __frames?: number[] }).__frames ?? []
    );
    const worst = Math.max(...raw);
    const overBudget = raw.filter((ms) => ms > FRAME_LIMITS.overBudget);
    console.info(
      `[perf/gedrosselt] ${raw.length} Frames · schlechtester ${worst.toFixed(0)} ms · ` +
        `${overBudget.length} ueber ${FRAME_LIMITS.overBudget} ms`
    );

    /*
     * Wie in den beiden Faellen darueber: Gemessen und gemeldet wird immer, geprueft nur
     * auf echter Grafik. Der CI-Runner zeichnet in Software mit 10 fps — dort liegt
     * **jeder** Frame ueber dem Budget, egal was das Spiel tut (gemessen: 314 von 352).
     * Eine Zusicherung darauf misst den Mietrechner, nicht die Aufdeckung. Dass dieser
     * Fall das als einziger vergass, fiel nie auf: Die Perf-Stufe lief auf CI nie, weil
     * der E2E-Flow davor abbrach.
     */
    test.skip(software, 'Software-Renderer: Frame-Zeiten sagen nichts ueber das Spiel aus.');
    expect(worst, `schlechtester Frame ${worst.toFixed(0)} ms`).toBeLessThanOrEqual(FRAME_LIMITS.maxMs);
    expect(overBudget.length).toBeLessThanOrEqual(FRAME_LIMITS.maxOverBudget);
  });
});
