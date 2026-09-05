# DER TRESOR — Technische Architektur

> Version 1.0 · Verbindlich für Claude Code. Stack, Performance-Regeln, Layout, Dev-Tools, Deployment und Sicherheitsregeln sind **identisch zu Drinkshot** (`docs/03-ARCHITECTURE.md` dort, §1, §7–§12). Dieses Dokument wiederholt die Kurzfassung und beschreibt alles, was für Der Tresor anders oder neu ist. Abweichungen → 5-Zeilen-ADR in `docs/DECISIONS.md`.

---

## 1. Stack (Kurzfassung)

Vite 6 · TypeScript 5 strict · **PixiJS v8** (Bühne) · **GSAP 3** (Timelines) · Vanilla TS + HTML/CSS für Screens · eigener Store + FSM · howler.js · `crypto.getRandomValues` + seedbarer PRNG (mulberry32) · `simplex-noise` (Laser-Wobble) · vite-plugin-pwa · Vitest · Playwright · ESLint/Prettier · GitHub Pages (`base: '/Tresor/'`).

Bundle-Ziel: ≤ 450 KB JS gzip, Initial-Assets ≤ 1 MB. Reveal-Chunk lazy während NEGOTIATION laden.

**Code-Sharing mit Drinkshot:** v1 ist ein eigenständiges Repo. Module, die 1:1 aus Drinkshot übernommen werden können, werden **kopiert** (nicht als Package verlinkt): `core/store.ts`, `core/rng.ts`, `core/i18n.ts`, `ui/router.ts`, `ui/components/*`, `game/Shotling.ts`, `game/fx/ParticlePool.ts`, `game/fx/SpeechBubble.ts`, `audio/AudioManager.ts`, `styles/tokens.css` (angepasst), `scripts/*`. Wenn Drinkshot noch nicht so weit ist, werden diese Module hier zuerst gebaut und später nach Drinkshot zurückkopiert. Ein gemeinsames `@party/core`-Package ist **gestrichen** (ADR-37) — es würde das Schwesterprojekt verändern, und dieses Repo ist das einzige, an dem wir arbeiten. Stattdessen hält `tests/unit/boundaries.test.ts` den Schnitt offen: Die Infrastruktur (`core/rng.ts`, `core/store.ts`, `core/i18n.ts`, `ui/animate.ts`, `ui/haptics.ts`, `ui/wakeLock.ts`, `ui/components/*`, `game/fx/ParticlePool.ts`, `game/fx/SpeechBubble.ts`, `game/fx/SipCounter.ts`, `audio/AudioManager.ts`) darf **nichts** aus dem Regelkern oder von den Screens importieren, und die Spielerfarben werden zwischen `theme.ts`, `tokens.css` und `scripts/check-colors.mjs` abgeglichen.

---

## 2. Ordnerstruktur

```
Tresor/
├─ CLAUDE.md
├─ README.md
├─ docs/  (01-GDD, 02-ART-DIRECTION, 03-ARCHITECTURE, 04-ROADMAP, 05-AUDITS, DECISIONS, PROGRESS, screens/)
├─ index.html · vite.config.ts · tsconfig.json · package.json
├─ public/ (manifest, icons, fonts, atlas/ [back|crooks|front, ADR-14], audio/)
├─ assets-src/svg/{crooks,cards,vault,room/{back,front},props,kassel,dom}/ · audio-src/
├─ scripts/ (build-atlas.mjs, build-audio-sprite.mjs, build-icons.mjs, check-colors.mjs)
├─ src/
│  ├─ main.ts
│  ├─ config/
│  │  ├─ theme.ts          # Tokens (Art Direction §2, §3)
│  │  ├─ rules.ts          # V_0, Wachstum, Deckel, Gebühr, Modi-Parameter, Spielerlimits
│  │  └─ choreo.ts         # Reveal-Timing-Presets, Tempo-Kurve, Stocken-Regeln
│  ├─ core/
│  │  ├─ types.ts         # Datenmodell aus §4 (ADR-6: eigene Datei, sonst Zyklus)
│  │  ├─ store.ts · fsm.ts · rng.ts · i18n.ts
│  │  ├─ payout.ts         # resolveRound(): Auszahlung für n, V, Wahlen, Modi → RoundResult  (REINE FUNKTION)
│  │  ├─ vault.ts          # Tresor-Ökonomie: nextVault(), isJackpot()
│  │  ├─ modes.ts          # Maulwurf-Zuweisung, Eid-Regeln, Nachtschicht-Flags
│  │  ├─ choreographer.ts  # buildRevealScript(): Reihenfolge + Timing der Karten + Outcome-Auswahl
│  │  └─ session.ts        # Spieler, Runden, Scoreboard, Vertrauens-Index, Persistenz
│  ├─ ui/
│  │  ├─ router.ts · components/ (button, badge, choiceCard, vaultWidget, countdownRing, sheet, toast, flipCounter)
│  │  └─ screens/ (Title, Lobby, Negotiation, Pass, Choice, Sealed, Reveal, Distribute, Result, SettingsSheet, RulesSheet)
│  ├─ game/                 # PIXI-Bühne
│  │  ├─ stageModules.ts    # eine Liste aller Zeichen-Module + Vorlauf (ADR-41)
│  │  ├─ StageApp.ts        # PIXI-Singleton, Resize, Ticker→GSAP, warmStageApp()
│  │  ├─ VaultRoom.ts       # Wand, Laser, Tresor, Tisch, Spotlight, Vignette, Alarm-Modus
│  │  │                     # baut und besitzt zugleich die Buehne (Crooks, Karten, Kassel)
│  │  ├─ layout.ts          # Halbkreis-Layout als reine Funktion (Audit A2 als Unit-Test)
│  │  ├─ Vault.ts           # Tresor-Sprite mit Rad/Tür/Münzstapel, open()/close()/grow()/drain()/burst()
│  │  ├─ Crook.ts           # Shotling + Maske/Shirt/Bag-Slots, Blickregie, Gesichter
│  │  ├─ Kassel.ts          # NPC mit Sprechblasen-Queue
│  │  ├─ DecisionCard.ts    # Karte auf dem Tisch: lift(), flip(stalls[]), seal, moleHelmet
│  │  ├─ Camera.ts          # Zoom/Schwenk/Shake
│  │  ├─ RevealDirector.ts  # spielt RevealScript ab → Cards/Crooks/Kassel/Audio → dann Outcome
│  │  ├─ fx/ (ParticlePool, CoinRain, Confetti, SpeechBubble, Stamp, AlarmOverlay)
│  │  └─ outcomes/
│  │     ├─ OutcomeSequence.ts   # Interface + Registry + gewichtete Auswahl + No-Repeat
│  │     ├─ share/GroupHug.ts, Toast.ts
│  │     ├─ soloSteal/Getaway.ts, Moonwalk.ts, Magician.ts
│  │     ├─ multiSteal/TugOfWar.ts, Anvil.ts, Standoff.ts
│  │     ├─ allSteal/Brawl.ts, Alarm.ts
│  │     ├─ jackpot/Burst.ts
│  │     └─ overlays/PerjurySealBreak.ts, MoleReveal.ts
│  ├─ audio/ (AudioManager.ts, sprite.json)
│  ├─ i18n/ (de.json, en.json)
│  └─ styles/ (tokens.css, base.css, components.css)
├─ tests/
│  ├─ unit/payout.test.ts, vault.test.ts, modes.test.ts, choreographer.test.ts, fsm.test.ts, outcomeRegistry.test.ts
│  └─ e2e/flow.spec.ts, perf.spec.ts
└─ .github/workflows/ci.yml, deploy.yml
```

---

## 3. Game-State-Machine

```
TITLE ─start─► LOBBY ─open(players≥3)─► NEGOTIATION ─proceed(timeout|allReady)─► PASS(i=0)
                 ▲                          (Nachtschicht: SILENCE 10 s statt NEGOTIATION,
                 │                           eigener State mit denselben Kanten — ADR-9)
                 │                                                          │ tap
                 │                                                       CHOICE(i) ─choose─► i<n-1 ? PASS(i+1) : SEALED
                 │                                                                                         │ tap → resolveRound()
                 │                                                                                       REVEAL
                 │                                                                                         │ showFinished
                 │                                                     k==1 ? DISTRIBUTE ─payout─► RESULT : RESULT
                 └────────────── changePlayers ────────────────────────────────────────────────────────────┘
                                                                     nextRound → NEGOTIATION
```

- `resolveRound()` (aus `core/payout.ts`) läuft **genau einmal** beim Übergang SEALED→REVEAL. Es ist eine reine Funktion: `(players, choices, vault, settings, seed) → RoundResult`. REVEAL liest nur.
- Bei Maulwurf-Modus wird der Maulwurf beim Übergang LOBBY/RESULT→NEGOTIATION mit `crypto`-RNG gezogen und in `round.moleId` gespeichert; der CHOICE-Screen des Maulwurfs zeigt nur STEHLEN.
- DISTRIBUTE ist ein DOM-Screen; sein Ergebnis (`distribution`) wird in `RoundResult.drinkers` geschrieben, bevor RESULT betreten wird.
- Back-Button in NEGOTIATION/PASS/CHOICE/REVEAL → "Runde abbrechen?"-Dialog.

---

## 4. Datenmodell

```ts
type Choice = 'share' | 'steal';

interface Player { id: string; name: string; colorId: ColorId; outfit: { mask: true; stripes: boolean; hatId?: HatId } }

interface Settings {
  modes: { oath: boolean; mole: boolean; nightShift: boolean; highroller: boolean };
  hardness: 'soft'|'normal'|'hard';         // V_0, Wachstum, Deckel
  negotiationSec: 15|30|60;
  revealPace: 'short'|'normal'|'long';
  thinkTimerSec: 0|5;
  sound: boolean; music: number; haptics: boolean; lowEffects: boolean; locale: 'de'|'en';
}

interface RoundSetup {
  index: number;               // 1-basiert
  vault: number;               // V zu Rundenbeginn
  seed: number;                // Choreo + Outcome-Auswahl
  moleId?: string;
  oaths: string[];             // Spieler-IDs, die geschworen haben (Eid-Modus)
  choices: Record<string, Choice>;
}

type Outcome = 'allShare' | 'jackpot' | 'soloSteal' | 'multiSteal' | 'allSteal';

interface RoundResult extends RoundSetup {
  outcome: Outcome;
  thieves: string[];           // Reihenfolge = Reveal-Reihenfolge der Diebe
  sharers: string[];
  perjurers: string[];         // geschworen + gestohlen
  drinkers: { playerId: string; sips: number; reason: 'fee'|'jackpot'|'distributed'|'split'|'perjury' }[];
  distributorId?: string;      // bei soloSteal: der Dieb (füllt drinkers nach DISTRIBUTE)
  distributableSips?: number;  // bei soloSteal: sein Budget (V, bei Meineid V−2)
  revealOrder: string[];       // vollständige Karten-Reihenfolge (Teiler zuerst)
  outcomeSequenceId: string;
  overlayIds: string[];        // z. B. ['perjury_seal_break', 'mole_reveal']
  nextVault: number;
}

interface Session { players: Player[]; settings: Settings; rounds: RoundResult[]; vault: number }
```

Persistenz `localStorage['tresor.session.v1']`, History max. 100 Runden (Statistik braucht sie).

---

## 5. Auszahlungslogik (`core/payout.ts`) — Spezifikation für Tests

```
k = |{p : choices[p] == 'steal'}|
n = |players|

k == 0:
  if vault >= V_max(hardness):  outcome = 'jackpot'; jeder trinkt ceil(vault / n) (reason 'jackpot'); nextVault = V_0
  else:                         outcome = 'allShare'; jeder trinkt 1 (reason 'fee'); nextVault = min(vault + growth, V_max)
k == 1:
  outcome = 'soloSteal'; distributorId = Dieb; drinkers werden in DISTRIBUTE gefüllt (Summe == vault, nur Teiler)
  Eid: ist der Dieb Meineidiger → er trinkt 2 (reason 'perjury'), verteilt nur vault - 2 (min 0)
  nextVault = V_0
k >= 2:
  outcome = k == n ? 'allSteal' : 'multiSteal'
  jeder Dieb trinkt ceil(vault / k) (reason 'split')
  Eid: Meineidiger trinkt das Doppelte
  Maulwurf: trinkt ceil(ceil(vault/k) / 2); Maulwurf ist nie Meineidiger
  nextVault = V_0
```

Unit-Tests müssen abdecken: n ∈ {3..8} × k ∈ {0..n} × hardness × alle Modus-Kombinationen; Invarianten: bei `soloSteal` Summe der Verteilung == vault (− 2 bei Meineid); nie negative Schlücke; `nextVault ∈ [V_0, V_max]`; Maulwurf ist immer in `thieves`.

---

## 6. Choreographer (`core/choreographer.ts`)

**Input:** `RoundResult`, `settings.revealPace`, `seed` → **Output:** `RevealScript`

```ts
interface RevealScript {
  totalMs: number;
  beats: Beat[];
}
type Beat =
  | { t: number; type: 'intro' }
  | { t: number; type: 'card'; playerId: string; choice: Choice; holdMs: number; stalls: number[]; isLast: boolean; overlay?: 'oathSeal' }
  | { t: number; type: 'alarm' }                       // nach erstem STEHLEN
  | { t: number; type: 'outcome'; sequenceId: string; overlayIds: string[] }
  | { t: number; type: 'outro' };
```

Regeln: Reihenfolge = `sharers` (seeded Permutation) dann `thieves` (seeded Permutation; Maulwurf immer letzter Dieb). `holdMs` folgt der Tempo-Kurve (Art Direction §7), letzte Karte 160 %, `stalls = [0.6]` bzw. `[0.6, 0.85]` für die letzte. Gesamtdauer-Deckel 40 s → Raffung der frühen Karten. Outcome-Sequenz per gewichteter Auswahl aus der Registry mit No-Repeat-Fenster 3 pro Outcome-Typ. Deterministisch bei Seed (Test).

`RevealDirector` spielt das Skript als **eine** GSAP-Timeline ab; Tap-to-Skip springt an das Ende des aktuellen `card`-Beats (`timeline.seek(nextBeat.t)`), außer bei `isLast` oder `outcome`.

---

## 7. OutcomeSequence-Interface

```ts
interface OutcomeContext {
  result: RoundResult; crooks: Map<string, Crook>; thieves: Crook[]; sharers: Crook[];
  vault: Vault; room: VaultRoom; kassel: Kassel; camera: Camera; fx: FxKit; audio: AudioManager; rng: SeededRng;
}
interface OutcomeSequence {
  id: string; outcome: Outcome; weight: number;
  build(ctx: OutcomeContext): gsap.core.Timeline;   // inkl. Sound-Cues, endet mit "Zähler zeigt Schlücke pro Trinker"
}
interface OverlaySequence { id: 'perjury_seal_break'|'mole_reveal'; buildOnCard(ctx, card: DecisionCard, crook: Crook): gsap.core.Timeline }
```

Tests pro Sequenz: Dauer 2–8 s, keine Exceptions, alle Crooks nach `reset()` wieder `idle`. Dev-Preview für jede Sequenz und jedes Overlay.

---

## 8. Screens: DOM vs. Canvas

DOM: Title, Lobby, Negotiation (inkl. Tresor-Widget als SVG/CSS — kein PIXI nötig), Pass, Choice, Sealed, Distribute, Result, Sheets.
Canvas (PIXI): nur REVEAL. Das PIXI-App-Singleton wird **während NEGOTIATION/SILENCE** erzeugt und über die ganze Session wiederverwendet — nicht erst beim Betreten der Aufdeckung (ADR-41). Dort kostete `Application.init()` rund 280 ms in einem einzigen Frame, und zwar genau zwischen „Tresor öffnen" und der ersten Karte.

Der Vorlauf läuft über `game/stageModules.ts` in drei Schritten, und die Reihenfolge ist bindend:

1. **Alle Zeichen-Module** (`loadStageModules()`). PIXI bindet `renderer.renderPipes` beim Anlegen des Renderers an die bis dahin registrierten Erweiterungen; jede Zeichen-Klasse registriert ihre Pipe beim Auswerten ihres Moduls. Ein Renderer, der vor `VaultRoom` & Co. entsteht, hat deren Pipes für immer nicht — die Show stirbt im ersten Frame.
2. **Atlanten** (`loadStageAssets()`), damit Bild-Dekodierung und Shader-Übersetzung nicht um dieselbe CPU konkurrieren.
3. **Renderer** (`warmStageApp()`), gewärmt an einem Wegwerf-Objekt außerhalb der Bühne — Fläche plus je ein Sprite pro Atlas, womit auch die Texturen hier auf die GPU wandern.

`stageModules.ts` ist die **einzige** Stelle, die diese Module lädt; `RevealScreen` und die Outcome-Vorschau ziehen dieselbe Liste. `tests/unit/boundaries.test.ts` hält das fest.

Das Tresor-Widget existiert damit zweimal (DOM-Version für Negotiation/Result, PIXI-Version für die Bühne). Beide nutzen dieselben SVG-Quellen aus `assets-src/svg/vault/` — die DOM-Version als Inline-SVG mit CSS-Animationen, die PIXI-Version aus dem Atlas. Das ist bewusst: ein PIXI-Canvas im Negotiation-Screen wäre Overkill.

---

## 9. Performance, Layout, Dev-Tools, Sicherheit, Deployment

Identisch zu Drinkshot §7–§12 (PIXI-Singleton, resolution ≤ 2, Atlanten, Pools, Filter nur temporär, eine Uhr, visibilitychange, Low-Effects-Auto-Detect, logische 1000×1000-Welt, Desktop-Portrait-Frame, `?dev=1`-Panel mit Outcome-Preview + Seed-Eingabe + "Simulate 10 000 rounds" für Payout-Verteilung, CSP, GitHub Pages).

Perf-Test: REVEAL mit 8 Spielern, Outcome `multiSteal/TugOfWar`, CPU 4×: p50 ≤ 20 ms, p95 ≤ 40 ms, ≤ 2 Long-Tasks.
