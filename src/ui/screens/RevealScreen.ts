/**
 * Aufdeckung (GDD §4, Roadmap M3).
 *
 * Der Screen baut die Buehne auf, laesst den `RevealDirector` Regie fuehren und geht
 * danach weiter. Er inszeniert selbst nichts und rechnet nichts aus: Das Ergebnis stand
 * beim Betreten fest, das Drehbuch kommt aus `buildRevealScript()`.
 *
 * Zwei Gesetze setzt er durch (CLAUDE.md):
 *
 * 1. Die Reihenfolge kommt aus `result.revealOrder` — Teiler zuerst, Diebe zuletzt,
 *    Maulwurf als letzter Dieb.
 * 2. Tap-to-Skip gilt ab der zweiten Karte und **nie** bei der letzten oder waehrend
 *    der Auszahlung. Die Entscheidung darueber trifft der Director.
 *
 * Faellt PIXI aus — kein WebGL, Atlas kaputt, Speicher voll —, uebernimmt eine schlichte
 * DOM-Kartenreihe. Ein Trinkspiel darf nicht am Renderer sterben.
 */

import { colorById, hex, textColorOn } from '@/config/theme';
import { buildRevealScript } from '@/core/choreographer';
import { t, tList } from '@/core/i18n';
import { createSeededRng } from '@/core/rng';
import type { Choice, RoundResult } from '@/core/types';
import { vaultSpec } from '@/core/vault';
import { symbolSvg } from '@/ui/components/badge';
import { createDevPanel, type DevPanel } from '@/ui/components/devPanel';
import { vaultFill } from '@/ui/components/vaultWidget';
import { vibrate } from '@/ui/haptics';
import type { ScreenContext, ScreenInstance } from '@/ui/router';
import { acquireWakeLock, releaseWakeLock } from '@/ui/wakeLock';
/*
 * Nur Typen — die Module selbst werden in `buildStage()` dynamisch geladen. PIXI und
 * GSAP machen zusammen rund 400 KB aus; im Einstiegs-Chunk waeren sie fuer jeden Screen
 * dabei, obwohl nur die Aufdeckung sie braucht (Architektur §1, ADR-15).
 */
import type { Camera } from '@/game/Camera';
import type { RevealDirector } from '@/game/RevealDirector';
import type { StageAppHandle } from '@/game/StageApp';
import { loadStageModules } from '@/game/stageModules';
import type { VaultRoom } from '@/game/VaultRoom';

/** Nur mit `?dev=1`: Haelt die Show an, damit man die Buehne betrachten kann. */
function holdMode(): boolean {
  const params = new URLSearchParams(location.search);
  return params.has('dev') && params.has('hold');
}

/** Pause, bevor der Screen wechselt — die letzte Zahl soll noch stehen bleiben. */
const OUTRO_MS = 600;

export function createRevealScreen(ctx: ScreenContext): ScreenInstance {
  const result = ctx.fsm.context.result;

  const el = document.createElement('section');
  el.className = 'screen screen--reveal';

  /*
   * Protokoll dessen, was die Buehne **tatsaechlich** aufgedeckt hat, als
   * `playerId:choice`-Liste. Das ist kein Debug-Rest, sondern die Pruefnaht fuer die
   * wichtigste Zusicherung des Spiels: gezeigte Karten == getroffene Wahlen, in der
   * Reihenfolge aus `revealOrder` (ADR-3, ADR-18). Auf einer PIXI-Buehne gibt es sonst
   * nichts, woran ein Test das festmachen koennte.
   */
  el.dataset['revealed'] = '';

  const canvasHost = document.createElement('div');
  canvasHost.className = 'reveal__stage';
  canvasHost.setAttribute('aria-hidden', 'true');

  const hint = document.createElement('p');
  hint.className = 'reveal__hint';
  hint.textContent = t('reveal.skipHint');

  el.append(canvasHost, hint);

  if (!result) {
    // Kann nur passieren, wenn der Screen ohne Runde betreten wird (Reload mitten drin).
    return { el };
  }

  /* ---------------------------------------------------------------- */

  let stage: StageAppHandle | undefined;
  let room: VaultRoom | undefined;
  let camera: Camera | undefined;
  let director: RevealDirector | undefined;
  let tick: ((ticker: { deltaMS: number }) => void) | undefined;
  let devPanel: DevPanel | undefined;
  let destroyed = false;
  let finished = false;

  const domFallback = createDomFallback(ctx, result);

  /** Der Director meldet jede offene Karte — hier landet sie im Protokoll. */
  const onCardRevealed = (playerId: string, choice: Choice, isLast: boolean): void => {
    domFallback.reveal(playerId, choice, isLast);
    const log = el.dataset['revealed'] ?? '';
    el.dataset['revealed'] = log ? `${log},${playerId}:${choice}` : `${playerId}:${choice}`;
    // Haptik bei der letzten Karte ist Pflicht (GDD §5) — sie trifft einen im Handy.
    vibrate(isLast ? 'lastCard' : choice === 'steal' ? 'alarm' : 'tap');
  };

  const finish = (): void => {
    if (finished || destroyed) return;
    finished = true;
    hint.hidden = true;
    globalThis.setTimeout(() => {
      if (destroyed) return;
      if (!ctx.fsm.send({ type: 'showFinished' })) return;
      /*
       * Wohin es nach der Show geht, weiss die FSM (Alleingang → Verteilen, ab zwei
       * Dieben im Kronzeugen-Modus → Auspacken, sonst Ergebnis). Der Screen liest das
       * nur ab, statt die Regel ein zweites Mal zu kennen.
       */
      const next = ctx.fsm.state.toLowerCase();
      void ctx.router.go(next === 'distribute' || next === 'witness' ? next : 'result');
    }, OUTRO_MS);
  };

  /* ---------------------------------------------------------------- */
  /* PIXI-Buehne                                                       */
  /* ---------------------------------------------------------------- */

  async function buildStage(): Promise<void> {
    /*
     * Ein einziger Lazy-Chunk, geladen ueber `loadStageModules()` — dieselbe Liste, die
     * der Vorlauf waehrend der Verhandlung benutzt. Sie hier ein zweites Mal zu fuehren
     * waere kein Tippfehler-Risiko, sondern ein toter Reveal: Der Renderer bindet seine
     * Render-Pipes an die Module, die beim Anlegen geladen waren (ADR-41).
     */
    const {
      stageApp,
      room: roomModule,
      camera: cameraModule,
      director: directorModule,
      registry,
    } = await loadStageModules();
    if (destroyed) return;

    registry.registerAll();

    const assets = await stageApp.loadStageAssets();
    if (destroyed) return;

    stage = await stageApp.getStageApp();
    if (destroyed) return;

    stage.clearWorld();
    const rng = createSeededRng(result!.seed);
    const settings = ctx.fsm.context.settings;
    const low = settings.lowEffects || stageApp.detectLowEffects();

    room = new roomModule.VaultRoom({ assets, rng, lowEffects: low });
    room.populate({
      players: ctx.session.state.players,
      choices: result!.choices,
      oaths: settings.modes.oath ? result!.oaths : [],
      vaultFill: vaultFill(result!.vault, vaultSpec(settings)),
    });

    stage.world.addChild(room.view);
    stage.overlay.addChild(room.light);
    camera = new cameraModule.Camera(room.view);

    stage.attach(canvasHost);
    tick = (ticker) => room?.update(ticker.deltaMS);
    stage.app.ticker.add(tick);

    const script = buildRevealScript(result!, {
      pace: settings.revealPace,
      oathsEnabled: settings.modes.oath,
    });

    director = new directorModule.RevealDirector({
      script,
      result: result!,
      room,
      camera,
      rng,
      /*
       * Kassels Kommentare liegen als Arrays in der i18n (Roadmap M4.5) — pro Outcome
       * drei Saetze, damit er sich ueber einen Abend nicht wiederholt. Gezogen wird mit
       * dem Runden-Seed: Dieselbe Runde klingt beim Nachspielen gleich.
       */
      line: (key) => {
        const options = tList(`kassel.${key}`);
        return options.length > 0 ? (options[rng.int(options.length)] ?? '') : t(`kassel.${key}`);
      },
      onCardRevealed,
      /*
       * Der Ausgang geht auch in die Hand (GDD §5): Der Jackpot bekommt das laengste
       * Muster im Spiel, der Meineid zwei harte Schlaege. Alles andere bleibt bei der
       * Haptik der letzten Karte — sonst nutzt sich der Effekt ab.
       */
      onOutcome: (outcome, perjury) => {
        if (perjury) vibrate('perjury');
        else if (outcome === 'jackpot') vibrate('jackpot');
      },
      onFinished: finish,
    });

    if (ctx.dev) mountDevPanel();

    /*
     * Zweiter Teil der Low-Effects-Regel: Wenn die ersten zwei Sekunden zu langsam
     * laufen, fliegen Laser, Schatten und Vignette raus (Architektur §9).
     */
    if (!low) {
      void stageApp.measureLowEffects(stage).then((slow) => {
        if (slow && !destroyed) room?.setLowEffects(true);
      });
    }

    if (!holdMode()) director.play();
  }

  /** Bedienfeld fuer den Look-Check (Roadmap M2.5/M3). Nur bei `?dev=1`. */
  function mountDevPanel(): void {
    let lasersOn = true;

    devPanel = createDevPanel({
      actions: [
        { label: 'Show starten', onClick: () => director?.play() },
        { label: 'Pause', onClick: () => director?.pause() },
        { label: 'Skip', onClick: () => director?.skip() },
        { label: 'Tresor auf', onClick: () => room?.vault.openDoor() },
        { label: 'Alarm', onClick: () => room?.raiseAlarm() },
        { label: 'Kassel', onClick: () => room?.kassel.say(t('kassel.cardsPlease'), 6000) },
        {
          label: 'Low-Effects',
          onClick: () => {
            lasersOn = !lasersOn;
            room?.setLowEffects(!lasersOn);
          },
        },
      ],
      readStats: () => {
        const times = stage?.frameTimes() ?? [];
        const recent = times.slice(-60);
        const avg = recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : 0;
        return {
          fps: avg > 0 ? Math.round(1000 / avg) : 0,
          'ms/frame': avg.toFixed(1),
          draws: stage?.drawCalls() ?? 0,
          crooks: room?.crooks.size ?? 0,
          show: `${((director?.durationMs ?? 0) / 1000).toFixed(1)} s`,
        };
      },
    });
    el.append(devPanel.el);
  }

  /* ---------------------------------------------------------------- */

  /** Tab gewechselt: Die Show haelt an, statt im Hintergrund weiterzulaufen. */
  const onVisibility = (): void => {
    if (document.hidden) director?.pause();
    else director?.resume();
  };

  el.addEventListener('click', () => {
    if (director?.skip()) vibrate('tap');
  });

  return {
    el,

    activate() {
      void acquireWakeLock();
      document.addEventListener('visibilitychange', onVisibility);

      buildStage().catch((error) => {
        // Kein WebGL, Atlas kaputt, Speicher voll: Das Spiel laeuft trotzdem weiter.
        console.warn('[reveal] Buehne nicht verfuegbar, DOM-Fallback', error);
        if (destroyed) return;
        domFallback.enable(el, hint, result, onCardRevealed, finish);
      });
    },

    destroy() {
      destroyed = true;
      finished = true;
      document.removeEventListener('visibilitychange', onVisibility);
      devPanel?.destroy();
      domFallback.stop();
      director?.destroy();
      director = undefined;
      if (stage && tick) stage.app.ticker.remove(tick);
      camera?.snapHome();
      room?.destroy();
      room = undefined;
      stage?.detach();
      stage?.clearWorld();
      void releaseWakeLock();
    },
  };
}

/* ------------------------------------------------------------------ */
/* DOM-Notnagel                                                        */
/* ------------------------------------------------------------------ */

interface DomFallback {
  /** Baut die Kartenreihe ein und laesst sie im Sekundentakt umdrehen. */
  enable(
    host: HTMLElement,
    before: HTMLElement,
    result: RoundResult,
    onCard: (playerId: string, choice: Choice, isLast: boolean) => void,
    onDone: () => void
  ): void;
  reveal(playerId: string, choice: Choice, last: boolean): void;
  stop(): void;
}

/** Abstand zwischen zwei Karten im Notnagel — hier gibt es keine Tempo-Kurve. */
const FALLBACK_STEP_MS = 1000;

/**
 * Die schlichte Kartenreihe. Sie wird nur eingehaengt, wenn die Buehne nicht hochkommt —
 * dann ist die Runde zwar unspektakulaer, aber vollstaendig spielbar. Die Reihenfolge
 * bleibt auch hier Gesetz.
 */
function createDomFallback(ctx: ScreenContext, result: RoundResult): DomFallback {
  const table = document.createElement('div');
  table.className = 'reveal__table';

  const cards = new Map<string, HTMLElement>();
  let enabled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  for (const playerId of result.revealOrder) {
    const player = ctx.session.playerById(playerId);
    const colorId = player?.colorId ?? 'red';
    const color = colorById(colorId);
    const choice = result.choices[playerId] ?? 'share';

    const card = document.createElement('div');
    card.className = 'revealCard';
    card.style.setProperty('--card-color', hex(color.hex));
    card.style.setProperty('--card-shade', hex(color.shade));

    const inner = document.createElement('div');
    inner.className = 'revealCard__inner';
    inner.innerHTML = `
      <div class="revealCard__face revealCard__face--back">${symbolSvg(color.symbol, hex(textColorOn(colorId)))}</div>
      <div class="revealCard__face revealCard__face--front is-${choice}"></div>`;
    const front = inner.querySelector('.revealCard__face--front');
    if (front) front.textContent = t(`common.${choice}`);

    const name = document.createElement('span');
    name.className = 'revealCard__name';
    name.textContent = player?.name ?? '';

    card.append(inner, name);
    table.append(card);
    cards.set(playerId, card);
  }

  return {
    enable(host, before, round, onCard, onDone) {
      enabled = true;
      host.classList.add('is-fallback');
      host.insertBefore(table, before);

      let index = 0;
      const step = (): void => {
        const playerId = round.revealOrder[index];
        if (playerId === undefined) {
          onDone();
          return;
        }
        const last = index === round.revealOrder.length - 1;
        onCard(playerId, round.choices[playerId] ?? 'share', last);
        index += 1;
        timer = globalThis.setTimeout(step, FALLBACK_STEP_MS);
      };
      timer = globalThis.setTimeout(step, 500);
    },

    reveal(playerId, choice, last) {
      if (!enabled) return;
      const card = cards.get(playerId);
      if (!card) return;
      card.classList.add('is-revealed', `is-${choice}`);
      if (last) card.classList.add('revealCard--last');
      if (result.moleId === playerId) card.classList.add('is-mole');
      if (result.perjurers.includes(playerId)) card.classList.add('is-perjury');
    },

    stop() {
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}
