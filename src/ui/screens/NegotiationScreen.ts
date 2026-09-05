/**
 * Verhandlung (GDD §3.3, §5 Screen 2) — der wichtigste Screen, der am wenigsten tut.
 *
 * Design-Pfeiler 2: **Die Verhandlung ist das Spiel.** Das Handy hält nur die Zeit und
 * zeigt, worum gespielt wird — geredet, geschworen und gelogen wird am Tisch. Deshalb
 * gibt es hier keine Eingaben ausser "Alle bereit" und, im Eid-Modus, den Schwur.
 *
 * Die Auszahlungstabelle kommt live aus `previewPayouts()`, derselben Quelle wie das
 * echte Ergebnis — sie kann nicht luegen (Audit A1).
 */

import { COUNTDOWN_WARN_SEC, KASSEL_LINE_INTERVAL_MS } from '@/config/rules';
import { play } from '@/audio/AudioManager';
import { setMusicIntensity } from '@/audio/music';
import { t, tList } from '@/core/i18n';
import { previewPayouts, type PayoutPreviewRow } from '@/core/payout';
import { vaultSpec } from '@/core/vault';
import { createPlayerBadge, setBadgeSworn } from '@/ui/components/badge';
import { createButton } from '@/ui/components/button';
import { createCountdownRing } from '@/ui/components/countdownRing';
import { showHint } from '@/ui/components/onboarding';
import { createVaultWidget } from '@/ui/components/vaultWidget';
import { vibrate } from '@/ui/haptics';
import type { ScreenContext, ScreenInstance } from '@/ui/router';
import { acquireWakeLock, releaseWakeLock } from '@/ui/wakeLock';

export function createNegotiationScreen(ctx: ScreenContext): ScreenInstance {
  const { settings, players } = ctx.fsm.context;
  const setup = ctx.fsm.context.setup;
  const vault = setup?.vault ?? ctx.fsm.context.vault;
  const spec = vaultSpec(settings);

  const el = document.createElement('section');
  el.className = 'screen screen--negotiation';

  const headline = document.createElement('h1');
  headline.className = 'negotiation__headline';
  headline.textContent = t('negotiation.headline');

  /* --- Tresor mit Countdown-Ring --- */
  const stage = document.createElement('div');
  stage.className = 'negotiation__stage';

  const widget = createVaultWidget({ vault, spec, size: 'lg' });

  const ring = createCountdownRing({
    seconds: settings.negotiationSec,
    onDone: () => proceed(),
    /*
     * Die letzten zehn Sekunden ziehen an: Die Uhr im Loop tickt schneller, die letzten
     * fuenf bekommen zusaetzlich einen hoerbaren Tick (Art Direction §4.3). Beides ist
     * Zugabe — der Ring allein sagt schon alles (GDD §6: stumm voll spielbar).
     */
    onTick: (secondsLeft, ticking) => {
      setMusicIntensity(1 - Math.min(1, secondsLeft / COUNTDOWN_WARN_SEC));
      if (ticking && secondsLeft > 0) play('vault_dial', 0, secondsLeft <= 3 ? 4 : 0);
    },
  });

  stage.append(ring.el, widget.el);

  /* --- Kassel --- */
  const kassel = document.createElement('p');
  kassel.className = 'negotiation__kassel';
  kassel.setAttribute('aria-live', 'polite');

  /* --- Auszahlungstabelle dieser Runde --- */
  const table = buildTable(previewPayouts(players.length, vault, settings));

  /* --- Eid-Reihe --- */
  const oathRow = document.createElement('div');
  oathRow.className = 'negotiation__oaths';

  if (settings.modes.oath) {
    const label = document.createElement('p');
    label.className = 'negotiation__oathLabel';
    label.textContent = t('negotiation.swear');
    oathRow.append(label);

    const badges = document.createElement('div');
    badges.className = 'negotiation__badges';

    for (const player of players) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'oath';
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `${player.name}: ${t('negotiation.swear')}`);

      const badge = createPlayerBadge({ colorId: player.colorId, name: player.name, size: 'sm' });
      button.append(badge);

      button.addEventListener('click', () => {
        if (!ctx.fsm.toggleOath(player.id)) return;
        const sworn = ctx.fsm.context.setup?.oaths.includes(player.id) ?? false;
        setBadgeSworn(badge, sworn, true);
        button.classList.toggle('is-sworn', sworn);
        button.setAttribute('aria-pressed', String(sworn));
        // Der Schwur ist die einzige Geste dieses Screens — er bekommt das Siegel-Muster.
        vibrate(sworn ? 'seal' : 'tap');
      });

      badges.append(button);
    }
    oathRow.append(badges);
  }

  const ready = createButton({
    label: t('negotiation.allReady'),
    variant: 'primary',
    className: 'btn--block',
    onClick: () => {
      vibrate('tap');
      proceed();
    },
  });

  el.append(headline, stage, kassel, table, oathRow, ready);

  /* ---------------------------------------------------------------- */

  let kasselTimer: ReturnType<typeof setInterval> | undefined;
  let done = false;

  /**
   * Kassel wirft hoechstens alle 10 s einen Satz ein (GDD §3.3) — Deko, kein Hinweis.
   *
   * In den letzten zehn Sekunden wechselt er den Ton: Aus Geplauder wird Druck. Das ist
   * derselbe Umschlag wie bei Ring und Musik, nur in Worten — drei Kanaele, eine Ansage.
   */
  function startKassel(): void {
    const lines = tList('kassel.negotiation');
    const lateLines = tList('kassel.negotiationLate');
    if (lines.length === 0) return;
    let index = Math.floor(ctx.fsm.context.setup?.seed ?? 0) % lines.length;
    const show = (): void => {
      const late = ring.secondsLeft <= COUNTDOWN_WARN_SEC && lateLines.length > 0;
      const pool = late ? lateLines : lines;
      kassel.textContent = pool[index % pool.length] ?? '';
      kassel.classList.remove('is-new');
      void kassel.offsetWidth;
      kassel.classList.add('is-new');
      index += 1;
    };
    show();
    kasselTimer = globalThis.setInterval(show, KASSEL_LINE_INTERVAL_MS);
  }

  function proceed(): void {
    if (done) return;
    done = true;
    ring.stop();
    if (!ctx.fsm.send({ type: 'proceed' })) return;
    void ctx.router.go('pass');
  }

  return {
    el,
    activate() {
      ring.start();
      startKassel();
      // Einmal pro Geraet: Darf ich hier luegen? Ja (Roadmap M5.5).
      showHint(el, 'negotiation');
      // Das Handy liegt auf dem Tisch und wird 30 s nicht angefasst (GDD §5).
      void acquireWakeLock();
      /*
       * Die Atlanten laden waehrend geredet wird (Architektur §8). Beim Betreten der
       * Aufdeckung darf nichts mehr nachgeladen werden — sonst haengt die Show genau in
       * dem Moment, in dem alle hinschauen.
       */
      /*
       * Fehler bewusst verschlucken: Ist das Netz weg, bevor der Chunk da ist, faellt
       * hier nichts aus — die Aufdeckung versucht es selbst noch einmal und schaltet
       * notfalls auf die DOM-Karten um. Ohne `catch` waere es eine unbehandelte
       * Rejection, und die steht als Fehler in der Konsole eines Spielers, dem gerade
       * nur das WLAN weggebrochen ist (Audit A5).
       */
      void import('@/game/stageModules')
        .then((m) => m.preloadStage())
        .catch(() => undefined);
    },
    destroy() {
      done = true;
      ring.stop();
      // Sonst startet die naechste Runde mit dem hektischen Tempo der letzten.
      setMusicIntensity(0);
      if (kasselTimer !== undefined) clearInterval(kasselTimer);
      void releaseWakeLock();
    },
  };
}

/** Die Tabelle "Diese Runde" unter dem Tresor (GDD §3.3). */
function buildTable(rows: readonly PayoutPreviewRow[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'payout';

  const title = document.createElement('p');
  title.className = 'payout__title';
  title.textContent = t('negotiation.tableHeadline');
  wrapper.append(title);

  const labelFor = (row: PayoutPreviewRow, isAll: boolean): string => {
    if (row.thieves === 0) return t('negotiation.tableNoThief');
    if (row.thieves === 1) return t('negotiation.tableSoloThief');
    return isAll ? t('negotiation.tableAllThieves') : t('negotiation.tableMultiThief');
  };

  const lastIndex = rows.length - 1;
  rows.forEach((row, index) => {
    const line = document.createElement('div');
    line.className = `payout__row payout__row--${row.outcome}`;

    const label = document.createElement('span');
    label.className = 'payout__label';
    label.textContent = labelFor(row, index === lastIndex);

    const value = document.createElement('span');
    value.className = 'payout__value';
    value.textContent =
      row.thieves === 1
        ? t('negotiation.tableThiefDistributes')
        : t('negotiation.tableEachDrinks', { count: row.thieves === 0 ? row.sharerSips! : row.thiefSips });

    const after = document.createElement('span');
    after.className = 'payout__after';
    after.textContent = t('negotiation.tableNextVault', { vault: row.nextVault });

    line.append(label, value, after);
    wrapper.append(line);
  });

  return wrapper;
}
