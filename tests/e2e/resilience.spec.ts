/**
 * Fehler-Resilienz (Roadmap M5.6, Audit A5).
 *
 * Ein Trinkspiel laeuft auf fremden Handys, in fremden WLANs, spaet am Abend. Es muss
 * drei Faelle ueberstehen, ohne dass jemand die Seite neu laedt:
 *
 * 1. **Kein Netz mehr.** Die App ist eine PWA und liegt nach dem ersten Start im Cache.
 * 2. **Der Atlas fehlt.** Dann uebernimmt die DOM-Kartenreihe — ein Trinkspiel darf nicht
 *    am Renderer sterben (ADR-15, M3).
 * 3. **Der Speicher ist dicht.** Private Mode und volle Quota duerfen den Start nicht
 *    verhindern; man verliert dann eben die Sitzung, nicht das Spiel.
 */

import { expect, test } from '@playwright/test';
import {
  AFTER_SHOW_MS,
  atScreen,
  openVault,
  playChoices,
  runReveal,
  screen,
  setPlayerCount,
  skipNegotiation,
  startGame,
  waitForRevealed,
} from './helpers';

test.describe('Fehlerfaelle', () => {
  test('spielt weiter, wenn mitten in der Runde das Netz wegfaellt', async ({ page, context }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));

    await startGame(page);
    await setPlayerCount(page, 3);
    await openVault(page);

    // Ab hier: Flugmodus.
    await context.setOffline(true);

    await skipNegotiation(page);
    await playChoices(page, ['share', 'share', 'steal']);
    await runReveal(page);

    /*
     * Die Aufdeckung ist der Moment, in dem am meisten nachgeladen wuerde — Atlanten,
     * PIXI, GSAP. Alles davon liegt schon im Speicher, weil die Verhandlung vorgeladen
     * hat (Architektur §8). Genau das prueft dieser Test.
     */
    await expect(screen(page)).toHaveAttribute('data-screen', 'reveal');
    await page.waitForFunction(
      () => (document.querySelector('.screen--reveal') as HTMLElement)?.dataset['revealed'] !== '',
      undefined,
      { timeout: 40_000 }
    );

    await context.setOffline(false);
    expect(problems).toEqual([]);
  });

  test('faellt auf die DOM-Karten zurueck, wenn der Atlas fehlt', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));

    // Die Atlas-Texturen sind ab jetzt weg — als waere der Cache halb kaputt.
    await page.route('**/atlas/*.png', (route) => route.abort());
    await page.route('**/atlas/*.json', (route) => route.abort());

    await startGame(page);
    await setPlayerCount(page, 3);
    await openVault(page);
    await skipNegotiation(page);
    await playChoices(page, ['share', 'share', 'steal']);
    await runReveal(page);

    /*
     * Ohne Atlas gibt es keine Buehne — aber es gibt die Runde. Die Karten werden als
     * DOM-Reihe aufgedeckt, das Protokoll fuellt sich wie immer, und der Screen geht
     * danach weiter. Wer bis hierhin gespielt hat, will ein Ergebnis, keinen Fehler.
     */
    await waitForRevealed(page, 3);

    await atScreen(page, 'distribute', AFTER_SHOW_MS);
    expect(problems).toEqual([]);
  });

  test('startet auch ohne nutzbaren localStorage', async ({ page }) => {
    /*
     * Safari im privaten Modus wirft bei `setItem`. Die App darf daran nicht sterben —
     * sie verliert dann die gespeicherte Sitzung, und das ist der richtige Preis.
     */
    await page.addInitScript(() => {
      const explode = () => {
        throw new DOMException('QuotaExceededError');
      };
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: { getItem: explode, setItem: explode, removeItem: explode, clear: explode, key: explode, length: 0 },
      });
    });

    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));

    await startGame(page);
    await setPlayerCount(page, 3);
    await openVault(page);
    await skipNegotiation(page);
    await atScreen(page, 'pass');
    expect(problems).toEqual([]);
  });
});
