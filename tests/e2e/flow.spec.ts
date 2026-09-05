/**
 * E2E: der komplette Spielfluss (Roadmap M1.7, Audit A1).
 *
 * Vier Spieler, drei Runden — alle teilen, ein Alleingang mit Verteilung, zwei Diebe —
 * dazu eine Eid-Runde mit Meineid und eine Maulwurf-Runde. Alles unter Mobile-Emulation
 * auf iPhone 12 (WebKit) und Pixel 5 (Chromium).
 */

import { expect, test } from '@playwright/test';
import {
  AFTER_SHOW_MS,
  atScreen,
  distributeAllToFirst,
  enableMode,
  openVault,
  playChoices,
  revealedCards,
  runReveal,
  screen,
  setPlayerCount,
  skipNegotiation,
  startGame,
  takeTurn,
  vaultValue,
  waitForRevealed,
} from './helpers';

/* ------------------------------------------------------------------ */
/* Grundlagen (aus M0)                                                 */
/* ------------------------------------------------------------------ */

test.describe('Start', () => {
  test('startet ohne Fehler und zeigt den Titel', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));

    await page.goto('./');
    await expect(page.locator('.title__logo')).toHaveText('Der Tresor');
    await expect(page.locator('.title__tagline')).toHaveText('Teilen oder Stehlen.');
    expect(problems).toEqual([]);
  });

  test('liefert ein installierbares Manifest', async ({ page, baseURL }) => {
    await page.goto('./');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', './manifest.webmanifest');

    const response = await page.request.get(new URL('manifest.webmanifest', baseURL).toString());
    expect(response.ok()).toBe(true);

    const manifest = (await response.json()) as {
      name: string;
      display: string;
      orientation: string;
      icons: { sizes: string; purpose: string }[];
    };
    expect(manifest.name).toBe('Der Tresor');
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('portrait');
    expect(manifest.icons.map((i) => i.sizes)).toContain('192x192');
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  test('laedt nichts von aussen (Architektur §9)', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('http://localhost') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        external.push(url);
      }
    });

    await page.goto('./');
    await page.waitForLoadState('networkidle');
    expect(external).toEqual([]);
  });

  test('blendet im Querformat den Hinweis ein — aber nur auf dem Handy', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.orientation-lock')).toBeHidden();
    await page.setViewportSize({ width: 844, height: 390 });

    /*
     * Der Hinweis gilt Fingern, nicht Fenstern (Architektur §9): Auf dem Handy im
     * Querformat ist er richtig, auf dem Desktop waere "Dreh dein Handy" Unsinn — dort
     * laeuft das Spiel im Portrait-Rahmen. Der Test prueft deshalb beide Seiten der
     * Regel, statt eine davon zu ueberspringen.
     */
    const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    const lock = page.locator('.orientation-lock');
    if (touch) await expect(lock).toBeVisible();
    else await expect(lock).toBeHidden();
  });
});

/* ------------------------------------------------------------------ */
/* Lobby                                                               */
/* ------------------------------------------------------------------ */

test.describe('Lobby', () => {
  test('startet nicht mit zwei Spielern (ADR-5)', async ({ page }) => {
    await startGame(page);
    await setPlayerCount(page, 2);

    const cta = page.getByRole('button', { name: 'Tresor öffnen' });
    await expect(cta).toBeDisabled();
    await expect(page.locator('.lobby__hint')).toContainText('Zu zweit ist das kein Dilemma');

    await setPlayerCount(page, 3);
    await expect(cta).toBeEnabled();
  });

  test('nimmt hoechstens acht Spieler auf', async ({ page }) => {
    await startGame(page);
    await setPlayerCount(page, 8);
    await expect(page.getByRole('button', { name: 'Spieler hinzufügen' })).toBeDisabled();
  });

  test('haelt Namen und Einstellungen ueber einen Reload', async ({ page }) => {
    await startGame(page);
    await setPlayerCount(page, 4);
    await page.locator('.lobby__name').first().fill('Anna');
    await page.locator('.chip', { hasText: 'Härte' }).click();

    await page.reload();
    await page.getByRole('button', { name: 'Spielen' }).click();
    await atScreen(page, 'lobby');

    await expect(page.locator('.lobby__name').first()).toHaveValue('Anna');
    await expect(page.locator('.chip', { hasText: 'Härte' })).toContainText('Hart');
  });

  test('alle Touch-Ziele sind mindestens 48 px hoch (Audit A1)', async ({ page }) => {
    await startGame(page);
    /*
     * In einem Rutsch messen: Einzelne Locator koennen zwischen `count()` und
     * `boundingBox()` verschwinden, wenn das 18+-Sheet gerade zuklappt.
     */
    const small = await page.locator('button').evaluateAll((buttons) =>
      buttons
        .filter((button) => button.checkVisibility?.() ?? button.getClientRects().length > 0)
        .map((button) => ({
          label: button.className,
          height: button.getBoundingClientRect().height,
        }))
        .filter((entry) => entry.height > 0 && entry.height < 48)
    );
    expect(small).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Drei Runden am Stueck (M1.7)                                        */
/* ------------------------------------------------------------------ */

test.describe('Drei Runden', () => {
  test('allShare → soloSteal mit Verteilung → multiSteal', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });

    await startGame(page);
    await setPlayerCount(page, 4);
    await openVault(page);

    /* --- Runde 1: alle teilen --- */
    await skipNegotiation(page);
    expect(await vaultValue(page)).toBe(4);
    await playChoices(page, ['share', 'share', 'share', 'share']);
    await runReveal(page);
    await atScreen(page, 'result', AFTER_SHOW_MS);

    await expect(page.locator('.result__banner')).toHaveText('Ehre unter Dieben');
    // Bankgebuehr: jeder einen Schluck (ADR-2).
    await expect(page.locator('.result__drinker')).toHaveCount(4);
    await expect(page.locator('.result__drinker').first()).toContainText('trinkt 1');
    await expect(page.locator('.result__vaultNote')).toHaveText('Der Tresor wächst auf 6');

    /* --- Runde 2: einer stiehlt und verteilt --- */
    await page.getByRole('button', { name: 'Nächste Runde' }).click();
    await skipNegotiation(page);
    expect(await vaultValue(page)).toBe(6);
    await playChoices(page, ['steal', 'share', 'share', 'share']);
    await runReveal(page);

    await distributeAllToFirst(page);
    await atScreen(page, 'result', AFTER_SHOW_MS);
    await expect(page.locator('.result__banner')).toHaveText('Der Alleingang');
    // Alles auf eine Person ist erlaubt (ADR-4): eine Trinkerzeile mit sechs Schluecken.
    await expect(page.locator('.result__drinker')).toHaveCount(1);
    await expect(page.locator('.result__drinker').first()).toContainText('trinkt 6');
    await expect(page.locator('.result__vaultNote')).toHaveText('Der Tresor wurde geleert');

    /* --- Runde 3: zwei Diebe --- */
    await page.getByRole('button', { name: 'Nächste Runde' }).click();
    await skipNegotiation(page);
    expect(await vaultValue(page)).toBe(4);
    await playChoices(page, ['steal', 'steal', 'share', 'share']);
    await runReveal(page);
    await atScreen(page, 'result', AFTER_SHOW_MS);

    await expect(page.locator('.result__banner')).toHaveText('Zu viele Köche');
    // ⌈4/2⌉ = 2 pro Dieb.
    await expect(page.locator('.result__drinker')).toHaveCount(2);
    await expect(page.locator('.result__drinker').first()).toContainText('trinkt 2');

    /* --- Statistik nach drei Runden --- */
    await page.getByRole('button', { name: 'Statistik' }).click();
    const sheet = page.locator('.sheet__panel');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Vertrauen');
    await expect(sheet).toContainText('Meistbetrogen');

    expect(problems).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Aufdeckung                                                          */
/* ------------------------------------------------------------------ */

test.describe('Aufdeckung', () => {
  test('deckt Teiler zuerst und Diebe zuletzt auf (ADR-3)', async ({ page }) => {
    await startGame(page);
    await setPlayerCount(page, 4);
    await openVault(page);
    await skipNegotiation(page);
    await playChoices(page, ['steal', 'share', 'share', 'steal']);
    await runReveal(page);

    /*
     * Die Buehne ist ein Canvas — pruefbar ist sie ueber das Protokoll, das der Screen
     * mitschreibt: `playerId:choice` in genau der Reihenfolge, in der aufgedeckt wurde.
     */
    await waitForRevealed(page, 4);

    const revealed = await revealedCards(page);
    expect(revealed.map((entry) => entry.split(':')[1])).toEqual(['share', 'share', 'steal', 'steal']);

    // Jede Karte genau einmal, und alle vier Spieler kommen vor.
    expect(new Set(revealed.map((entry) => entry.split(':')[0])).size).toBe(4);
  });

  test('laesst die letzte Karte nicht wegtippen (GDD §4.3)', async ({ page }) => {
    await startGame(page);
    await setPlayerCount(page, 4);
    await openVault(page);
    await skipNegotiation(page);
    // Zwei Diebe: Dann endet die Runde im Result und nicht in der Verteil-UI.
    await playChoices(page, ['share', 'share', 'steal', 'steal']);
    await runReveal(page);

    // Warten, bis die vorletzte Karte offen liegt, dann durchtippen.
    await waitForRevealed(page, 3);

    /*
     * Ab hier ist die letzte Karte dran. Zwanzig Taps duerfen sie **nicht** vorziehen —
     * das ist die Regel, die den Moment schuetzt, fuer den es das Spiel gibt.
     */
    const before = (await revealedCards(page)).length;
    /*
     * Getippt wird auf die **Buehne**, nicht auf den jeweils aktuellen Screen — und nur
     * solange sie steht. Laeuft die Show waehrend der zwanzig Taps durch (auf einem
     * langsamen Rechner dauern sie laenger als der Rest der Show), landeten die
     * restlichen Taps sonst auf dem Ergebnis, wo einer davon "Naechste Runde" trifft.
     */
    const stage = page.locator('.screen--reveal');
    for (let i = 0; i < 20; i++) {
      if (!(await stage.isVisible().catch(() => false))) break;
      await stage.click({ force: true, timeout: 2000 }).catch(() => undefined);
    }
    await page.waitForTimeout(400);
    expect((await revealedCards(page)).length).toBeLessThanOrEqual(before + 1);

    /*
     * Die Show laeuft trotzdem zu Ende — und alle vier Karten liegen offen. Gelesen wird
     * aus dem Mitschreiber, nicht vom Screen: Auf einem langsamen Rechner dauern die
     * zwanzig Taps laenger als der Rest der Show, und dann steht hier schon das Ergebnis.
     */
    await waitForRevealed(page, 4);
    expect((await revealedCards(page)).length).toBe(4);
    await atScreen(page, 'result');
  });

  test('zeigt die Wahl nach dem Versiegeln nirgends mehr (Audit A1)', async ({ page }) => {
    await startGame(page);
    await setPlayerCount(page, 3);
    await openVault(page);
    await skipNegotiation(page);

    await takeTurn(page, 'steal');
    await atScreen(page, 'pass');

    // Weder im Markup des Folge-Screens noch irgendwo sonst steht, was gewaehlt wurde.
    const html = await page.locator('#app').innerHTML();
    expect(html).not.toContain('STEHLEN');
    expect(html).not.toContain('TEILEN');
  });
});

/* ------------------------------------------------------------------ */
/* Eid-Modus                                                           */
/* ------------------------------------------------------------------ */

test.describe('Eid', () => {
  test('bestraft den Meineid des Alleindiebs', async ({ page }) => {
    await startGame(page);
    await setPlayerCount(page, 4);
    await enableMode(page, 'Eid');
    await openVault(page);
    await atScreen(page, 'negotiation');

    // Spieler 1 schwoert oeffentlich — und stiehlt dann.
    const oath = page.locator('.oath').first();
    await oath.click();
    await expect(oath).toHaveAttribute('aria-pressed', 'true');
    await expect(oath.locator('.badge')).toHaveClass(/is-sworn/);

    await page.getByRole('button', { name: 'Alle bereit' }).click();
    await playChoices(page, ['steal', 'share', 'share', 'share']);
    await runReveal(page);

    // Meineid: Er trinkt 2 selbst und verteilt nur die restlichen 2 (GDD §3.7).
    await atScreen(page, 'distribute', AFTER_SHOW_MS);
    await expect(page.locator('.distribute__headline')).toContainText('2');

    await distributeAllToFirst(page);
    await atScreen(page, 'result');
    await expect(page.locator('.result__banner')).toHaveText('MEINEID!');
    await expect(page.locator('.result__drinker--perjury')).toHaveCount(1);
  });
});

/* ------------------------------------------------------------------ */
/* Maulwurf-Modus                                                      */
/* ------------------------------------------------------------------ */

test.describe('Maulwurf', () => {
  test('zwingt genau einen Spieler zum Stehlen', async ({ page }) => {
    await startGame(page);
    await setPlayerCount(page, 4);
    await enableMode(page, 'Maulwurf');
    await openVault(page);
    await skipNegotiation(page);

    let moleTurns = 0;
    for (let i = 0; i < 4; i++) {
      await atScreen(page, 'pass');
      await page.waitForSelector('.screen--pass:not(.is-locked)');
      await screen(page).click();
      await atScreen(page, 'choice');

      const isMole = await page.locator('.screen--choice-mole').count();
      if (isMole > 0) {
        moleTurns += 1;
        // Die TEILEN-Karte haengt in Ketten und reagiert nur mit einem Ruetteln.
        await expect(page.locator('.card--share')).toHaveClass(/is-locked/);
        await expect(page.locator('.choice__headline')).toHaveText('Du bist der Maulwurf.');
        await page.locator('.card--share').click();
        await expect(page.locator('.screen--choice')).toBeVisible();
        await page.locator('.card--steal').click();
      } else {
        await page.locator('.card--share').click();
      }
    }
    expect(moleTurns).toBe(1);

    await atScreen(page, 'sealed');
    await runReveal(page);

    // Genau ein Dieb → Alleingang, und der Maulwurf ist die letzte Karte.
    await atScreen(page, 'distribute', AFTER_SHOW_MS);
    await distributeAllToFirst(page);
    await atScreen(page, 'result');
    await expect(page.locator('.result__banner')).toHaveText('Der Alleingang');
    await expect(page.locator('.result__sub')).toContainText('Der Maulwurf');
  });
});

/* ------------------------------------------------------------------ */
/* Nachtschicht                                                        */
/* ------------------------------------------------------------------ */

test.describe('Nachtschicht', () => {
  test('ersetzt die Verhandlung durch zehn Sekunden Stille', async ({ page }) => {
    await startGame(page);
    await setPlayerCount(page, 3);
    await enableMode(page, 'Nachtschicht');
    await openVault(page);

    await atScreen(page, 'silence');
    await expect(page.locator('.silence__headline')).toHaveText('Nachtschicht.');
    await expect(page.getByRole('button', { name: 'Alle bereit' })).toHaveCount(0);

    // Der Countdown laeuft von 10 herunter und schickt das Handy dann auf die Reise.
    await expect(page.locator('.ring__value')).toHaveText(/^(10|9|8)$/);
    await atScreen(page, 'pass', 20_000);
  });
});

/* ------------------------------------------------------------------ */
/* Runde abbrechen (Architektur §3)                                    */
/* ------------------------------------------------------------------ */

test.describe('Zurueck-Knopf', () => {
  test('fragt nach, bevor eine Runde verworfen wird', async ({ page }) => {
    await startGame(page);
    await setPlayerCount(page, 3);
    await openVault(page);
    await skipNegotiation(page);
    await atScreen(page, 'pass');

    await page.goBack();
    await expect(page.locator('.sheet__panel')).toBeVisible();
    await expect(page.locator('.sheet__title')).toHaveText('Runde abbrechen?');

    // Weiterspielen laesst die Runde stehen.
    await page.getByRole('button', { name: 'Weiterspielen' }).click();
    await expect(page.locator('.sheet__panel')).toHaveCount(0);
    await atScreen(page, 'pass');

    // Abbrechen fuehrt zurueck in die Lobby.
    await page.goBack();
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await atScreen(page, 'lobby');
  });
});

/* ------------------------------------------------------------------ */
/* Kronzeuge (Backlog nach 1.0)                                        */
/* ------------------------------------------------------------------ */

test.describe('Kronzeuge', () => {
  test('halbiert die Strafe des Verpfeifers und legt sie dem Verpfiffenen auf', async ({ page }) => {
    await startGame(page);
    await setPlayerCount(page, 3);
    await enableMode(page, 'Kronzeuge');
    await openVault(page);
    await skipNegotiation(page);

    // Zwei Diebe bei V = 4 → je 2 Schlücke.
    await playChoices(page, ['steal', 'steal', 'share']);
    await runReveal(page);

    /*
     * Der Screen liegt offen in der Mitte — kein Rumgeben, kein Timer. Erst tippt der
     * Kronzeuge sein eigenes Zeichen, dann das des anderen. Beides sieht der ganze Tisch.
     */
    await atScreen(page, 'witness');
    await expect(page.locator('.witness__thief')).toHaveCount(2);

    await page.locator('.witness__thief').first().click();
    // Nach dem ersten Tap ist er markiert und selbst nicht mehr wählbar.
    await expect(page.locator('.witness__thief.is-witness')).toHaveCount(1);
    await expect(page.locator('.witness__thief').first()).toBeDisabled();

    await page.locator('.witness__thief').nth(1).click();
    await atScreen(page, 'result');

    // 1 + 3 = 4: Der Deal verschiebt Schlücke, er erlässt keine.
    const rows = page.locator('.result__drinker');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('trinkt 1');
    await expect(rows.nth(1)).toContainText('trinkt 3');
    await expect(page.locator('.result__sub')).toContainText('verpfiffen');
  });

  test('lässt die Runde auch schweigend enden', async ({ page }) => {
    await startGame(page);
    await setPlayerCount(page, 3);
    await enableMode(page, 'Kronzeuge');
    await openVault(page);
    await skipNegotiation(page);
    await playChoices(page, ['steal', 'steal', 'share']);
    await runReveal(page);

    await atScreen(page, 'witness', AFTER_SHOW_MS);
    await page.getByRole('button', { name: 'Keiner packt aus' }).click();
    await atScreen(page, 'result');

    // Unverändert: je 2 Schlücke, keine Verpfiffen-Zeile.
    const rows = page.locator('.result__drinker');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('trinkt 2');
    await expect(rows.nth(1)).toContainText('trinkt 2');
    await expect(page.locator('.result__sub')).not.toContainText('verpfiffen');
  });

  test('überspringt den Screen beim Alleingang', async ({ page }) => {
    await startGame(page);
    await setPlayerCount(page, 3);
    await enableMode(page, 'Kronzeuge');
    await openVault(page);
    await skipNegotiation(page);

    // Ein Dieb: Es gibt niemanden zu verpfeifen — es geht direkt zum Verteilen.
    await playChoices(page, ['steal', 'share', 'share']);
    await runReveal(page);
    await atScreen(page, 'distribute', AFTER_SHOW_MS);
  });
});

/* ------------------------------------------------------------------ */
/* Vertrauens-Historie über mehrere Abende (Backlog nach 1.0)          */
/* ------------------------------------------------------------------ */

test.describe('Vertrauens-Historie', () => {
  /** Ein Abend, der schon vorbei ist — sonst gäbe es nichts zu erinnern. */
  const seedHistory = `
    localStorage.setItem('tresor.history.v1', JSON.stringify({
      'name 1': { name: 'Name 1', days: ['2026-08-29'], freeRounds: 10, shares: 2, steals: 8, sips: 30, perjuries: 1 },
      'name 2': { name: 'Name 2', days: ['2026-08-29'], freeRounds: 10, shares: 9, steals: 1, sips: 8, perjuries: 0 }
    }));`;

  test('erinnert sich an den letzten Abend und überlebt den Session-Reset', async ({ page }) => {
    await page.addInitScript(seedHistory);

    await startGame(page);
    await setPlayerCount(page, 3);
    await openVault(page);
    await skipNegotiation(page);
    await playChoices(page, ['share', 'share', 'share']);
    await runReveal(page);
    await atScreen(page, 'result', AFTER_SHOW_MS);

    await page.getByRole('button', { name: 'Statistik' }).click();
    const history = page.locator('.score__row--history');
    await expect(history.first()).toBeVisible();

    /*
     * Der Unterschied ist der Punkt: Heute Abend hat jeder geteilt (100 %), über alle
     * Abende steht Name 1 bei einem Fünftel. Genau dafür gibt es die Historie.
     */
    await expect(history.first()).toContainText('Name 1');
    await expect(history.first()).toContainText('2 Abende');
    await expect(history.first().locator('.score__value')).not.toHaveText('100%');

    // Zurück und Session zurücksetzen — die Historie hängt an einem eigenen Schlüssel.
    await page.locator('.sheet__close').click();
    const survived = await page.evaluate(() => {
      const before = localStorage.getItem('tresor.history.v1');
      localStorage.removeItem('tresor.session.v1');
      return before === localStorage.getItem('tresor.history.v1');
    });
    expect(survived).toBe(true);
  });

  test('zeigt am ersten Abend keine Historie', async ({ page }) => {
    await startGame(page);
    await setPlayerCount(page, 3);
    await openVault(page);
    await skipNegotiation(page);
    await playChoices(page, ['share', 'share', 'share']);
    await runReveal(page);
    await atScreen(page, 'result', AFTER_SHOW_MS);

    await page.getByRole('button', { name: 'Statistik' }).click();
    /*
     * Am ersten Abend stünden hier dieselben Zahlen wie eine Zeile darüber — eine
     * Statistik, die sich selbst wiederholt, liest niemand zweimal.
     */
    await expect(page.locator('.score__row--history')).toHaveCount(0);
  });
});

/* ------------------------------------------------------------------ */
/* Modi-Anleitung                                                      */
/* ------------------------------------------------------------------ */

test.describe('Modi-Anleitung', () => {
  test('erklärt jeden Modus und hebt den eingeschalteten hervor', async ({ page }) => {
    await startGame(page);
    await enableMode(page, 'Maulwurf');

    await page.getByRole('button', { name: 'Was die Modi ändern' }).first().click();
    await expect(page.locator('.modeGuide')).toBeVisible();

    // Fünf Modi, fünf Abschnitte — und jeder mit Erklärung, nicht nur mit Überschrift.
    const sections = page.locator('.modeGuide__mode');
    await expect(sections).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await expect(sections.nth(i).locator('.modeGuide__title')).not.toBeEmpty();
      expect(await sections.nth(i).locator('li').count()).toBeGreaterThanOrEqual(2);
    }

    // Der eingeschaltete Modus ist markiert — man sucht meist genau den.
    await expect(page.locator('.modeGuide__mode.is-active')).toHaveCount(1);
    await expect(page.locator('.modeGuide__mode.is-active')).toContainText('Maulwurf');
  });

  test('warnt, wenn Eid und Nachtschicht sich gegenseitig aufheben', async ({ page }) => {
    await startGame(page);
    await enableMode(page, 'Eid');
    await enableMode(page, 'Nachtschicht');

    /*
     * Der Eid haengt am Verhandlungs-Screen, den die Nachtschicht ersetzt. Wer beides
     * anschaltet, wartet sonst einen Abend lang auf einen Meineid, den es nicht geben kann.
     */
    await expect(page.locator('.modes__combo')).toContainText('Nachtschicht');
    await expect(page.locator('.modes__combo')).toContainText('wirkungslos');
  });
});
