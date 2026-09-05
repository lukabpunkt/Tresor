/**
 * Grenzen im eigenen Repo (Standing Audit).
 *
 * Der Backlog wollte einmal ein geteiltes `@party/core`-Paket mit dem Schwesterprojekt.
 * Das ist gestrichen (ADR-37) — es braucht ein zweites Repo, und dieses hier ist das
 * einzige, das uns gehört. Das **Problem** dahinter bleibt aber echt und liegt komplett
 * innerhalb dieser Codebasis:
 *
 * 1. **Dieselbe Zahl an drei Stellen.** Die acht Spielerfarben stehen in `theme.ts`,
 *    in `tokens.css` und noch einmal im Farb-Audit-Skript. Ändert jemand eine davon,
 *    prüft das Audit stillschweigend eine Palette, die es nicht mehr gibt.
 * 2. **Infrastruktur, die anfängt, das Spiel zu kennen.** Store, RNG, Router-Bausteine,
 *    Partikel-Pool und Audio-Apparat wissen heute nichts von Tresoren und Dieben. Diese
 *    Trennung hält von allein keinen Monat — es genügt ein bequemer Import.
 *
 * Beides prüft dieser Test. Er ersetzt kein Paket; er hält den Schnitt offen, an dem man
 * eines Tages trennen könnte, und verhindert bis dahin das, wovor das Paket schützen
 * sollte.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYER_COLORS, UI_COLORS } from '@/config/theme';

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), 'utf8');
const hex6 = (value: number): string => value.toString(16).padStart(6, '0');

/* ------------------------------------------------------------------ */
/* 1. Eine Quelle für die Spielerfarben                                */
/* ------------------------------------------------------------------ */

describe('Spielerfarben stehen überall gleich', () => {
  /** `--c-player-red: #ff4757;` → `{ red: 'ff4757' }` */
  function cssPalette(suffix = ''): Record<string, string> {
    const css = read('src/styles/tokens.css');
    const pattern = new RegExp(`--c-player-([a-z]+)${suffix}:\\s*#([0-9a-fA-F]{6})`, 'g');
    const out: Record<string, string> = {};
    for (const match of css.matchAll(pattern)) {
      // Ohne Suffix würde `--c-player-red-shade` als Farbe "red" durchgehen.
      if (suffix === '' && /-shade/.test(match[0])) continue;
      out[match[1]!] = match[2]!.toLowerCase();
    }
    return out;
  }

  it('stimmt zwischen theme.ts und tokens.css überein', () => {
    const base = cssPalette();
    const shades = cssPalette('-shade');

    expect(Object.keys(base).sort()).toEqual(PLAYER_COLORS.map((c) => c.id).sort());
    for (const color of PLAYER_COLORS) {
      expect(base[color.id], `${color.id} (Grundfarbe)`).toBe(hex6(color.hex));
      expect(shades[color.id], `${color.id} (Schatten)`).toBe(hex6(color.shade));
    }
  });

  /**
   * Das Farb-Audit ist ein Node-Skript und kann `theme.ts` nicht importieren — es hat
   * deshalb eine eigene Kopie der Tabelle. Das ist vertretbar, solange **dieser** Test
   * beweist, dass die Kopie stimmt. Ohne ihn prüft `npm run check:colors` irgendwann
   * eine Palette, die im Spiel längst nicht mehr vorkommt (Lila wurde schon einmal
   * geändert, ADR-8).
   */
  it('stimmt zwischen theme.ts und dem Farb-Audit überein', () => {
    const script = read('scripts/check-colors.mjs');

    const entries = [...script.matchAll(/\{\s*id:\s*'([a-z]+)',\s*hex:\s*0x([0-9a-f]{6}),\s*symbol:\s*'([a-z]+)'/g)];
    expect(entries.length, 'Tabelle im Skript nicht gefunden').toBe(PLAYER_COLORS.length);

    entries.forEach((match, index) => {
      const expected = PLAYER_COLORS[index]!;
      expect(match[1], `Reihenfolge bei Index ${index}`).toBe(expected.id);
      expect(match[2], `${expected.id}: Farbwert`).toBe(hex6(expected.hex));
      expect(match[3], `${expected.id}: Symbol`).toBe(expected.symbol);
    });
  });

  it('hält den Samt-Hintergrund in allen drei Quellen gleich', () => {
    const script = read('scripts/check-colors.mjs');
    const inScript = /const VELVET = 0x([0-9a-f]{6})/.exec(script)?.[1];
    const inCss = /--c-velvet:\s*#([0-9a-fA-F]{6})/.exec(read('src/styles/tokens.css'))?.[1];

    expect(inScript).toBe(hex6(UI_COLORS.velvet));
    expect(inCss?.toLowerCase()).toBe(hex6(UI_COLORS.velvet));
  });
});

/* ------------------------------------------------------------------ */
/* 2. Infrastruktur kennt das Spiel nicht                              */
/* ------------------------------------------------------------------ */

describe('Infrastruktur kennt das Spiel nicht', () => {
  /**
   * Module ohne **jede** Projekt-Abhängigkeit. Sie ständen in jedem anderen Projekt
   * unverändert — genau das macht sie zur Infrastruktur, und genau das soll so bleiben.
   */
  const STANDALONE = [
    'src/core/rng.ts',
    'src/core/store.ts',
    'src/ui/wakeLock.ts',
    'src/ui/haptics.ts',
    'src/ui/components/button.ts',
    'src/ui/components/devPanel.ts',
    'src/game/fx/ParticlePool.ts',
  ] as const;

  /**
   * Module, die Werte aus `config/` ziehen dürfen — Farben, Zeiten, Budgets —, aber
   * niemals den Regelkern oder die Screens.
   *
   * Die Grenze verläuft zwischen *Werten* und *Begriffen*: Eine Sprechblase darf wissen,
   * welche Schriftgröße gilt. Sie darf nicht wissen, was ein Dieb ist.
   */
  const CONFIG_ONLY = [
    'src/core/i18n.ts',
    'src/ui/animate.ts',
    // Haengt an `animate`, nicht an config — aber ebenfalls an keinem Spielbegriff.
    'src/ui/components/toast.ts',
    'src/ui/components/sheet.ts',
    'src/ui/components/flipCounter.ts',
    'src/ui/components/countdownRing.ts',
    'src/ui/components/badge.ts',
    'src/ui/components/onboarding.ts',
    'src/game/fx/SpeechBubble.ts',
    'src/game/fx/SipCounter.ts',
    'src/audio/AudioManager.ts',
  ] as const;

  /** Alles, was der Regelkern und die Oberfläche des Spiels ausmacht. */
  const GAME_ONLY = /@\/(core\/(fsm|session|payout|vault|modes|types|choreographer|share|history)|game\/outcomes|ui\/screens|ui\/router)/;

  const importsOf = (path: string): string[] =>
    [...read(path).matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]!);

  it.each(STANDALONE)('%s hängt an keinem Projektmodul', (path) => {
    const projectImports = importsOf(path).filter((id) => id.startsWith('@/') || id.startsWith('.'));
    expect(projectImports, `${path} importiert aus dem Projekt`).toEqual([]);
  });

  it.each(CONFIG_ONLY)('%s kennt nur config/ und die Infrastruktur', (path) => {
    const offenders = importsOf(path).filter((id) => GAME_ONLY.test(id));
    expect(offenders, `${path} greift in den Spielkern`).toEqual([]);
  });

  it('prüft jede Datei, die es zu prüfen gibt', () => {
    // Ein Pfad, der umbenannt wird, darf nicht still aus der Prüfung fallen.
    for (const path of [...STANDALONE, ...CONFIG_ONLY]) {
      expect(() => read(path), `${path} existiert nicht mehr`).not.toThrow();
    }
  });
});

/* ------------------------------------------------------------------ */
/* 3. Eine Liste der Bühnen-Module                                     */
/* ------------------------------------------------------------------ */

/**
 * PixiJS bindet seine Render-Pipes an den Renderer, sobald dieser entsteht: Jede
 * Zeichen-Klasse registriert ihre Pipe beim Auswerten ihres Moduls, und was danach
 * geladen wird, fehlt diesem Renderer für immer. Seit dem Vorlauf (ADR-41) entsteht der
 * Renderer schon während der Verhandlung — also muss dort **dieselbe** Modulmenge
 * geladen sein wie später in der Aufdeckung.
 *
 * Zwei Listen wären hier kein Tippfehler-Risiko, sondern ein toter Reveal: Wer ein Modul
 * nur in der Aufdeckung nachlädt, bekommt einen Renderer ohne dessen Pipe, und die Show
 * stirbt im ersten Frame mit `renderPipes[renderPipeId]` = `undefined` — ein Fehler, der
 * nach PixiJS aussieht und in Wahrheit eine Reihenfolge im Chunk-Splitting ist. Genau das
 * hat ADR-40 gekostet.
 *
 * Deshalb ist `stageModules.ts` die einzige Stelle, die Bühnen-Module nachlädt.
 */
describe('Bühnen-Module werden an einer Stelle geladen', () => {
  const LOADER = 'src/game/stageModules.ts';

  /** Alle `.ts` unterhalb eines Verzeichnisses, rekursiv. */
  const sources = (dir: string): string[] =>
    readdirSync(join(root, dir)).flatMap((entry) => {
      const path = `${dir}/${entry}`;
      if (statSync(join(root, path)).isDirectory()) return sources(path);
      return path.endsWith('.ts') ? [path] : [];
    });

  it('nur der Loader lädt sie nach', () => {
    /*
     * Erlaubt bleibt genau ein dynamischer Import: der auf den Loader selbst. Er hält
     * den Bühnen-Chunk aus dem Einstiegs-Bundle heraus (ADR-15) — die Screens dürfen ihn
     * anstoßen, nur eben nicht an ihm vorbei.
     */
    /** Zielt der Import in `src/game/`? Auch als relativer Pfad von dort aus. */
    const intoStage = (from: string, id: string): boolean =>
      id.includes('game/') || (from.startsWith('src/game/') && id.startsWith('.'));

    const offenders = sources('src')
      .filter((path) => path !== LOADER)
      .filter((path) =>
        [...read(path).matchAll(/import\(\s*'([^']+)'/g)].some(
          (match) => intoStage(path, match[1]!) && !match[1]!.endsWith('/stageModules')
        )
      );
    expect(offenders, 'Bühnen-Modul am Loader vorbei nachgeladen').toEqual([]);
  });

  it('der Loader zieht alles, was gezeichnet wird', () => {
    const loader = read(LOADER);
    // Was `RevealScreen` und die Outcome-Vorschau später aus dem Chunk auspacken.
    for (const name of ['StageApp', 'VaultRoom', 'Camera', 'RevealDirector', 'registry', 'SipCounter']) {
      expect(loader, `${name} fehlt im Vorlauf`).toContain(name);
    }
  });
});
