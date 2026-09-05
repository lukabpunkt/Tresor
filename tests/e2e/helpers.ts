/**
 * Helfer fuer die E2E-Durchlaeufe.
 *
 * Alle Wartebedingungen haengen an Zustaenden, nie an Uhrzeiten: Der Router blendet mit
 * einem 320-ms-Wipe um, der Pass-Screen ist 800 ms taub, die Versiegelung dauert 540 ms.
 * Wer hier mit `waitForTimeout` arbeitet, baut sich flaky Tests.
 */

import { expect, type Page } from '@playwright/test';

export type ScreenId =
  | 'title'
  | 'lobby'
  | 'negotiation'
  | 'silence'
  | 'pass'
  | 'choice'
  | 'sealed'
  | 'reveal'
  | 'witness'
  | 'distribute'
  | 'result';

/**
 * Wartezeit fuer alles, was **hinter** der Show liegt.
 *
 * Die Aufdeckung dauert nicht ueberall gleich lang. PixiJS deckelt `ticker.deltaMS` bei
 * `maxElapsedMS` = 100 ms, und der Ticker treibt GSAP: Wo ein Frame laenger als 100 ms
 * braucht, bekommt die Show weniger Zeit gutgeschrieben, als real vergeht — sie zieht
 * sich in Wanduhr-Zeit. Auf dem CI-Runner zeichnet Chromium in Software; dort meldet das
 * Dev-Panel exakt 100,0 ms je Frame (also den Deckel), waehrend rohe Frames bis 150 ms
 * brauchen. Eine 20-Sekunden-Show dauert dort ueber eine halbe Minute.
 *
 * Deshalb bekommen Wartebedingungen, die ein Stueck Show ueberspannen, ihr eigenes
 * Fenster. Es ersetzt keine Zustandspruefung — gewartet wird weiter auf einen Zustand,
 * nur eben laenger, wenn die Maschine langsam zeichnet.
 */
export const AFTER_SHOW_MS = 90_000;

/** Wartet, bis genau dieser Screen gemountet ist. */
export async function atScreen(page: Page, id: ScreenId, timeout = 40_000): Promise<void> {
  await page.waitForFunction(
    (want) => document.querySelector<HTMLElement>('#app > section')?.dataset['screen'] === want,
    id,
    { timeout }
  );
}

export function screen(page: Page) {
  return page.locator('#app > section').first();
}

/** Title → Lobby, inklusive des einmaligen 18+-Hinweises. */
export async function startGame(page: Page): Promise<void> {
  await page.goto('./');
  await page.getByRole('button', { name: 'Spielen' }).click();
  const confirm = page.getByRole('button', { name: 'Los' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await atScreen(page, 'lobby');
}

/** Fuellt die Lobby auf `count` Spieler auf. */
export async function setPlayerCount(page: Page, count: number): Promise<void> {
  const rows = page.locator('.lobby__row');
  while ((await rows.count()) < count) {
    await page.getByRole('button', { name: 'Spieler hinzufügen' }).click();
  }
  while ((await rows.count()) > count) {
    await page.locator('.lobby__remove').last().click();
  }
  await expect(rows).toHaveCount(count);
}

/** Schaltet einen Modus-Chip in der Lobby ein. */
export async function enableMode(page: Page, label: string): Promise<void> {
  const option = page.locator('.modes__option', { hasText: label }).first();
  if ((await option.getAttribute('aria-pressed')) !== 'true') await option.click();
  await expect(option).toHaveAttribute('aria-pressed', 'true');
}

/** Lobby → Verhandlung (bzw. Stille in der Nachtschicht). */
export async function openVault(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Tresor öffnen' }).click();
}

/** Beendet die Verhandlung sofort, statt 30 s zu warten. */
export async function skipNegotiation(page: Page): Promise<void> {
  await atScreen(page, 'negotiation');
  await page.getByRole('button', { name: 'Alle bereit' }).click();
}

/** Ein Spieler nimmt das Handy und waehlt. */
export async function takeTurn(page: Page, choice: 'share' | 'steal'): Promise<void> {
  await atScreen(page, 'pass');
  // Die 800-ms-Sperre ist eine MUSS-Regel (Audit A1) — hier warten wir sie ab.
  await page.waitForSelector('.screen--pass:not(.is-locked)');
  await screen(page).click();
  await atScreen(page, 'choice');
  await page.locator(choice === 'share' ? '.card--share' : '.card--steal').click();
}

/** Gibt das Handy reihum und waehlt fuer jeden. */
export async function playChoices(page: Page, choices: readonly ('share' | 'steal')[]): Promise<void> {
  for (const choice of choices) await takeTurn(page, choice);
  await atScreen(page, 'sealed');
}

/** Sealed → Reveal → (Distribute) → Result. Schreibt dabei das Karten-Protokoll mit. */
export async function runReveal(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Tresor öffnen' }).click();
  await atScreen(page, 'reveal');
  await watchRevealLog(page);
}

/**
 * Hält das Karten-Protokoll fest, **solange es existiert**.
 *
 * `data-revealed` lebt auf dem Reveal-Screen, und der Screen lebt nur bis zum Ende der
 * Show: Danach ist er samt Protokoll ausgetauscht. Wer erst nach der letzten Karte danach
 * fragt, fragt womöglich schon das Ergebnis — und bekommt einen leeren String, der nie
 * mehr voll wird. Genau daran ist „lässt die letzte Karte nicht wegtippen" auf CI
 * gescheitert: Die zwanzig Taps dauern dort lange genug, dass die Show währenddessen
 * durchläuft. Lokal gewann derselbe Test das Rennen und sah gesund aus.
 *
 * Ein Beobachter am `<body>` schreibt jede Änderung mit und behält den längsten Stand.
 * Damit hängt die Zusicherung am Inhalt, nicht am Zeitpunkt der Frage.
 */
export async function watchRevealLog(page: Page): Promise<void> {
  await page.evaluate(() => {
    const scope = globalThis as unknown as { __revealLog?: string };
    // Pro Runde neu: Der nächste Reveal fängt wieder bei null Karten an.
    scope.__revealLog = '';
    const read = (): void => {
      const log = document.querySelector<HTMLElement>('.screen--reveal')?.dataset['revealed'] ?? '';
      if (log.length > (scope.__revealLog ?? '').length) scope.__revealLog = log;
    };
    new MutationObserver(read).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-revealed'],
    });
    read();
  });
}

/** Die mitgeschriebenen Karten als `playerId:choice`-Liste. */
export async function revealedCards(page: Page): Promise<string[]> {
  const log = await page.evaluate(
    () => (globalThis as unknown as { __revealLog?: string }).__revealLog ?? ''
  );
  return log ? log.split(',') : [];
}

/** Wartet, bis der Mitschreiber `count` Karten gesehen hat. */
export async function waitForRevealed(page: Page, count: number, timeout = AFTER_SHOW_MS): Promise<void> {
  await page.waitForFunction(
    (want) =>
      ((globalThis as unknown as { __revealLog?: string }).__revealLog ?? '')
        .split(',')
        .filter(Boolean).length >= want,
    count,
    { timeout }
  );
}

/**
 * Verteilt alle Schluecke auf den ersten Teiler und zahlt aus.
 *
 * Gewartet wird auf den **Rest-Zaehler**, nicht auf den Knopf: Jeder Tap startet eine
 * Muenzflug-Animation, und wer in dieser Zeit `isDisabled()` fragt, fragt mitten in der
 * Bewegung. Der Zaehler traegt `is-done`, sobald nichts mehr uebrig ist — das ist ein
 * Zustand, kein Zeitpunkt.
 */
export async function distributeAllToFirst(page: Page): Promise<void> {
  // Verteilt wird immer direkt nach der Show — also mit deren Fenster (AFTER_SHOW_MS).
  await atScreen(page, 'distribute', AFTER_SHOW_MS);
  const payout = page.getByRole('button', { name: 'Auszahlen' });
  const target = page.locator('.distribute__target').first();
  const remaining = page.locator('.distribute__remaining');

  for (let i = 0; i < 40; i++) {
    if (await remaining.evaluate((el) => el.classList.contains('is-done'))) break;
    await target.click();
  }

  await expect(remaining).toHaveClass(/is-done/);
  await expect(payout).toBeEnabled();
  await payout.click();
}

/** Der Tresorstand, wie ihn der Flip-Counter anzeigt. */
export async function vaultValue(page: Page): Promise<number> {
  const label = await page.locator('.flip__digits').first().getAttribute('aria-label');
  return Number(label);
}
