import { defineConfig, devices } from '@playwright/test';

/**
 * Mobile-Emulation ist Pflicht (CLAUDE.md "Mobile First").
 * Ab M1 laeuft `flow.spec.ts`, ab M3 `perf.spec.ts` (Architektur §9).
 */
export default defineConfig({
  testDir: './tests/e2e',
  /*
   * Bewusst nicht parallel: Ab M3 spielen die Tests eine 15-40 s lange Reveal-Show in
   * Echtzeit ab und messen dabei Wartezeiten. Zwei davon gleichzeitig nehmen sich die
   * CPU weg — die Zeitmessungen werden falsch und leichte Tests flaky.
   */
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /*
   * Playwrights Standard von 5 s geht von statischen Seiten aus. Hier haengt fast jede
   * Zusicherung hinter einer Animation: 320 ms Wipe, 260 ms Sheet, dazu der Aufbau des
   * Tresorraums. Zehn Sekunden finden echte Haenger und reparieren keine gesunden Tests.
   */
  expect: { timeout: 10_000 },
  /*
   * Playwrights Standard von 30 s reicht hier nicht: Ein Test, der drei komplette Runden
   * spielt, deckt allein 12 Karten in Echtzeit auf.
   *
   * Fuenf Minuten statt zwei, weil die Show nicht ueberall gleich lang dauert: PixiJS
   * deckelt `ticker.deltaMS` bei `maxElapsedMS` = 100 ms, und der Ticker treibt GSAP.
   * Wo ein Frame laenger braucht, bekommt die Show weniger Zeit gutgeschrieben, als real
   * vergeht — auf dem CI-Runner, der in Software zeichnet, dauert sie rund die Haelfte
   * laenger (siehe `AFTER_SHOW_MS` in `helpers.ts`). Drei Runden passten dort nicht mehr
   * in zwei Minuten. Fuenf sind immer noch kurz genug, um einen echten Haenger zu finden:
   * Der langsamste Testlauf hier braucht sieben Minuten fuer **dreiundzwanzig** Faelle.
   */
  timeout: 300_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4173/Tresor/',
    trace: 'on-first-retry',
  },
  /*
   * Die Geraetematrix aus CLAUDE.md "Referenzgeraete" (Roadmap M6.3).
   *
   * Primaer sind die beiden Handys — sie fahren jede Suite. iPad und Desktop sind
   * sekundaer und laufen nur den Flow: Dort geht es um Layout und Bedienbarkeit im
   * Portrait-Rahmen, nicht um Bildraten. Wer sie in `perf.spec.ts` mitlaufen liesse,
   * wuerde einen Desktop-Browser gegen ein Handy-Budget messen.
   */
  projects: [
    { name: 'iPhone 12', use: { ...devices['iPhone 12'] } },
    {
      name: 'Pixel 5',
      use: {
        ...devices['Pixel 5'],
        launchOptions: {
          /*
           * Ohne diese Flags rendert Headless-Chromium per SwiftShader in Software.
           * Die Buehne laeuft dann mit 30 statt 60 fps — eine Eigenschaft des
           * Testrechners, nicht des Spiels. `perf.spec.ts` (M3) erkennt das und sagt es.
           */
          args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist'],
        },
      },
    },
    {
      name: 'iPad Mini',
      testMatch: /flow\.spec\.ts/,
      use: { ...devices['iPad Mini'] },
    },
    {
      name: 'Desktop Chrome',
      testMatch: /flow\.spec\.ts/,
      // Desktop laeuft im Portrait-Rahmen (Architektur §9) — ein schmales Fenster zeigt,
      // ob der Rahmen haelt.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/Tresor/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
