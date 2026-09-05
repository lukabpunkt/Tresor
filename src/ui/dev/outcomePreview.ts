/**
 * Dev-Preview fuer die Inszenierungen (`npm run preview:outcomes`, Roadmap M4.1).
 *
 * Elf Sequenzen und zwei Overlays einzeln durchzuspielen hiesse sonst: elf Runden mit
 * genau der richtigen Kombination aus Wahlen, Tresorstand und Modi. Das macht niemand —
 * und was niemand ansieht, wird nicht gut.
 *
 * Die Preview haengt bewusst **neben** dem Router und der FSM: Sie baut sich ein
 * passendes Rundenergebnis selbst, stellt die Buehne auf und laesst jede Sequenz auf
 * Knopfdruck laufen. Zwischen zwei Laeufen `room.reset()` — genau die Invariante aus
 * Audit A4, hier von Hand nachpruefbar.
 *
 * Sie wird nur bei `?dev=1&panel=outcomes` dynamisch geladen und landet deshalb in einem
 * eigenen Chunk; die ausgelieferte App kennt sie nicht.
 */

import gsap from 'gsap';
import { STAGE } from '@/config/theme';
import { t, tList } from '@/core/i18n';
import { resolveRound } from '@/core/payout';
import { createSeededRng } from '@/core/rng';
import { createPlayer } from '@/core/session';
import type { Outcome, PlayerId, RoundResult } from '@/core/types';
import { vaultSpec } from '@/core/vault';
import { COLOR_IDS } from '@/config/theme';
import { DEFAULT_SETTINGS, type Settings } from '@/config/rules';
import { vaultFill } from '@/ui/components/vaultWidget';
import { unlockAudio, play as playCue } from '@/audio/AudioManager';
import type { OutcomeContext } from '@/game/outcomes/OutcomeSequence';
import { loadStageModules } from '@/game/stageModules';

const PLAYER_COUNT = 5;

/** Welche Wahlen zu welchem Ausgang fuehren — vier Diebe reichen fuer jeden Fall. */
const STEALS: Record<Outcome, boolean[]> = {
  allShare: [false, false, false, false, false],
  soloSteal: [true, false, false, false, false],
  multiSteal: [true, true, false, false, false],
  allSteal: [true, true, true, true, true],
  jackpot: [false, false, false, false, false],
};

export async function mountOutcomePreview(host: HTMLElement): Promise<void> {
  const {
    stageApp,
    room: roomModule,
    camera: cameraModule,
    sequence: sequenceModule,
    registry: registryModule,
    counter: counterModule,
  } = await loadStageModules();

  registryModule.registerAll();

  const assets = await stageApp.loadStageAssets();
  const stage = await stageApp.getStageApp();
  stage.clearWorld();

  const players = Array.from({ length: PLAYER_COUNT }, (_, i) =>
    createPlayer(`P${i + 1}`, COLOR_IDS[i % COLOR_IDS.length]!, i % 2 === 1)
  );
  const ids = players.map((player) => player.id);
  const settings: Settings = { ...DEFAULT_SETTINGS, modes: { ...DEFAULT_SETTINGS.modes, oath: true } };
  const spec = vaultSpec(settings);

  const rng = createSeededRng(1234);
  const room = new roomModule.VaultRoom({ assets, rng, lowEffects: false });
  stage.world.addChild(room.view);
  stage.overlay.addChild(room.light);
  const camera = new cameraModule.Camera(room.view);
  const counters = new counterModule.SipCounterPool();
  room.view.addChild(counters.view);

  const canvasHost = document.createElement('div');
  canvasHost.className = 'reveal__stage';
  host.append(canvasHost);
  stage.attach(canvasHost);
  stage.app.ticker.add((ticker) => room.update(ticker.deltaMS));

  /** Baut ein echtes Rundenergebnis fuer diesen Ausgang — keine erfundenen Zahlen. */
  function resultFor(outcome: Outcome): RoundResult {
    return resolveRound(
      ids,
      {
        choices: Object.fromEntries(
          ids.map((id, i) => [id, STEALS[outcome][i] ? 'steal' : 'share'])
        ) as Record<PlayerId, 'share' | 'steal'>,
        index: 1,
        vault: outcome === 'jackpot' ? spec.jackpotAt : spec.startVault + 3,
        seed: rng.int(0xffffffff),
        oaths: [ids[0]!],
      },
      settings
    );
  }

  let running: gsap.core.Timeline | undefined;

  function stop(): void {
    running?.kill();
    running = undefined;
    gsap.globalTimeline.getChildren().forEach((child) => child.kill());
    room.reset();
    // Die Zaehler haengen nicht am Raum — ohne das steht die Zahl der letzten Sequenz noch da.
    counters.reset();
  }

  function contextFor(result: RoundResult): OutcomeContext {
    const crooksOf = (list: readonly PlayerId[]) =>
      list.map((id) => room.crooks.get(id)).filter((crook): crook is NonNullable<typeof crook> => !!crook);
    const center = { x: STAGE.worldSize / 2, y: STAGE.worldSize / 2 };

    return {
      result,
      room,
      camera,
      thieves: crooksOf(result.thieves),
      sharers: crooksOf(result.sharers),
      cards: room.cards,
      counters,
      fx: room.fx,
      rng,
      play: (cue, when, detune) => playCue(cue, when, detune),
      positionOf: (id) => room.crooks.get(id)?.position ?? center,
      headOf: (id) => {
        const crook = room.crooks.get(id);
        return crook ? { x: crook.position.x, y: crook.position.y - crook.headOffset } : center;
      },
      say: (key, holdMs) => {
        const options = tList(`kassel.${key}`);
        room.kassel.say(options.length > 0 ? (options[rng.int(options.length)] ?? '') : t(`kassel.${key}`), holdMs);
      },
    };
  }

  /** Stellt die Buehne fuer diesen Ausgang neu auf und gibt den Kontext zurueck. */
  function prepare(outcome: Outcome): { result: RoundResult; ctx: OutcomeContext } {
    stop();
    const result = resultFor(outcome);
    room.populate({
      players,
      choices: result.choices,
      oaths: result.oaths,
      vaultFill: vaultFill(result.vault, spec),
    });
    /*
     * Karten sofort offen: Die Inszenierung setzt nach dem Aufdecken ein, und wer eine
     * Sequenz pruefen will, will nicht jedes Mal die ganze Aufdeckung davor sehen.
     * `progress(1)` spult den Flip ans Ende, statt ihn abzuspielen.
     */
    for (const card of room.cards.values()) {
      card.setSealed(false);
      card.flip().progress(1);
    }
    return { result, ctx: contextFor(result) };
  }

  function runSequence(id: string): void {
    const sequence = sequenceModule.outcomeById(id);
    if (!sequence) return;
    const { ctx } = prepare(sequence.outcome);
    running = sequence.build(ctx);
    status.textContent = `${id} · ${Math.round(running.duration() * 1000)} ms`;
    running.play(0);
  }

  function runOverlay(id: 'perjury_seal_break' | 'mole_reveal'): void {
    const overlay = sequenceModule.overlayById(id);
    if (!overlay) return;
    const { result, ctx } = prepare('multiSteal');
    const target = result.thieves[0] ?? ids[0]!;
    const card = room.cards.get(target);
    const crook = room.crooks.get(target);
    if (!card || !crook) return;
    running = overlay.buildOnCard(ctx, card, crook);
    status.textContent = `${id} · ${Math.round(running.duration() * 1000)} ms`;
    running.play(0);
  }

  /* ---------------------------------------------------------------- */
  /* Bedienfeld                                                        */
  /* ---------------------------------------------------------------- */

  const panel = document.createElement('div');
  panel.className = 'dev dev--outcomes';

  const status = document.createElement('p');
  status.className = 'dev__status';
  status.textContent = t('app.title');

  const controls = document.createElement('div');
  controls.className = 'dev__controls';

  const button = (label: string, onClick: () => void): void => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'dev__button';
    el.textContent = label;
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      void unlockAudio();
      onClick();
    });
    controls.append(el);
  };

  for (const sequence of registryModule.ALL_OUTCOMES) {
    button(sequence.id.replace(/^(share|steal|jackpot)_/, ''), () => runSequence(sequence.id));
  }
  for (const overlay of registryModule.ALL_OVERLAYS) {
    button(`+ ${overlay.id.replace(/_/g, ' ')}`, () => runOverlay(overlay.id));
  }
  button('reset', () => {
    stop();
    status.textContent = 'reset';
  });

  panel.append(status, controls);
  host.append(panel);

  // Eine Sequenz steht schon bereit — sonst startet die Preview auf einer leeren Buehne.
  prepare('allShare');
}
