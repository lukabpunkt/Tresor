/**
 * Nachtschicht (GDD §3.7, §5).
 *
 * Keine Verhandlung, keine Tabelle, kein Kassel — zehn Sekunden Stille mit tickender
 * Uhr. Der Screen ist absichtlich fast leer: Spaeter am Abend will niemand mehr lesen,
 * und das Schweigen selbst ist der Effekt.
 *
 * Die Uhr springt in Sekundenschritten statt zu gleiten (`steps()`): Eine gleitende
 * Nadel beruhigt, eine springende macht nervoes — und genau darum geht es hier.
 */

import { play } from '@/audio/AudioManager';
import { t } from '@/core/i18n';
import { openingPhase } from '@/core/modes';
import { createCountdownRing } from '@/ui/components/countdownRing';
import { createVaultWidget } from '@/ui/components/vaultWidget';
import { vaultSpec } from '@/core/vault';
import type { ScreenContext, ScreenInstance } from '@/ui/router';
import { acquireWakeLock, releaseWakeLock } from '@/ui/wakeLock';

export function createSilenceScreen(ctx: ScreenContext): ScreenInstance {
  const { settings } = ctx.fsm.context;
  const phase = openingPhase(settings);
  const vault = ctx.fsm.context.setup?.vault ?? ctx.fsm.context.vault;

  const el = document.createElement('section');
  el.className = 'screen screen--silence';

  const headline = document.createElement('h1');
  headline.className = 'silence__headline';
  headline.textContent = t('silence.headline');

  const body = document.createElement('p');
  body.className = 'silence__body';
  body.textContent = t('silence.body');

  /*
   * Die Uhr liegt hinter dem Tresor und fuellt den leeren Screen. Sie ist Stimmung, kein
   * zweiter Countdown — die Zahl steht im Ring, und zwei Zahlen waeren eine zu viel.
   *
   * Bewusst **ohne Zifferblattrand**: Der Countdown-Ring ist schon ein Kreis, ein zweiter
   * daneben liest sich als Doppelanzeige. Es bleiben zwoelf Striche und der Zeiger.
   */
  const clock = document.createElement('div');
  clock.className = 'nightClock';
  clock.setAttribute('aria-hidden', 'true');
  clock.style.setProperty('--clock-seconds', `${phase.seconds}s`);
  // Ein Sprung pro Sekunde — die Uhr zeigt dieselbe Zeit wie der Ring, nur als Bild.
  clock.style.setProperty('--clock-steps', String(phase.seconds));
  clock.innerHTML = `
    <svg viewBox="0 0 100 100">
      ${Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const x1 = 50 + Math.sin(angle) * 37;
        const y1 = 50 - Math.cos(angle) * 37;
        const x2 = 50 + Math.sin(angle) * 42;
        const y2 = 50 - Math.cos(angle) * 42;
        return `<line class="nightClock__mark" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" />`;
      }).join('')}
      <line class="nightClock__hand" x1="50" y1="50" x2="50" y2="14" />
      <circle class="nightClock__pin" cx="50" cy="50" r="4" />
    </svg>`;

  const stage = document.createElement('div');
  stage.className = 'negotiation__stage silence__stage';
  stage.append(clock);

  const widget = createVaultWidget({ vault, spec: vaultSpec(settings), size: 'lg' });
  const ring = createCountdownRing({
    seconds: phase.seconds,
    onDone: () => proceed(),
    // Bei zehn Sekunden Stille ist jeder Tick hoerbar — nicht erst die letzten fuenf.
    onTick: (secondsLeft) => {
      if (secondsLeft > 0) play('vault_dial', 0, secondsLeft <= 3 ? 4 : 0);
    },
  });
  stage.append(ring.el, widget.el);

  el.append(headline, stage, body);

  let done = false;

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
      void acquireWakeLock();
      // Zehn Sekunden reichen fuer die Atlanten (Architektur §8).
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
      void releaseWakeLock();
    },
  };
}
