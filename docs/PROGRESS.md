# Fortschritt

| Meilenstein | Status | Tag | Audit |
|---|---|---|---|
| M0 Setup & Regelkern | ✅ fertig (⏳ 3 manuelle Checks offen) | `v0.0.1` | A0 bestanden |
| M1 UI-Flow | ✅ fertig (⏳ 2 manuelle Checks offen) | `v0.1.0` | A1 bestanden |
| M2 Bühne, Crooks, Tresor | ✅ fertig (⏳ 2 manuelle Checks offen) | `v0.2.0` | A2 bestanden |
| M3 Reveal-Show | ✅ fertig (⏳ 2 manuelle Checks offen) | `v0.3.0` | A3 bestanden |
| M4 Inszenierungen | ⬜ offen | – | – |
| M5 Polish, Modi, A11y | ⬜ offen | – | – |
| M6 Playtest & Release | ⬜ offen | – | – |

## Audit-Reports

## Audit A0 — 2026-09-04

**Ergebnis:** BESTANDEN (alle automatisierbaren MUSS-Checks grün; 3 Checks brauchen Lukas Gerät bzw. GitHub)

| Check | Status | Notiz |
|---|---|---|
| Struktur entspricht Architektur §2 | ✅ | Alle Ordner und Dateien aus §2 vorhanden. Ergänzt um `src/core/types.ts` (ADR-6), `scripts/build-icons.mjs` (ADR-10) und Standard-Tooling (`vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `.prettierrc.json`, `src/vite-env.d.ts`). Noch leere Ordner (`assets-src/svg/*`, `public/atlas`, `public/audio`, `audio-src`) sind per `.gitkeep` sichtbar; die Dateien in `src/ui/`, `src/game/` und `src/audio/` entstehen in M1–M3. Architektur §2/§3/§4 wurden entsprechend nachgezogen. |
| `rules.ts`/`choreo.ts` enthalten die GDD-Werte | ✅ | `tests/unit/config.test.ts` (51 Tests) rechnet die Tabellen gegen die Dokumente: V_0 3/4/6, Wachstum +2/+2/+3, Deckel 12/16/20, Gebühr 1, Highroller 6/+4/Jackpot 24, Meineid 2 bzw. ×2, Maulwurf ÷2, Verhandlung 15/30/60 s, Nachtschicht 10 s, Bedenkzeit 0/5 s; Presets 1.8/2.8/3.8 s, Tempo-Kurve 100→70 %, letzte Karte 160 %, Stalls, 40-s-Deckel, No-Repeat-Fenster 3. Zusätzlich wird geprüft, dass `tokens.css` dieselben 17 UI-Farben und 8 Spielerfarben führt wie `theme.ts` — die beiden können nicht mehr auseinanderlaufen. |
| `payout.ts`-Matrix: n 3–8 × k 0–n × Härte × Modi grün | ✅ | `tests/unit/payout.test.ts`: 3 Härten × 6 Spielerzahlen × k 0–n = 162 Matrix-Tests, dazu alle 16 Modus-Kombinationen × k 0–5 = 96 Tests. |
| Property-Test 10 000 Runden ohne Invarianten-Verletzung | ✅ | Ein Lauf über 10 000 zufällige Runden (Spielerzahl, Härte, alle vier Modi, Tresorstand, Wahlen, Schwüre, Maulwurf) prüft: nie negative oder gebrochene Schlücke, jede Karte genau einmal in `revealOrder`, Teiler vor Dieben, Maulwurf letzter Dieb und nie Meineidiger, `nextVault` im erlaubten Bereich, Summe der Verteilung == Budget. Alle fünf Outcomes treten dabei auf. **Fund:** Der erste Lauf schlug fehl, weil der Generator Tresorstände unterhalb von V_0 erzeugte — ein im Spiel unerreichbarer Zustand. Domäne auf erreichbare Stände eingeschränkt und begründet. |
| Beispiele aus GDD §3.5 als explizite Tests | ✅ | n=4, V=8: k=1 → verteilt 8; k=2 → je 4; k=4 → je 2; k=0 → je 1 Gebühr, V→10. Wörtlich als eigener `describe`-Block. |
| Eid: Alleindieb mit Meineid trinkt 2 und verteilt V−2; Mit-Dieb doppelt | ✅ | Inklusive Randfall V=1 (Budget 0, nie negativ), „geschworen und geteilt ist kein Meineid" und „ohne Eid-Modus kein Meineid, auch mit gefüllten `oaths`". |
| Maulwurf: immer in `thieves`, halbe Strafe, nie Meineidiger, Zuweisung nutzt `crypto` | ✅ | `resolveRound` erzwingt die Wahl des Maulwurfs, unabhängig von der UI — die Invariante hält damit per Konstruktion. `assignMole` ist über 40 000 Ziehungen gleichverteilt (Abweichung < 1 Prozentpunkt) und ruft nachweislich `crypto.getRandomValues`, nie `Math.random`. Kombination Eid + Maulwurf: volle Strafe für den anderen Dieb, halbe für den Maulwurf, keine Meineid-Strafe für ihn. |
| Jackpot: bei V == V_max und k == 0 → jeder ⌈V/n⌉, Reset | ✅ | Für alle drei Härten plus Highroller (kein Deckel, Wachstum über 24 hinaus, platzt ab 24). Gegenprobe: voller Tresor mit Dieb ist kein Jackpot. |
| Choreographer: Teiler zuerst, Diebe zuletzt, Maulwurf letzter Dieb, deterministisch, 40-s-Deckel, Stalls | ✅ | `tests/unit/choreographer.test.ts` (38 Tests). Der 40-s-Deckel wird für jede Kombination aus 3–8 Spielern, k 0–n und allen drei Presets geprüft. **Befund:** Die Raffung greift im echten Spiel nie — 8 Spieler auf „Lang" landen bei 37,8 s. Sie ist ein Sicherheitsnetz und wird deshalb separat mit synthetischen Kartenzahlen (20 und 60) getestet; ein Test hält fest, dass die realen Spielerzahlen ungerafft bleiben. Tap-to-Skip: nie bei Intro/Alarm/Outcome/Outro, nie bei der ersten und nie bei der letzten Karte. |
| `Math.random` in `src/core/` → 0 Treffer | ✅ | Doppelt abgesichert: ESLint-Regel `no-restricted-properties` für `src/core/**` und ein Unit-Test in `guards.test.ts`, der die Dateien ohne Kommentare durchsucht. |
| FSM-Branch-Coverage 100 %, `core/` ≥ 95 % | ✅ | v8-Coverage: `fsm.ts` 100 % Statements/Branches/Functions/Lines, `core/` gesamt 99,7 % Statements und 97,6 % Branches. Beide Schwellen sind in `vitest.config.ts` erzwungen, CI bricht sonst ab. 58 FSM-Tests decken jeden Pfeil des Diagramms ab, dazu die Guards (≥ 3 Spieler), jedes unzulässige Event je State und die Zusicherung „`resolveRound` genau einmal pro Runde" (über drei Runden gezählt; wer aus SEALED abbricht, löst nie auf). |
| PWA installierbar | ✅ | Chrome DevTools Protocol gegen den Preview-Build (Pixel-5-Emulation): `Page.getAppManifest` → `errors: []`, `Page.getInstallabilityErrors` → `installabilityErrors: []`. Service Worker aktiv mit Scope `/Tresor/`. Icons aus `assets-src/svg/app-icon.svg` gebaut (192, 512, maskable 512 mit 20 % Safe Zone, Apple-Touch 180). |
| Desktop zeigt Portrait-Frame | ✅ | Screenshot `docs/screens/m0-desktop.png`: 9:16-Rahmen, max. 480 px, 32 px Radius, Gold-/Samt-Hintergrund. |
| E2E: App startet ohne Console-Fehler, keine externen Requests | ✅ | `tests/e2e/flow.spec.ts`, 4 Szenarien × iPhone 12 (WebKit) und Pixel 5 (Chromium): Titel sichtbar, Tresorstand 4, null Console-Errors, null Requests außerhalb von localhost/data:/blob: (Architektur §9), Landscape-Overlay erscheint im Querformat. |
| App auf Handy im WLAN erreichbar (`--host`), Titel sichtbar | ⏳ manuell | `npm run dev` bindet über `server.host: true` auf alle Interfaces und gibt eine Network-URL aus. Gegen den Preview-Build mit iPhone-12- und Pixel-5-Emulation geprüft — der Test auf einem echten Gerät fehlt. |
| CI läuft grün auf GitHub | ✅ | Repo gepusht, beide Workflows laufen. Der Deploy war immer grün, die CI-Stufe **nicht**: Sie fiel seit mehreren Commits an drei Befunden, die alle nichts mit dem Spiel zu tun hatten (Abschnitt *CI war rot*). Seit Lauf `33969705153` grün: Qualitätsstufe, 108 E2E-Fälle, Perf-Stufe. |

**Offene SOLL-Follow-ups:** keine.

**Manuelle Checks für Luka vor M1:**

- [ ] `npm run dev` starten und die Network-URL auf einem echten iPhone und einem echten Android öffnen: Titel „DER TRESOR" sichtbar, Schrift geladen, keine Verzerrung, Safe-Areas passen.
- [ ] Auf demselben Gerät „Zum Home-Bildschirm hinzufügen" ausprobieren: Icon (Tresortür) korrekt, App startet ohne Browser-Leiste im Portrait.
- [ ] Repo nach `github.com/lukabpunkt/Tresor` pushen und den ersten CI- und Pages-Lauf grün sehen (Pages aktiviert sich beim ersten Deploy selbst).

**Zahlen:** 511 Unit-Tests · 8 E2E-Tests · Coverage `core/` 99,7 % Statements / 97,6 % Branches, `fsm.ts` 100 % · Bundle 6,8 KB JS gzip (ohne PIXI, das ab M2 dazukommt) · Build 159 ms.

## Audit A1 — 2026-09-04

**Ergebnis:** BESTANDEN (alle automatisierbaren MUSS-Checks grün; 2 Checks brauchen echte Menschen)

| Check | Status | Notiz |
|---|---|---|
| E2E-Szenarien aus M1.7 grün (Mobile-Emulation iPhone 12 + Pixel 5) | ✅ | 15 Szenarien × 2 Geräte = 30 Tests grün. Darunter der geforderte Dreirunden-Durchlauf (allShare → soloSteal mit Verteilung → multiSteal), eine Eid-Runde mit Meineid, eine Maulwurf-Runde und eine Nachtschicht-Runde. Alle Wartebedingungen hängen an Zuständen, nicht an Uhrzeiten — `tests/e2e/helpers.ts`. |
| Auszahlungstabelle im Negotiation-Screen stimmt mit `payout` überein | ✅ | Der Screen ruft `previewPayouts()` auf, dieselbe Funktion, die `tests/unit/payout.test.ts` gegen das echte `resolveRound()` für k = 0/1/2/n prüft. Die Tabelle kann damit gar nicht abweichen. |
| Choice-Screen: Wahl nach Versiegeln nirgends sichtbar; kein Zurück; Bedenkzeit → auto TEILEN | ✅ | E2E prüft das Markup des Folge-Screens auf „TEILEN"/„STEHLEN" → nichts. Der Screen hat keinen Zurück-Weg, und der Bedenkzeit-Timer wählt bei Ablauf TEILEN mit Toast-Hinweis. |
| Distribute: „Auszahlen" erst bei 0 Rest; Summe == V (bzw. V−2 bei Meineid); alles auf eine Person erlaubt | ✅ | Der Button hängt am Restzähler; die Summe erzwingt `applyDistribution()` (Invariante aus A0). E2E verteilt in Runde 2 alle 6 Schlücke auf eine Person — erlaubt (ADR-4) — und in der Eid-Runde nur die verbleibenden 2. |
| Result-Banner je Outcome korrekt; Tresor-Vorschau zeigt `nextVault` | ✅ | E2E prüft „Ehre unter Dieben" → „Der Alleingang" → „Zu viele Köche" → „MEINEID!" und die Zeilen „Der Tresor wächst auf 6" bzw. „Der Tresor wurde geleert". Das Widget zeigt beim Betreten den alten Stand und klappt nach 420 ms sichtbar auf den neuen. |
| Statistik: Vertrauens-Index, Streak, Meistbetrogen nach 5 Testrunden korrekt | ✅ | `tests/unit/session.test.ts` rechnet fünf konstruierte Runden durch (Scoreboard, Vertrauens-Index 40/80/100/100 %, aktuelle und längste Streak, Meistbetrogen). E2E prüft zusätzlich, dass das Sheet nach drei echten Runden die Abschnitte zeigt. |
| Touch-Ziele ≥ 48 px, Safe-Areas, Reload-Persistenz, Back-Dialog | ✅ | E2E misst alle sichtbaren Buttons in einem Rutsch (keiner unter 48 px), lädt die Lobby neu und findet Name und Härte-Einstellung wieder, und prüft den „Runde abbrechen?"-Dialog in beide Richtungen. Safe-Areas laufen über die `env()`-Tokens aus `base.css`. |
| Countdown letzte 10 s rot, letzte 5 s Tick | ✅ | `countdownRing.ts` setzt `is-warning` ab 10 s und `is-ticking` ab 5 s; die Ziffer bekommt in der Tick-Phase einen Punch, damit der Takt auch stumm sichtbar ist (GDD §6). Der Ton kommt in M3. |
| Keine hardcodierten Strings | ✅ | `tests/unit/guards.test.ts` durchsucht `src/ui/` und `src/main.ts` nach `textContent`/`innerText`/`innerHTML`-Zuweisungen mit echtem Text (Inline-SVG ausgenommen) → 0 Treffer. `tests/unit/ui.test.ts` prüft zusätzlich, dass alle 110 von den Screens benutzten Keys in DE **und** EN existieren. |
| Keine `console.error` im E2E-Flow | ✅ | Der Dreirunden-Test und der Titel-Test sammeln `console`-Errors und `pageerror` → beide leer. |
| Eine unbeteiligte Person versteht jeden Screen ohne Erklärung | ⏳ manuell | Screenshots liegen in `docs/screens/m1-*.png`. Braucht echte Menschen. |
| Party-tauglich mit Platzhalter (DoD) | ⏳ manuell | Zwei vollständige Runden laufen sauber durch; die Reveal-Reihenfolge trägt die Spannung schon ohne Effekte (ADR-12). Ob es am Tisch trägt, entscheidet der Playtest. |

**Befunde während der Umsetzung**

- **Die Idle-Animation lag auf dem Tap-Ziel.** Die Wahl-Karten wippten als Ganzes, der Button wanderte also ständig. Auf dem Handy trifft man ein wanderndes Ziel schlechter — und Playwright wartete ewig auf ein „stabiles" Element. Die Bewegung sitzt jetzt auf einem inneren Element, der Button steht still.
- **Der Münzpegel im Tresor war nie sichtbar.** Die Geometrie schob den Stapel in die falsche Richtung: Selbst bei vollem Tresor lag er unter dem Fensterrand. Neu gezeichnet — in Ruhelage füllt der Stapel das Fenster, `--vault-fill` schiebt ihn nach unten heraus.
- **Der Countdown-Ring schnitt die Anzeige.** Die Zahl schwebte losgelöst über dem Ring, und der Ring lief quer durch den Flip-Counter. Die Zahl sitzt jetzt als dunkler Chip auf dem oberen Ringrand, Tür und Zähler stehen vollständig innerhalb des Rings — dadurch passt auch die Auszahlungstabelle wieder auf den ersten Bildschirm.
- **Die TEILEN-Illustration war unlesbar.** Ein Handschlag wird bei 60 px Kantenlänge zu Matsch; im Test las er sich als Korb. Ersetzt durch zwei anstoßende Gläser (ADR-11), GDD und Art Direction nachgezogen.
- **Die verriegelte Maulwurf-Karte war tot.** `aria-disabled="true"` nahm ihr die Rückmeldung — dabei ist das Rütteln plus „Nicht für dich" genau die Information, die der Maulwurf braucht (ADR-13).
- **Die Lobby baute sich erst nach dem Wipe auf.** `ensureMinimumPlayers()` lief in `activate()`, die Liste erschien also sichtbar verzögert. Läuft jetzt beim Bau des Screens.
- **Die letzte Reveal-Karte war breiter und rutschte dadurch in eine eigene Zeile.** Sah nach Layoutfehler aus. Sie hebt sich jetzt über einen Goldrahmen ab statt über Extrabreite.

**Offene SOLL-Follow-ups:** keine.

**Manuelle Checks für Luka vor M2:**

- [ ] Eine Runde mit echten Menschen am Tisch spielen (3–5 Personen, ein Handy): Versteht jeder jeden Screen ohne Erklärung? Ist die Verhandlungsphase lang genug? Trägt die Reveal-Reihenfolge die Spannung schon ohne Effekte?
- [ ] Auf einem echten Gerät prüfen, ob das Handy während Verhandlung und Aufdeckung wach bleibt (Wake-Lock; auf iOS erst ab Safari 16.4) und ob die Vibration beim Versiegeln und bei der letzten Karte spürbar ist.

**Zahlen:** 534 Unit-Tests · 30 E2E-Tests (15 × 2 Geräte) · Coverage `core/` 99,7 % Statements / 97,1 % Branches, `fsm.ts` 100 % · Bundle 24,3 KB JS gzip (PIXI kommt ab M2 dazu) · 10 Screens, 8 Komponenten.

## Audit A2 — 2026-09-04

**Ergebnis:** BESTANDEN (alle automatisierbaren MUSS-Checks grün; 2 Checks brauchen Lukas Gerät bzw. Auge)

| Check | Status | Notiz |
|---|---|---|
| 8 Crooks + Raum + Laser 60 s: p50 ≤ 16.7 ms, p95 ≤ 33 ms | ✅ | Gemessen über 60 s mit acht Crooks, wandernden Lasern und sprechendem Kassel: **p50 16,7 ms · p95 16,7 ms · 60 fps**, vsync-gebunden. Automatisiert in `tests/e2e/perf.spec.ts` (20-s-Fenster, gleiche Schwellen). Gerät: Chromium/Metal auf Apple M1 — das Referenzgerät steht noch aus (⏳ unten). |
| Draw-Batches ≤ 3 | ✅ | **2 Draw-Calls**, auch während Kassel spricht. Erreicht über ADR-14 (drei Atlanten entlang der Zeichenreihenfolge) und ADR-16 (Sprechblase als 9-Slice statt `Graphics`). Der Test zählt echte `drawElements`/`drawArrays`-Aufrufe im WebGL-Kontext, keine interne Batch-Liste, und triggert Kassels Blase gezielt mit. |
| Heap flach über 30 s | ✅ | 9,5 MB → 9,5 MB über 60 s. Automatisiert als eigener Fall (10 % Toleranz, weil der GC seine eigene Taktung hat). |
| Look-Check gegen Art Direction §1/§5/§6 | ✅ (⏳ Lukas Auge) | Screenshots `docs/screens/m2-3spieler-ruhe.png`, `m2-8spieler-ruhe.png`, `m2-8spieler-aufgedeckt.png`. Vorhanden und erkennbar: Domino-Masken in Spielerfarbe, Ringelshirts auf der Hälfte der Crooks, Symbol auf dem Torso, Samttisch, Stahl-Tresor mit Goldrad, Spotlight-Kegel, wandernde Laser, Vignette, Herr Kassel mit Monokel, Schnurrbart, Sakko und Kassenbuch. |
| Alle 8 Farben + Symbole auf dem dunklen Samt unterscheidbar (Deuteranopie-Simulation) | ✅ | Neues Skript `npm run check:colors` (Brettel/Viénot über LMS, ΔE76 in CIE Lab). Bei normalem Sehen sind alle 28 Paare deutlich getrennt. **Befund:** Unter Deuteranopie rücken vier Paare zusammen (rot/grün ΔE 15, lila/cyan ΔE 13, blau/lila ΔE 22, grün/orange ΔE 22), unter Protanopie zwei (blau/lila ΔE 4, grün/orange ΔE 21). Genau dafür trägt jede Farbe ihr Symbol (GDD §3.1) — auf Torso und Kartenrückseite. Das Skript listet die betroffenen Paare namentlich auf, statt sie durchzuwinken. |
| Halbkreis-Layout bei 3 und bei 8 Spielern ohne Überlappung | ✅ | `layoutStage()` ist eine reine Funktion, der Check damit ein Unit-Test statt eines Blicks (`tests/unit/layout.test.ts`, 11 Tests): Plätze im Bild, Crooks hinter ihren Karten, kein Paar näher als eine Kartenhöhe, Karten-Scale 0.8 ab sieben Spielern bei gleichbleibendem Bogen. |
| Tresor open/close/grow/drain/burst laufen sauber mit Sound-Hooks | ✅ | Alle fünf geben eine GSAP-Timeline zurück, damit der `RevealDirector` (M3) sie einhängen kann statt sie nur anzustoßen. Jeder Schritt ruft `onSound(...)` mit der ID aus GDD §6 — der AudioManager hängt sich in M3 ein. Im Dev-Panel von Hand prüfbar. |
| Preload während NEGOTIATION: kein Nachladen beim Betreten von REVEAL | ✅ | Negotiation- und Silence-Screen stoßen `preloadStageAssets()` per dynamischem `import()` an; `loadStageAssets()` teilt sich eine Promise, ein zweiter Aufruf lädt nichts nach. Der Bühnen-Chunk (92 KB gzip) liegt damit vor dem ersten Kartenflip im Speicher. |
| Low-Effects greift bei CPU-Throttle | ✅ | Zweistufig wie in Architektur §9: Geräte-Vorabschätzung (`deviceMemory`, `hardwareConcurrency`) plus gemessener Frame-Median über die ersten 2 s. Greift die Regel, verschwinden Laser, Schatten und Vignette. Im Dev-Panel schaltbar. |
| Dev-Panel: Spieleranzahl, Tresor auf/zu, Karte umdrehen, Alarm, FPS | ✅ | `?dev=1` blendet Bildrate, ms/Frame, Draw-Calls und Crook-Zahl ein, dazu sechs Knöpfe (Tresor auf/zu, Karte umdrehen, Alarm, Kassel, Low-Effects, Kamera zurück). `?dev=1&hold=1` hält den Karten-Takt an — so lässt sich die Bühne ansehen und messen, ohne dass die Runde weiterläuft. Die Spieleranzahl stellt man in der Lobby ein, wo sie ohnehin hingehört. |
| Kein Nachladen, keine Console-Fehler im Flow | ✅ | Die 30 E2E-Tests aus A1 laufen unverändert grün, jetzt gegen die PIXI-Bühne. Fällt PIXI aus (kein WebGL, kaputter Atlas), übernimmt die DOM-Kartenreihe aus M1 — ein Trinkspiel darf nicht am Renderer sterben. |
| Referenzgerät iPhone 11 / Pixel 4a: 60 fps | ⏳ manuell | Alle Messungen stammen von einem M1-Mac. Ein Gerät der Zielklasse hat niemand hier. |
| „Sieht das nach Ocean's Eleven als Samstagmorgen-Cartoon aus?" | ⏳ manuell | Braucht ein Auge, keinen Test. |

**Befunde während der Umsetzung**

- **Sechs Atlanten hätten das Draw-Budget gesprengt.** Thematisch geschnitten (crooks, cards, vault, room, props, kassel) wechselt die Textur pro Frame bis zu sechsmal. Neu geschnitten entlang der Zeichenreihenfolge — und zwei Assets liegen dafür bewusst „falsch": die Farbsymbole doppelt und das Licht bei den Karten (ADR-14).
- **PIXI lag im Einstiegs-Chunk.** Ein einziger statischer Import im Negotiation-Screen zog 170 KB gzip in den Start. Alle `game/`-Module werden jetzt dynamisch geladen; der Einstieg ist wieder bei 25 KB (ADR-15).
- **Die Sprechblase kostete zwei Draw-Calls.** Als `Graphics` gezeichnet stieg die Zahl auf 4, sobald Kassel den Mund aufmachte. Jetzt ein 9-Slice-Sprite aus dem Atlas (ADR-16).
- **Die Weltskalierung stimmte nicht fürs Hochformat.** Mit Drinkshots `Math.max`-Regel lag im Portrait der halbe Halbkreis außerhalb des Bildes — die äußeren Karten waren schlicht nicht da. Jetzt auf die Breite skaliert, Wand und Boden reichen über die Weltgrenzen hinaus (ADR-17).
- **Der Überlappungstest maß die falsche Kante.** Er prüfte gegen die Karten*breite* und war grün, während sich die Karten an den Bogenenden sichtbar schnitten: Dort liegen zwei Nachbarn fast übereinander, und da entscheidet die *Höhe*. Bogen und Kartengröße wurden daraufhin gemeinsam neu gerechnet.
- **Die Tresortür schwang um den falschen Punkt.** Das Blatt saß eine halbe Türbreite zu weit links, Zahlenrad und Griffrad blieben auf dem offenen Loch liegen. Scharnier auf die linke Kante gesetzt; das Öffnen ist jetzt eine Stauchung, keine Drehung — in 2D ist das der einzige Weg, der wie eine Tür aussieht.
- **Kassel verschwand nach der ersten Runde.** Er hing in derselben Ebene wie die Crooks, und die räumt `populate()` zwischen zwei Runden ab. Eigene Ebene, gleiche Textur, kein zusätzlicher Draw-Call.
- **Die Kamera fuhr pro Karte heran.** Das ist Regie und gehört in den `RevealDirector` (M3); in M2 zerstörte es die Komposition — man sah zwei von acht Crooks. Für diesen Meilenstein bleibt die Totale stehen.

**Offene SOLL-Follow-ups:** keine.

**Manuelle Checks für Luka vor M3:**

- [ ] Die Bühne auf einem echten iPhone 11 / Pixel 4a öffnen und 60 s laufen lassen: Bleiben es 60 fps? Ruckelt etwas beim Kartenflip? (`?dev=1&hold=1` zeigt Bildrate und Draw-Calls direkt auf dem Gerät.)
- [ ] Look-Check gegen Art Direction §1: Sieht der Raum nach „Ocean's Eleven als Samstagmorgen-Cartoon" aus? Sind Maske, Ringelshirt und Symbol auf Anhieb dem richtigen Spieler zuzuordnen?

**Zahlen:** 545 Unit-Tests · 30 E2E-Tests · 3 Perf-Tests · 68 Atlas-Frames in 3 Texturen (739 KB @2x) · Einstiegs-Chunk 25 KB gzip, Bühnen-Chunk 92 KB gzip · 2 Draw-Calls · 60 fps mit 8 Crooks.

## Audit A3 — 2026-09-04

**Ergebnis:** BESTANDEN (alle automatisierbaren MUSS-Checks grün; 2 Checks brauchen echte Menschen)

| Check | Status | Notiz |
|---|---|---|
| 1 000 simulierte Runden: aufgedeckte Karten == `choices`, Reihenfolge == `revealOrder`, Outcome == `result.outcome` | ✅ | `tests/unit/director.test.ts`: 1 000 Runden über 3–8 Spieler, alle drei Härten, alle Modus-Kombinationen und alle drei Presets. Geprüft wird pro Runde: jede Karte genau einmal, in der Reihenfolge des Ergebnisses; auf jeder Karte steht die getroffene Wahl; Teiler vor Dieben; Maulwurf als letzte Karte; genau eine `isLast`; Alarm genau dann, wenn es einen Dieb gibt. Alle fünf Outcomes kommen dabei vor. |
| Timing-Presets ± 1 s; 8 Spieler „Lang" ≤ 40 s | ✅ | 18 Fälle (3 Presets × 6 Spielerzahlen) gegen die aus `choreo.ts` errechnete Soll-Dauer, Abweichung ≤ 1 s. Acht Spieler auf „Lang" landen bei 37,8 s. Gemessen im Browser: 5 Spieler, „Normal" → 22,7 s geplante Timeline, 24,3 s bis zum Result inklusive Outro und Wipe. |
| Tap-to-Skip funktioniert ab Karte 2, nie bei letzter Karte/Outcome | ✅ | Die Regel liegt im Director (`skip()`), nicht im Screen: Er kennt den laufenden Beat und dessen Karten-Index. E2E deckt drei Karten auf, tippt dann **zwanzigmal** — die letzte Karte rückt nicht vor, und die Show läuft trotzdem vollständig zu Ende. |
| Alarm nach erstem STEHLEN; Laser rot; letzte Karte mit 2 Stalls + Slow-Mo + Herzschlag | ✅ | Alarm-Beat sitzt im Skript direkt hinter der ersten offenen Diebeskarte (Unit-Test über 1 000 Runden). Die letzte Karte bekommt `STALLS_LAST` = [0.6, 0.85], `timeScale` 0.55, ein auf 55 % zusammenziehendes Spotlight, und der Herzschlag zieht über ihre Verweildauer von 70 auf 132 bpm an, während die Musik auf 25 % gedückt wird. |
| Perf-Test grün | ✅ | Neuer Fall in `perf.spec.ts` misst **während** die Show läuft — acht Karten mit Stalls, Kamerafahrten, Alarm, Zähler: **p50 16,7 ms · p95 16,7 ms · 2 Draw-Calls**. Die stehende Bühne aus A2 bleibt als eigener Fall bestehen. |
| Filter nur temporär aktiv | ✅ | Es gibt keine. Der Alarm-Blitz und der Meineid-Blitz laufen über einen getinteten Sprite aus dem `front`-Atlas, nicht über einen `ColorMatrixFilter` — das kostet keinen zusätzlichen Draw-Call und keine Render-Textur. |
| Stumm voll spielbar; Sound-Sync Karten-Flip ± 50 ms | ✅ | Der `AudioManager` ist ohne entsperrten Kontext ein No-op und wirft nie (Unit-Test). Die Cues hängen als `.call()` an derselben GSAP-Timeline wie die Animation, nicht an einem eigenen Timer — sie können gar nicht auseinanderlaufen (ADR-19). Jedes Stocken bekommt seinen eigenen Tick; ohne ihn hört man das Zögern nicht. |
| Tab-Wechsel → Pause/Resume ohne Sprung; Wake-Lock aktiv | ✅ | Der Screen hängt an `visibilitychange` und pausiert die Timeline samt Trommelwirbel und Herzschlag; `StageApp` stoppt zusätzlich Ticker und GSAP-Root. Wake-Lock läuft ab dem Sealed-Screen. |
| Haptik bei letzter Karte | ✅ | Der Director meldet jede offene Karte mit `isLast`; der Screen vibriert dann mit dem `lastCard`-Muster statt mit dem normalen Tap. |
| Spannungs-Test: 3 Personen sehen 5 Reveals | ⏳ manuell | Braucht Menschen, keinen Test. Screenshots der vier Momente in `docs/screens/m3-*.png`. |
| „Zieht die letzte Karte wirklich an?" | ⏳ manuell | Dasselbe. |

**Befunde während der Umsetzung**

- **Die Kamerafahrt legte die Wandkante frei.** Beim Zoom auf eine Randkarte schiebt sich der Raum seitlich weg — die Wand deckte aber nur die Weltbreite ab, und am Bildrand stand ein schwarzer Streifen. Wand und Tisch reichen jetzt nach beiden Seiten über die Weltgrenzen hinaus.
- **Zwei Tests, die die falsche Frage stellten.** Der Skip-Test erwartete nach einem einzelnen Dieb den Result-Screen — richtig wäre die Verteil-UI; und er las das Aufdeck-Protokoll, nachdem der Screen samt Protokoll schon ausgetauscht war. Beides Testfehler, kein Spielfehler: Die Skip-Regel selbst hat auf Anhieb gehalten.
- **PixiJS lärmte in der Unit-Suite.** Jeder Test, der ein Modul mit PIXI-Berührung importiert, produzierte einen mehrzeiligen jsdom-Stacktrace. Canvas-Stub im Setup (ADR-21).
- **Die Outcome-Auswahl saß am falschen Ort.** Architektur §5 sieht sie in `resolveRound()` vor — dann müsste der Regelkern die Registry kennen, und die liegt im Bühnen-Chunk. Sie ist in den Director gewandert; deterministisch bleibt es über denselben Seed (ADR-20).

**Offene SOLL-Follow-ups:** keine.

**Manuelle Checks für Luka vor M4:**

- [ ] Spannungs-Test aus A3: Drei Personen sehen fünf Aufdeckungen mit unbekanntem Ergebnis. Sagen mindestens zwei, dass sie bei der letzten Karte angespannt waren? Gibt es bei einem Doppel-Dieb-Twist eine hörbare Reaktion?
- [ ] Auf einem echten Gerät mit Ton: Trägt der Herzschlag bei der letzten Karte? Sind die synthetisierten Platzhalter-Sounds gut genug, um bis M6 zu bleiben — oder braucht es echte Samples?

**Zahlen:** 582 Unit-Tests · 32 E2E-Tests · 3 Perf-Tests · Show 22,7 s bei 5 Spielern („Normal") · p50 16,7 ms während der Show · 2 Draw-Calls · 26 Sound-Cues, synthetisiert.

## M4 — Ergebnis-Inszenierungen — 2026-09-04 (Tag `v0.4.0`)

**Stand:** 11 Inszenierungen + 2 Overlays gebaut, registriert, getestet und einzeln in der Dev-Preview abspielbar. Kassel kommentiert jeden Ausgang aus einem i18n-Array. Der Trinker-Zähler-Moment schließt jede Sequenz ab.

**Was neu ist**

- `src/game/outcomes/<typ>/*.ts` — die elf Sequenzen aus GDD §4.4.
- `src/game/outcomes/juice.ts` — `hitStop()`, das siebte Animationsprinzip (ADR-22).
- `src/game/outcomes/registry.ts` — `ALL_OUTCOMES`, `ALL_OVERLAYS`, `registerAll()`.
- `src/game/Crook.ts` — `growNose()` und `stamp()` für den Meineid; `assets-src/svg/crooks/nose.svg` ist neu.
- `src/ui/dev/outcomePreview.ts` — `npm run preview:outcomes` spielt jede Sequenz und jedes Overlay einzeln ab, ohne eine Runde durchzuspielen.
- `tests/unit/stageDouble.ts` — Bühnen-Attrappe: echte GSAP-Timelines, gefälschte Figuren. So laufen alle elf Sequenzen ohne Renderer durch.
- `tests/unit/outcomeRegistry.test.ts` — 64 Fälle.

## Audit A4 — 2026-09-04

**Ergebnis:** BESTANDEN (alle automatisierbaren MUSS-Checks grün; Lesbarkeit und „Lustig-Test" brauchen Menschen)

**Pro Sequenz** (Dauer über die Bühnen-Attrappe, 4 Spieler; auf der echten Bühne kommen je nach Spielerzahl ein bis zwei Zehntel dazu):

| ID | Dauer | Zähler | Reset | Hit-Stop | Notiz |
|---|---|---|---|---|---|
| `share_group_hug` | 4,6 s | ✅ | ✅ | ✅ | Anticipation in den Knien, Overshoot beim Ankommen, Halt in der Umarmung, Kassels Träne, dann die Rechnung. |
| `share_toast` | 4,5 s | ✅ | ✅ | ✅ | Gläser hoch, Halt oben im Klirren, ein einzelner Crook bekommt Schluckauf. |
| `steal_solo_getaway` | 3,7 s | ✅ | ✅ | ✅ | Zugriff mit Halt, Fluchtauto, Reifenqualm, Kinnladen der Teiler, das Schild „WIR HATTEN EINEN DEAL". |
| `steal_solo_moonwalk` | 3,8 s | ✅ | ✅ | ✅ | Anticipation gegen die Laufrichtung, Gleiten mit Körperwippe, Halt im Moment des Groschens. |
| `steal_solo_magician` | 4,2 s | ✅ | ✅ | ✅ | Tuch über den Tresor, Halt auf dem leeren Tresor, Applaus, der mitten im Takt kippt. |
| `steal_multi_tugofwar` | 5,3 s | ✅ | ✅ | ✅ | Popcorn-Publikum, dreimal härteres Ziehen, Sack platzt, Halt, Münzen fliegen in die Münder. |
| `steal_multi_anvil` | 5,2 s | ✅ | ✅ | ✅ | Amboss in der Farbe des Gegenspielers, Anticipation oben, Squash, Halt, Follow-Through per Bounce. |
| `steal_multi_standoff` | 4,3 s | ✅ | ✅ | ✅ | Kameraschwenk die Reihe ab, alle spritzen gleichzeitig, Reaktion kommt eine Spur zu spät. |
| `steal_all_brawl` | 5,1 s | ✅ | ✅ | ✅ | Staubwolke aus neun Puffs (ADR-24), genau ein Schuh fliegt raus, Halt vor der Pointe, Kassel mit der Kelle. |
| `steal_all_alarm` | 4,5 s | ✅ | ✅ | ✅ | Alle greifen zu, Sirene, Gitter fällt in einem Zug, Halt beim Einrasten, dann federt es nach. |
| `jackpot_burst` | 4,6 s | ✅ | ✅ | ✅ | Tresor bläht sich, platzt, Halt mitten im Knall, 90 Konfetti + 40 Münzen, alle tanzen. |
| `perjury_seal_break` (Overlay) | 1,2 s | — | ✅ | — | Blitz, drei Scherben, Lügennase in drei Schüben, MEINEID-Stempel auf die Brust. |
| `mole_reveal` (Overlay) | 0,7 s | — | ✅ | — | Bergbauhelm fällt auf die Karte, Schulterzucken: Befehl ist Befehl. |

| Check | Status | Notiz |
|---|---|---|
| Dauer 2–8 s | ✅ | Alle elf zwischen 3,7 s und 5,3 s — Testfall pro Sequenz gegen `ANIM.outcomeMinMs`/`outcomeMaxMs`. |
| Endet mit dem Trinker-Zähler-Moment | ✅ | Jede Sequenz ruft `buildSipCounters()`; der Test spielt sie bis ans Ende und prüft, dass eine Zahl fällt, sobald jemand trinkt. Beim Alleingang bleibt der Zähler leer — dort entscheidet erst DISTRIBUTE, wer trinkt (GDD §3.6), und die Übergabe „Handy an {Dieb}" steht im E2E-Durchlauf. |
| Reset-Invariante | ✅ | Der Test bricht jede Sequenz bei 60 % ab — dort räumt eine Inszenierung am schlechtesten auf — und prüft danach Alpha, Rotation, Skalierung, Requisiten, Geldsack und Sitzposition jeder Figur. |
| Alle sieben Animationsprinzipien | ✅ / ⏳ | Der Hit-Stop wird erzwungen: Ein Test lehnt jede Sequenzdatei ohne `hitStop()` ab (ADR-22). Anticipation, Squash & Stretch, Overshoot, Follow-Through, Staffelung und Sound-Sync stehen in jeder Sequenz und sind im Code kommentiert — ob sie *wirken*, ist Augenmaß und bleibt manuell. |
| Alle IDs registriert, in Dev-Preview abspielbar | ✅ | `registerAll()` nimmt alle elf plus `basic_outcome` als Rückfall; `npm run preview:outcomes` zeigt für jede einen Knopf, dazu beide Overlays und `reset`. |
| No-Repeat-Fenster 3 pro Typ, 1 000 Runden | ✅ | Test zieht 1 000-mal für jeden der fünf Typen; keine Wiederholung im Fenster, sobald es mehr Alternativen als das Fenster gibt. Beim Jackpot mit nur einer Sequenz darf und muss dieselbe wiederkommen. Über 1 000 Runden kommt jede Sequenz dran. |
| Gewichte | ✅ | Alle elf mit Gewicht 1 — bewusst gleich verteilt, bis die Spieltests zeigen, welche Inszenierung trägt und welche nervt. Der Test lehnt Gewicht ≤ 0 ab. |
| Overlays kombinierbar mit jeder Dieb-Sequenz | ✅ | Beide Overlays werden gegen jede der acht Dieb-Sequenzen gebaut; jedes bleibt unter dem Outcome-Budget. |
| Kassel-Kommentare pro Outcome | ✅ | Fünf i18n-Arrays à drei Sätze plus drei für den Meineid, gezogen mit dem Runden-Seed — dieselbe Runde klingt beim Nachspielen gleich (ADR-23). |
| Kein Frame-Drop während der Sequenzen | ✅ | `perf.spec.ts` misst über die komplette Show inklusive Auszahlung: **p50 16,7 ms · p95 16,7 ms · 2 Draw-Calls** auf iPhone 12 und Pixel 5 (emuliert). |
| Partikel-Budget | ✅ | Alle Effekte laufen über `FxKit` und die Pools; ist das Budget aus Art Direction §8 erschöpft, gibt der Pool `undefined` zurück und der Partikel entfällt. Der Jackpot fordert mit 90 Konfetti + 40 Münzen am meisten an. |
| In 1 s auf 5,8" lesbar, wer trinkt und warum | ⏳ manuell | Screenshots in `docs/screens/m4-*.png`. Braucht ein Auge und eine Stoppuhr. |
| „Lustig-Test": ≥ 2 von 3 grinsen | ⏳ manuell | Braucht drei Menschen. |
| Video `docs/screens/m4-outcomes.mp4` | ✅ (als GIF) | `docs/screens/m4-outcomes.gif` — sechs Inszenierungen aus der Dev-Preview am Stück (Alleingang, Amboss, Schlägerei, Jackpot, Umarmung, Duell). **GIF statt MP4**, weil auf diesem Rechner kein ffmpeg liegt und ein Bildschirmmitschnitt aus dem Browser heraus nicht reproduzierbar wäre. Für den Ton bleibt das Ohr zuständig. |

**Befunde während der Umsetzung**

- **`props/sign_deal` gab es nicht.** Das Schild lag im crooks-Atlas, `spawnProp()` sucht im front-Atlas — der Alleingang wäre zur Laufzeit gestorben. Gefunden hat es kein Auge, sondern ein neuer Test, der jeden Frame-Namen in `src/game/` gegen die Atlas-Manifeste abgleicht (ADR-25).
- **Zehn von elf Sequenzen hatten keinen Hit-Stop.** Sie waren flüssig und lasen sich trotzdem weich: Ohne den Moment, in dem nichts passiert, ist ein Amboss nur ein fallendes Objekt. Nachgezogen und per Test abgesichert (ADR-22).
- **Kassel hätte sich selbst ins Wort gefallen.** Der Director warf seinen Satz pauschal am Anfang der Auszahlung ein, jede neue Sequenz noch einen an ihrer Pointe — der zweite wäre ausgerechnet über den Trinkzahlen gelandet (ADR-23).
- **Die Prügelwolke zeigte ihren eigenen Rahmen.** Fünf Rauchsprites auf 4,4-facher Größe: Der Atlas trimmt auf die Silhouette, die weiche Kante liegt auf dem Frame-Rand, und beim Vergrößern sampelt PIXI darüber hinaus (ADR-24).
- **Die Bühnen-Attrappe war die eigentliche Arbeit.** Elf Sequenzen ohne Renderer prüfbar zu machen hieß, Crooks, Tresor, Kamera und FX durch Objekte zu ersetzen, die mitschreiben — die Timelines selbst laufen echt. Ohne sie wäre „Dauer 2–8 s" eine Behauptung geblieben.
- **Das Dev-Panel verdeckte die Bühne.** Als Raster mit großen Knöpfen nahm es zwei Drittel des Bildes ein. Jetzt eine seitlich schiebbare Zeile am unteren Rand.

**Offene SOLL-Follow-ups:** keine (Video als GIF nachgereicht, siehe Tabelle).

**Manuelle Checks für Luka vor M5:**

- [ ] `npm run preview:outcomes` auf dem Handy öffnen und jede der elf Sequenzen einmal ansehen: Ist in einer Sekunde klar, wer trinkt und warum? Welche zieht, welche nervt beim dritten Mal?
- [ ] „Lustig-Test" aus A4: Drei Personen sehen die Inszenierungen. Grinsen mindestens zwei?
- [ ] Gewichte: Alle elf stehen auf 1. Nach dem ersten echten Abend entscheiden, welche häufiger kommen soll — Balancing gehört nach `rules.ts`, die Gewichte stehen in `registry.ts`.
- [ ] Weiterhin offen aus M2/M3: echtes iPhone 11 / Pixel 4a (60 fps), Look-Check gegen Art Direction §1, Spannungs-Test mit drei Personen, Urteil über die synthetisierten Platzhalter-Sounds.

**Zahlen:** 646 Unit-Tests · 32 E2E-Tests · 3 Perf-Tests · 11 Inszenierungen (3,7–5,3 s) + 2 Overlays · 89 Atlas-Frames in 3 Texturen · p50 16,7 ms während der Show · 2 Draw-Calls.

## M5 — Polish, Modi-Feinschliff, Juice & Accessibility — 2026-09-05 (Tag `v0.5.0`)

**Stand:** Der Title hat seinen Loop, das Spiel hat Musik, jeder Screen hat seinen Moment. Beide Sprachen sind deckungsgleich, reduzierte Bewegung wird überall respektiert, und drei Fehlerfälle sind als Test festgehalten.

**Was neu ist**

- `assets-src/svg/dom/crook-sneak.svg` + Title-Loop in CSS — der Crook aus GDD §5.
- `src/audio/music.ts` — drei synthetisierte Loops an einem Lookahead-Scheduler (ADR-26).
- `src/core/share.ts` — der Satz zur Runde als reine Funktion; `traitorOfTheEvening()` in `session.ts`.
- `src/ui/components/onboarding.ts` — zwei Sätze, je einmal pro Gerät.
- `src/ui/dev/`, `scripts/check-bundle.mjs` (ADR-28), `tests/e2e/a11y.spec.ts`, `tests/e2e/resilience.spec.ts`, `tests/unit/share.test.ts`.

## Audit A5 — 2026-09-05

**Ergebnis:** BESTANDEN (alle MUSS-Checks grün; zwei Punkte brauchen echte Geräte)

| Check | Status | Notiz |
|---|---|---|
| Lighthouse Mobile Perf/A11y/Best Practices ≥ 90 | ✅ | **Performance 99 · Accessibility 100 · Best Practices 100 · SEO 100** (Lighthouse 13.4, Mobile-Preset, Produktions-Build). FCP 1,3 s · LCP 1,9 s · TBT 0 ms. Desktop-Preset: 100/100/100/100. |
| PWA installierbar | ✅ | Manifest, Icons und Service Worker stehen seit M1; der E2E-Fall "liefert ein installierbares Manifest" prüft Name, Start-URL, Display und Icon-Größen bei jedem Lauf. |
| JS ≤ 450 KB gzip, Reveal-Chunk lazy | ✅ | **Einstieg 32,9 KB, gesamt 266,8 KB gzip.** `npm run check:bundle` folgt der statischen Import-Kette ab `index.html`, nicht nur der einen Datei aus dem `<script>`-Tag — nur so sieht man, ob die Bühne zurück in den Start gerutscht ist (ADR-28). Der Check fällt zusätzlich um, wenn ein Bühnen-Chunk statisch am Einstieg hängt. |
| Kontrast ≥ 4,5:1 | ✅ | Zuerst über Lighthouse `color-contrast` (grün). Einziger Befund dort war der Titel: Die 4-px-Sticker-Kontur wird von axe als effektive Vordergrundfarbe gewertet — Tinte gegen Fast-Schwarz, 1,07:1. Die Kontur bleibt seither dort, wo sie etwas leistet (bunte Flächen); über dunklem Grund trägt der Schlagschatten allein (ADR-27), optisch identisch. **Am 2026-09-05 nachgeschärft** (ADR-38/39): `npm run check:contrast` prüft jetzt **jede** Text/Flächen-Paarung im CSS statt nur die eine Seite, die Lighthouse sieht — 120 Paare, schlechtestes 3,44:1 (Großtext, Grenze 3:1). Dabei fielen zwei echte Verstöße auf, die Lighthouse nie zu sehen bekam, beide bei Kleintext: das MEINEID-Abzeichen (3,44:1) und der Tipp-Hinweis über der Bühne (3,63:1). Behoben. Die Spielerfarben prüft weiterhin `npm run check:colors`. |
| Reduced-Motion | ✅ | E2E fand einen echten Fehler: Der Wackel-Knopf lief auch bei `reduce` weiter. Behoben — und ein Guard-Test liest jetzt das CSS und verlangt für **jede** Endlos-Animation eine Abschaltregel. Einmaliges Aufploppen bleibt erlaubt; was dauerhaft läuft, nicht. Zusätzlich prüft ein E2E-Fall über `document.getAnimations()`, dass auf dem Title bei `reduce` nichts mehr läuft — und dass sich der ganze Weg bis zur Aufdeckung trotzdem spielen lässt. |
| Tastatur-Navigation (SOLL) | ✅ | Der Router setzt den Fokus nach jedem Wechsel in den neuen Screen (E2E-Fall), jeder Screen hat genau eine H1, jede Taste einen Namen — auch die Icon-Knöpfe über `aria-label`. Kassels Kommentare laufen über `aria-live="polite"`: Er ist Deko und darf den Countdown nicht unterbrechen. |
| EN vollständig | ✅ | Drei maschinelle Fragen statt Hinsehen: identische Key-Mengen in beiden Sprachen, kein leerer Text, dieselben Platzhalter. Der letzte Punkt ist der stille Fehler — ein `{name}`, das nur in einer Sprache steht, lässt den Satz lesbar, nur fehlt der Name genau dort, wo er die Pointe trägt. |
| Alle Modus-Kombinationen spielbar | ✅ | Eid + Maulwurf und Nachtschicht + Highroller laufen im E2E-Flow; die Payout-Property-Tests ziehen alle 16 Kombinationen über 10 000 Runden. Neu ist die **Ansage im UI**: Ein Satz unter den Modi erklärt, was zusammen passiert (GDD §3.7). |
| Title-Loop 10 min ohne Leak | ✅ | **Gemessen, nicht behauptet** (nachgereicht 2026-09-05, ADR-38): `npm run measure:title` hält den Title-Screen zehn Minuten offen und liest den Heap nach erzwungener GC. **Start 9 766 KB → Ende 9 766 KB, Delta 0 KB**, 116 DOM-Knoten, 8 laufende Animationen. Das Skript stammt aus dem Schwesterprojekt und ist angepasst. |
| Share-Text korrekt | ✅ | `core/share.ts` ist eine reine Funktion und wird wie eine Regel getestet: fünf Ausgänge, fünf verschiedene Sätze, Meineid schlägt den Alleingang, keine offenen Platzhalter, beide Sprachen, und ein Spieler, der nicht mehr in der Liste steht, bringt nichts zum Absturz. Geteilt wird über die Web-Share-API, Zwischenablage als Rückfall, Toast als letzter. |
| Fehlerfälle (Offline, Atlas-Fehler) | ✅ | `resilience.spec.ts`: Netzabbruch mitten in der Runde (die Aufdeckung läuft aus dem Speicher weiter), fehlender Atlas (DOM-Kartenreihe übernimmt, die Runde endet regulär in der Verteil-UI), unbrauchbarer `localStorage` (Safari Private Mode). Der erste Fall fand einen echten Fehler — siehe unten. |

**Befunde während der Umsetzung**

- **Der Wackel-Knopf ignorierte reduzierte Bewegung.** `btn--wobble` hatte als einzige Endlos-Animation keine `prefers-reduced-motion`-Regel. Gefunden hat es nicht das Auge, sondern `document.getAnimations()` im E2E — und ein Guard-Test hält es jetzt fest.
- **Vorladen ohne `catch` ist ein Fehler in fremder Konsole.** Bricht während der Verhandlung das WLAN weg, scheitert der Bühnen-Import. Die Aufdeckung fällt danach sauber auf die DOM-Karten zurück — die unbehandelte Rejection blieb trotzdem stehen (ADR-29).
- **Die Sticker-Kontur kostete zwölf A11y-Punkte.** Über dunklem Grund ist sie unsichtbar — außer für den Kontrastprüfer, der sie als Vordergrundfarbe wertet (ADR-27).
- **Kassel hätte zweimal geredet.** Der Director warf pauschal einen Satz ein, jede M4-Sequenz noch einen an ihrer Pointe — der zweite wäre über den Trinkzahlen gelandet (ADR-23, in M4 behoben, hier durch die Musik-Umstellung nochmals berührt).
- **Ein fremder Dev-Server saß auf Port 4173.** Ein `vite preview` aus einem anderen Projekt hielt den Port und beantwortete alles mit 404 — das erklärt die sporadisch scheiternden E2E-Läufe der letzten beiden Meilensteine. Prozess beendet; die Läufe sind seitdem stabil.
- **Der Title-Loop lag zuerst auf halber Höhe** und verschwand hinter den Buttons. Er läuft jetzt am unteren Rand entlang, wo er die ganze Breite hat.
- **Die Nachtschicht-Uhr hatte einen Rand zu viel.** Mit Zifferblattrand standen zwei Kreise übereinander und lasen sich als Doppelanzeige. Es bleiben zwölf Striche und der Zeiger.

**Offene SOLL-Follow-ups:** keine.

**Manuelle Checks für Luka vor M6:**

- [ ] Title-Loop zehn Minuten auf einem echten Gerät laufen lassen: Bleibt der Speicher flach, bleibt die Bildrate stabil?
- [ ] Musik anhören. Die drei Loops sind synthetisiert (ADR-19/26) — trägt der Heist-Jazz über einen Abend, oder nervt er nach zwei Runden? Lautstärke gegen die Cues abgleichen.
- [ ] Onboarding: Zwei Sätze, je einmal. Reicht das, oder fehlt ein dritter (Verteil-UI)? `localStorage.removeItem('tresor.onboarding.v1')` zeigt sie wieder.
- [ ] Teilen-Text auf dem Handy antippen: Kommt das System-Share-Blatt, und liest sich der Satz in WhatsApp gut?
- [ ] Weiterhin offen aus M2–M4: echtes iPhone 11 / Pixel 4a (60 fps), Look-Check gegen Art Direction §1, Spannungs-Test mit drei Personen, „Lustig-Test" der elf Inszenierungen, Gewichtung der Sequenzen nach dem ersten Abend.

**Zahlen:** 662 Unit-Tests · 32 E2E (Flow) + 10 (A11y) + 6 (Resilienz) · 3 Perf-Tests (p50 16,7 ms auch mit laufender Musik) · Lighthouse Mobile 99/100/100/100 · Einstieg 32,9 KB gzip, gesamt 266,8 KB · 3 Musik-Loops, 26 Cues, alle synthetisiert.

## M6 — Playtest & Release 1.0 — 2026-09-05 (Tag `v1.0.0-rc.1`)

**Stand:** Alles Bauliche aus M6 ist fertig. Was fehlt, ist der Playtest-Abend selbst — neun der zehn A6-Zeilen messen Reaktionen echter Menschen, und die kann niemand am Schreibtisch erheben. Der Protokollbogen liegt ausgefüllt-bereit in `docs/PLAYTEST-01.md`; `v1.0.0` vergibt Luka danach (ADR-32).

**Was neu ist**

- `src/ui/install.ts` — Installationsangebot ab der zweiten Runde, genau einmal (ADR-30).
- Update-Toast mit echtem Text statt Platzhalter.
- Gerätematrix: iPad Mini und Desktop Chrome fahren zusätzlich den kompletten Spielfluss.
- `docs/PLAYTEST-01.md`, `CHANGELOG.md`, `LICENSE`, README mit GIF, Live-Link, Deploy- und Lizenzabschnitt.
- CI: Das `TODO(M5.6)` im Bundle-Schritt ist eingelöst — dort läuft jetzt `npm run check:bundle`.

## Audit A6 — 2026-09-05

**Ergebnis:** TEILWEISE — die baulichen Zeilen sind grün, das Playtest-Protokoll ist offen.

**Setup:** 4–6 Personen, 1 Handy, ≥ 8 Runden, davon ≥ 2 Eid und ≥ 2 Maulwurf. → steht aus.

| Beobachtung | Ziel | Status | Notiz |
|---|---|---|---|
| Zeit bis erster Reveal | ≤ 90 s | ⏳ manuell | Maschinell gemessen braucht der Weg Title → Lobby (4 Spieler) → Verhandlung übersprungen → vier Wahlen → Aufdeckung rund 25 s. Mit echtem Reden und 30 s Verhandlung liegt der Wert bei etwa 70–80 s — das entscheidet aber die Gruppe, nicht die Stoppuhr. |
| Verhandlung wird zum Reden genutzt | ≥ 6 von 8 | ⏳ manuell | Genau die Frage, die das Spiel trägt (Design-Pfeiler 2). |
| Hörbare Reaktion bei der letzten Karte | ≥ 6 von 8 | ⏳ manuell | Die Mechanik dahinter ist geprüft: 160 % Verweildauer, 2 Stalls, Slow-Mo, Herzschlag, kein Skip (A3). Ob es wirkt, hört man nur im Raum. |
| Lachen bei der Inszenierung | ≥ 5 von 8 | ⏳ manuell | Elf Sequenzen stehen bereit (A4); der „Lustig-Test" ist seit M4 offen. |
| Gebrochener „Ich schwöre"-Moment | ≥ 1 | ⏳ manuell | Der Meineid ist die teuerste Inszenierung im Spiel — Blitz, Scherben, Lügennase, Stempel. |
| Anteil Runden mit k = 0 | 20–50 % | ⏳ manuell | Hängt am Verhalten, nicht am Code. Die Stellschrauben (V_0, Wachstum, Gebühr) stehen vollständig in `rules.ts`; der Bogen führt sie mit Faustregel auf. |
| „Nochmal spielen?" / „War es fair?" | ≥ 80 % Ja | ⏳ manuell | |
| „Was war verwirrend?" → Top-5 | erhoben | ⏳ manuell | Der Bogen bittet ausdrücklich um wörtliche Zitate: Die Formulierung ist der Befund. |
| Abstürze / Ruckler / Sound-Aussetzer | 0 / ≤ 1 / 0 | ✅ / ⏳ | Maschinell: keine unbehandelten Fehler in Flow, A11y und Resilienz; p50 16,7 ms und 2 Draw-Calls während der kompletten Show; Netzabbruch, fehlender Atlas und blockierter `localStorage` sind als Test festgehalten. Auf echter Hardware steht die Beobachtung aus. |
| Gerätematrix | grün | ✅ | Vier Profile: iPhone 12 (WebKit) und Pixel 5 (Chromium) fahren Flow, A11y, Resilienz und Perf; iPad Mini und Desktop Chrome den Flow. |
| PWA | grün | ✅ | Manifest, Icons, Service Worker, Offline-Test. Neu: Installationsangebot ab der zweiten Runde (ADR-30) und ein Update-Toast, der nichts erzwingt — mitten in einer Runde neu zu laden würde die Runde wegwerfen. |
| Live-URL | grün | ✅ | Deploy-Workflow auf GitHub Pages steht seit M0 und läuft bei jedem Push auf `main`, mit Qualitäts-Gate davor. |
| README, CHANGELOG, Tag | grün | ✅ | README mit GIF der Aufdeckung, Live-Link, Gerätematrix, Deploy- und Lizenzabschnitt. `CHANGELOG.md` nach Keep a Changelog, `LICENSE` mit „alle Rechte vorbehalten" als zurücknehmbarer Entscheidung. |

**Befunde während der Umsetzung**

- **Der Querformat-Hinweis fiel auf dem Desktop um** — zu Recht: Er hängt an `(pointer: coarse)`, und „Dreh dein Handy" wäre am Schreibtisch Unsinn. Der Test prüft jetzt beide Seiten der Regel, statt eine zu überspringen (ADR-31).
- **Die Versionsnummer stand seit M0 auf `0.0.1`** und wurde auf dem Title-Screen angezeigt. Jetzt `1.0.0-rc.1`.
- **Das `TODO(M5.6)` in der CI war noch offen.** Der Bundle-Schritt prüfte nur die Summe, nicht die Lazy-Regel. Beides macht jetzt `npm run check:bundle`.

**Offene SOLL-Follow-ups:** keine.

**Manuelle Checks für Luka — der Weg zu `v1.0.0`:**

- [ ] **Playtest-Abend nach `docs/PLAYTEST-01.md`.** 4–6 Personen, ein Handy, ≥ 8 Runden, davon ≥ 2 Eid und ≥ 2 Maulwurf. Vorher installieren und Flugmodus an.
- [ ] **Top-5-Findings beheben** (Roadmap M6.1) — wörtlich mitschreiben, nicht zusammenfassen.
- [ ] **Balancing-Pass** (M6.2): Liegt der Anteil der Friedensrunden unter 20 %, ist Stehlen zu billig; über 50 % ist der Tresor zu zahm. Änderungen nur in `rules.ts`, mit ADR.
- [ ] **Gewichte der elf Inszenierungen** nach dem Abend setzen (`registry.ts`, aktuell alle 1).
- [ ] **Lizenz entscheiden.** Aktuell „alle Rechte vorbehalten". Soll das Repo offen werden, ist MIT für den Code und CC BY-NC-SA für die Grafiken die übliche Kombination.
- [ ] **Dann `v1.0.0` taggen** und `CHANGELOG.md` von `1.0.0-rc.1` auf `1.0.0` heben.
- [ ] Weiterhin offen aus M2–M5: echtes iPhone 11 / Pixel 4a (60 fps), Look-Check gegen Art Direction §1, Urteil über die synthetisierten Sounds, Title-Loop über zehn Minuten.

**Zahlen:** 662 Unit-Tests · E2E auf vier Geräteprofilen · 3 Perf-Tests · Lighthouse Mobile 99/100/100/100 · Einstieg 33,3 KB gzip, gesamt 267,2 KB · 32 ADRs.


## Backlog nach 1.0 — 2026-09-05

Kein Meilenstein, kein Audit — Arbeit aus der Backlog-Liste in `04-ROADMAP.md`.

**Vier weitere Inszenierungen** (Ziel laut Backlog: 20; Stand jetzt 15):

| ID | Dauer | Warum diese |
|---|---|---|
| `share_slow_clap` | 5,3 s | Dritte für „alle teilen". Einer klatscht allein, langsam, fast höhnisch; pro Schlag steigt einer ein und der Abstand schrumpft — bis Kassel klingelt und der Applaus mitten in der Bewegung abreißt. Die Pausen zwischen den ersten Schlägen sind der Gag; wer sie kürzt, bekommt Beifall statt Spott. |
| `steal_solo_helicopter` | 4,1 s | Vierte für den Alleingang und die einzige Flucht **nach oben**. Getaway fährt nach links, Moonwalk gleitet nach links, der Magier verschwindet auf der Stelle — eine vierte Flucht in dieselbe Richtung wäre die dritte Wiederholung gewesen. Der Hubschrauber bleibt fast die ganze Zeit außerhalb des Bildes: Was man nicht sieht, ist größer. |
| `steal_multi_banana` | 4,5 s | Vierte für mehrere Diebe. Die drei bestehenden bestrafen von außen (Amboss), von innen (Tauziehen) oder gegenseitig (Duell) — diese bestraft **niemand**. Die Schale liegt von Anfang an sichtbar da; wer sie früh entdeckt, freut sich zweimal. |
| `steal_all_pie_fight` | 4,2 s | Dritte für „alle stehlen". Die Schlägerei versteckt alles in einer Staubwolke, der Alarm sperrt alle weg — diese zeigt es. Jede Torte trägt die Farbe des Werfers, damit man sieht, **wer** wen erwischt hat. |

Alle vier durchlaufen dieselben Prüfungen wie die elf aus M4: Dauer 2–8 s, Trinker-Zähler-Moment, Reset-Invariante, Kassel-Kommentar, Sound-Cue, Hit-Stop (der Guard-Test lehnt jede Sequenzdatei ohne `hitStop()` ab), Atlas-Abgleich der Frame-Namen.

**Befunde**

- **Klatschen ging am Rig zuerst nicht auf.** Die Arme hängen an den Schultern und drehen sich um diesen Punkt — nach außen gedreht liest sich das als „Arme breit", nicht als Applaus. Jetzt holen sie nach außen aus und schlagen nach innen zusammen, wo sich die Hände vor der Brust treffen.
- **`ctx.play()` konnte nicht verstimmen.** Sechs identische Klatscher hintereinander klingen nach Maschinengewehr. Die Kontext-Schnittstelle reicht jetzt `detune` durch — der `AudioManager` konnte es die ganze Zeit.
- **Zwei Registry-Tests zählten den Stand von gestern.** Sie prüften „genau elf" statt einer Untergrenze und fielen um, sobald etwas dazukam. Jetzt prüfen sie die Untergrenze je Fall aus GDD §4.4 und dass die Summe zur Liste passt.

**Kronzeugen-Modus** — der fünfte Modus und der erste, der **nach** der Aufdeckung eingreift.

Ab zwei Dieben liegt das Handy offen in der Mitte: Einer darf auspacken, halbiert seinen Beuteanteil, und der Verpfiffene trinkt ihn. Die Summe der Runde bleibt gleich — was der Kronzeuge spart, zahlt ein anderer. Ein Rabatt für alle wäre kein Verrat, sondern ein Knopf (ADR-33).

Zwei Regeln fallen aus der Umlage:

- **Wer den Eid gebrochen hat, kann nicht auspacken.** Sein ganzer Schluck ist die Meineid-Strafe; einen Beuteanteil zum Halbieren hat er nicht. Der Screen sperrt ihn sichtbar statt ihn auszublenden.
- **Verpfiffen werden kann er sehr wohl** — dann bekommt er einen eigenen Beuteanteil zusätzlich zu seinem Eid.

Der Screen ist der einzige öffentliche Entscheidungs-Screen im Spiel (ADR-34): kein Rumgeben, kein Timer, beide Taps sieht der Tisch. „Keiner packt aus" steht gleichberechtigt daneben.

**Befund:** Der Property-Test über 2 000 Deals hat ein echtes Loch gefunden — bei einem verpfiffenen Meineidigen verschwanden Schlücke, weil er gar keinen `split`-Eintrag hatte und die verschobenen Schlücke nirgends hinkonnten. Ohne die Zusicherung „die Summe bleibt" wäre das erst am Tisch aufgefallen, als Rechenfehler.

**Vertrauens-Historie über mehrere Abende** — der letzte Backlog-Punkt, der ohne das Schwesterprojekt geht.

Die Session-Statistik endet mit dem Abend. Was sie nicht beantwortet, ist die Frage, die nach dem dritten Abend am Tisch fällt: *Wem kann man eigentlich trauen?* `core/history.ts` sammelt freie Runden, Schlücke und Meineide pro **Name** (ADR-35) unter eigenem Speicher-Schlüssel — er überlebt jeden Session-Reset, ist auf 24 Namen und 60 Spieltage gedeckelt und lässt sich in den Einstellungen löschen. Sichtbar wird er ab dem zweiten Abend (ADR-36).

Der Kontrast ist der Punkt: Im Screenshot steht dieselbe Person heute Abend auf 100 % Vertrauen und über alle Abende auf 31 %.

**Was offen bleibt:** Der Name ist die einzige Identität ohne Konto. Wer sich umbenennt, fängt bei null an, und zwei Marcs an verschiedenen Abenden sind derselbe Marc. Für ein Trinkspiel unter Freunden ist das die richtige Näherung — ein Login wäre die falsche Antwort auf diese Frage.

**Zahlen:** 711 Unit-Tests · E2E auf vier Geräteprofilen (12 neue Fälle für den Kronzeugen, 4 für die Historie) · 15 Inszenierungen (3,7–5,3 s) + 2 Overlays · 5 Modi · gesamt 270,9 KB gzip.


## Backlog: die letzten fünf Inszenierungen — 2026-09-05

Damit sind die im Backlog angestrebten **20** erreicht. Jeder Fall hat jetzt mindestens vier Varianten; nur der Jackpot bleibt bei zwei, weil ihn niemand zweimal an einem Abend sieht.

| ID | Dauer | Die Lücke, die sie füllt |
|---|---|---|
| `share_bank_photo` | 4,1 s | Die einzige, die **Kassel führt**. Umarmung, Prosit und Applaus kommen von den Crooks; hier ist der Bankier der Regisseur, und das Bild, das er macht, ist ein Beweisfoto. Der Blitz ist der Hit-Stop — der Moment, den das Foto festhält, und der einzige, in dem niemand etwas ahnt. |
| `steal_solo_trapdoor` | 3,4 s | Die einzige, die **nach unten** geht. Fluchtauto und Moonwalk gehen nach links, der Hubschrauber nach oben, der Magier bleibt stehen — damit sind alle vier Richtungen vergeben. |
| `steal_multi_handcuffs` | 4,9 s | Das Bild für „ihr teilt euch die Rechnung", ganz ohne Text: Sie hängen aneinander, ziehen in verschiedene Richtungen, die Kette hält. Tauziehen streitet um einen Sack, der Amboss bestraft von außen, das Duell gegenseitig, die Bananenschale niemand. |
| `steal_all_dominoes` | 4,4 s | Die einzige, die mit der Spielerzahl **besser** wird: bei drei Leuten ein Umfallen, bei acht eine Welle. Die Schlägerei versteckt alles in einer Wolke, der Alarm sperrt alle gleichzeitig weg — diese ist eine Linie, und Linien liest man schneller als alles andere. |
| `jackpot_dive` | 5,7 s | Der zweite Jackpot. Der Ausbruch geht nach **außen** — ein Knall, alles fliegt weg. Dieser geht nach **innen**: Das Gold bleibt liegen, und die Crooks springen hinein. |

**Befunde**

- **Der Münzberg war zuerst eine einzelne, neunfach gezogene Münze** — und damit genau der Fehler aus ADR-24: ein oranger Fleck mit sichtbarem Frame-Rand. Jetzt sieben überlappende bei 1,4-facher Größe; die unregelmäßige Silhouette macht den Haufen.
- **Die Handschellen hingen quer über einem fremden Kopf.** Die beiden Diebe trafen sich in der Mitte des Halbkreises — dort sitzen die Teiler. Treffpunkt jetzt vor dem Tisch.
- **Der front-Atlas ist auf 2048 × 2048 gewachsen** (@1x, vorher 1024 × 2048). Draw-Calls und Bildrate bleiben unverändert bei 2 und p50 16,7 ms, auch der Speichertest ist grün. Wer weitere Requisiten hinzufügt, sollte den Wert im Auge behalten.

**Zahlen:** 736 Unit-Tests · 20 Inszenierungen (3,4–5,7 s) + 2 Overlays · 44 Frames im front-Atlas · p50 16,7 ms · 2 Draw-Calls · gesamt 272,3 KB gzip.


## Backlog: `@party/core` gestrichen, Grenzen bewacht — 2026-09-05

Der Backlog-Punkt „Gemeinsames `@party/core`-Package mit Drinkshot" ist **gestrichen** (ADR-37). Drei Gründe, in dieser Reihenfolge:

1. Der Umbau würde das Schwesterprojekt verändern. Dieses Repo ist das einzige, an dem wir arbeiten.
2. Architektur §1 terminierte das Paket auf „nach v1.0 **beider** Spiele". Keines der beiden ist dort: Tresor steht auf `v1.0.0-rc.1` mit offenem Playtest, Drinkshot auf `v0.6.0` mit offenem M6.
3. Die Idee steht ausschließlich in **diesen** Docs. Das Schwesterprojekt erwähnt weder ein geteiltes Paket noch dieses Projekt. Ein Paket, das nur eine Seite kennt, ist keine Vereinbarung.

**Das Problem dahinter bleibt und wird hier gelöst.** `tests/unit/boundaries.test.ts` (22 Fälle) bewacht zwei Grenzen:

| Grenze | Was geprüft wird |
|---|---|
| Eine Quelle für die Spielerfarben | Die acht Farben stehen in `theme.ts`, `tokens.css` **und** im Farb-Audit-Skript. Der Test gleicht alle drei ab, Grundfarbe, Schatten, Symbol und Reihenfolge — dazu den Samt-Hintergrund. |
| Infrastruktur kennt das Spiel nicht | Acht Module hängen an **keinem** Projektmodul (RNG, Store, Wake-Lock, Haptik, Button, Dev-Panel, Partikel-Pool). Zehn weitere dürfen `config/` lesen, aber nichts aus `core/{fsm,session,payout,vault,modes,types,…}`, `game/outcomes`, `ui/screens` oder `ui/router`. |

Die Grenze verläuft zwischen *Werten* und *Begriffen*: Eine Sprechblase darf wissen, welche Schriftgröße gilt. Sie darf nicht wissen, was ein Dieb ist.

**Befunde**

- **Die Palette liegt dreifach im Repo.** `scripts/check-colors.mjs` trägt eine eigene Kopie der acht Farben, weil ein Node-Skript `theme.ts` nicht importieren kann. Bisher hielt sie nur Disziplin zusammen — und Lila wurde schon einmal geändert (ADR-8). Ich habe den Wächter gegengeprüft: Mit einem absichtlich abweichenden Lila fällt er um und nennt Farbe und Sollwert.
- **Der Test hat sofort eine Fehleinordnung von mir gefunden.** Ich hatte `toast.ts` als „hängt an nichts" geführt; es hängt an `ui/animate.ts`. Jetzt steht es in der richtigen Gruppe.
- **Die Trennung hielt bisher von allein** — kein einziges Infrastruktur-Modul greift heute in den Regelkern. Genau deshalb ist jetzt der richtige Moment, sie festzuschreiben: Man bewacht eine Grenze, solange sie noch stimmt.

**Zahlen:** 758 Unit-Tests · 18 bewachte Infrastruktur-Module · 3 abgeglichene Farbquellen.


## Werkzeuge aus dem Schwesterprojekt — 2026-09-05

Mit der Freigabe, aus anderen Repos zu **lesen und zu kopieren** (aber dort nichts zu löschen), habe ich Drinkshot durchgesehen. Nicht die Spielmodule — Rig, Screens und Regelkern sind für ein anderes Spiel gebaut, und der Tresor hat seine eigenen. Wohl aber zwei **Werkzeuge**, die dort schon existierten und hier zwei namentlich offene Audit-Punkte schließen (ADR-38).

| Kopiert | Was es hier tut |
|---|---|
| `scripts/check-contrast.mjs` | WCAG-AA-Kontrast für jede Text/Flächen-Paarung im CSS. Audit A5 verlangte den Nachweis, belegt war er nur über Lighthouse auf der Titelseite. Läuft ohne Browser und damit in jedem CI-Lauf. |
| `scripts/measure-title-heap.mjs` | Heap des Title-Loops über N Minuten, nach erzwungener GC. Stand seit M5 als „⏳ manuell" im Report. |

**Was die Kontrastprüfung sofort gefunden hat**

- **Zwei echte Verstöße, beide bei Kleintext.** Das MEINEID-Abzeichen stand mit Papier auf Diebesrot bei 3,44:1, der Tipp-Hinweis über der Bühne mit 40 % Papier bei 3,63:1 — WCAG AA verlangt 4,5:1. Jetzt Tinte auf Rot (5,04:1) und 50 % (5,09:1). Optisch bleibt beides, was es war (ADR-39).
- **Vierzig Zeilen toter Code.** Die Meldung `1,07:1` auf `.coachmark__text` war zunächst eine Falschmeldung — bis sich zeigte, dass die Komponente gar nicht existiert: CSS und zwei i18n-Schlüssel in beiden Sprachen stammen aus einer M1-Planung, umgesetzt wurde später `onboarding.ts`. Entfernt.
- **Die Vorlage musste erweitert werden.** Diese Codebasis schreibt gedimmten Text als `rgb(255 248 231 / 62%)` — 62 Deklarationen, die das Original übersprang. Es pflegte stattdessen eine Tabelle abgelesener Hexwerte; genau die Sorte Kopie, vor der ADR-37 warnt. Hier wird die Farbe über den Hintergrund gerechnet. Und wo eine Regel ihren Hintergrund nicht selbst setzt, wird nach Block + Element aufgelöst statt geraten: Zuerst nach Block gefiltert, fielen 72 echte Paare mit heraus.

**Was ich bewusst nicht kopiert habe:** `ShotlingBrain.ts` (die Crooks stehen im Halbkreis und sollen dort stehen bleiben), die Todes-Sequenzen, `Scope`, `lottery.ts`, `stepper.ts` und `coachmark.ts` — für Letzteres gibt es hier `onboarding.ts`, und zwei Wege zur selben Sache sind schlechter als einer.

**Zahlen:** 758 Unit-Tests · 120 geprüfte Kontrastpaare · Title-Loop 10 min mit 0 KB Heap-Wachstum · 2 CI-Schritte mehr.


## Befund aus dem Spiel: Ruckler beim Aufdecken — 2026-09-05

Gemeldet: „Wenn die Karten aufgedeckt werden, stockt es ein bisschen." Nachgemessen — und der Befund ist ein anderer, als er klingt.

**Die Karten sind nicht das Problem.** Roh gemessen, jeder Frame einzeln, mit vierfach gedrosselter CPU: p50 16,7 ms, p99 17,7 ms, zwischen den acht Kartenflips kein einziger Ausreißer. Der Aussetzer liegt in den **ersten 0,5 Sekunden** der Aufdeckung, bevor die erste Karte kommt: ein Frame von rund 280 ms.

**Woher er kommt:** Der Aufbau zerlegt sich in Atlanten 3 ms · `Application.init()` **280 ms** · Bühne bauen 15 ms · anhängen 7 ms. Es ist die PixiJS-Initialisierung — WebGL-Kontext anlegen und Shader übersetzen.

**Warum meine Tests das nie sahen:** Sie lesen den gleitenden Median aus dem Dev-Panel. Ein Median über 240 Frames kann einen einzelnen 280-ms-Frame gar nicht zeigen. p95 16,7 ms war korrekt gemessen und trotzdem irreführend — das ist die unangenehmste Sorte grüner Test.

**Was ich versucht und zurückgenommen habe:** Den Renderer während der Verhandlung vorwärmen, so wie es die Atlanten längst tun. In drei Varianten starb die Aufdeckung mit `Cannot read properties of undefined (reading 'updateRenderable')` — keine Karte drehte sich mehr. Zurückgenommen (ADR-40). Ein kaputtes Aufdecken ist schlimmer als ein Ruckler.

**Was bleibt:**

- `perf.spec.ts` misst jetzt **jeden Frame roh**, nicht nur Mediane, und meldet den schlechtesten.
- Ein neuer Fall fährt die Aufdeckung mit vierfach gedrosselter CPU — die einzige Art, den Ruckler in der CI überhaupt zu sehen. Grenzen: kein Frame über 400 ms, höchstens sechs über 33 ms. Aktuell: schlechtester 150 ms, drei über 33 ms.
- Nebenbefund behoben: `getStageApp()` war nicht gegen gleichzeitige Aufrufe geschützt und hätte zwei Renderer gebaut. Aufgefallen nur, weil der Vorlauf ihn zweimal rief.

**Zahlen:** 758 Unit-Tests · 4 Perf-Fälle (einer neu, gedrosselt) · Aussetzer beim Aufbau ~280 ms bei 4× Drosselung, ~50 ms ungedrosselt.


## Modi-Anleitung — 2026-09-05

Aus dem Spiel gemeldet: „Mir war nicht klar, was genau sich bei jedem Spielmodus ändert." Zu Recht — die Lobby zeigt pro Modus **einen** Satz. Der sagt, worum es geht, aber nicht, was passiert: Trinkt der Maulwurf weniger? Kann ich meinen Schwur zurücknehmen? Wer zahlt, wenn der Kronzeuge auspackt?

**Neu:** `src/ui/screens/ModesSheet.ts` — ein Blatt zum Nachschlagen mit allen fünf Modi. Pro Modus zwei bis fünf präzise Zeilen und eine abgesetzte Fußnote: die Ausnahme, die man beim ersten Spielen falsch erwartet und die sonst Streit am Tisch gibt.

Erreichbar von zwei Stellen: unter der Modus-Liste in der Lobby (dort schaltet man sie ein) und aus den Regeln (dort schlägt man nach). Der gerade eingeschaltete Modus ist hervorgehoben — wer das Blatt aus der Lobby öffnet, hat meist genau einen im Kopf.

Die Einzeiler in der Lobby bleiben: Sie reichen zum Wählen. Wer es genau wissen will, tippt einmal mehr (GDD Pfeiler 4).

**Dabei aufgefallen — ein echter Fallstrick:** **Eid und Nachtschicht heben sich gegenseitig auf.** Der Schwur hängt am Verhandlungs-Screen, und die Nachtschicht ersetzt ihn durch zehn Sekunden Stille. Beides zusammen heißt: Niemand kann schwören, `setup.oaths` bleibt leer, es kann keinen Meineid geben. Das stand nirgends. Jetzt warnt die Lobby beim Einschalten, und es steht in der Anleitung.

**Was den Text ehrlich hält:** Ein Test prüft für **beide** Sprachen, dass jeder Modus aus `MODE_IDS` einen Titel, mindestens zwei Zeilen und eine Fußnote hat. Wer einen sechsten Modus ergänzt und die Anleitung vergisst, fällt hier auf — und nicht am Tisch.

**Zahlen:** 758 Unit-Tests (2 neu für die Vollständigkeit) · 4 neue E2E-Fälle · 5 erklärte Modi in DE und EN.


## Der Ruckler beim Aufdecken ist behoben — ADR-40 lag falsch — 2026-09-05

ADR-40 hatte den Aussetzer gemessen, den Fix zurückgenommen und zwei Vermutungen hinterlassen, warum ein Vorlauf während der Verhandlung PixiJS zerlegt. **Beide waren falsch.** Der Fehler `Cannot read properties of undefined (reading 'updateRenderable')` liest sich wie ein Lebenszyklus-Problem und ist in Wahrheit eine Reihenfolge im Chunk-Splitting.

**Was wirklich passiert.** PixiJS baut `renderer.renderPipes` in dem Moment, in dem der Renderer entsteht, aus den bis dahin registrierten Erweiterungen — und jede Zeichen-Klasse registriert ihre Pipe beim Auswerten ihres Moduls. Der alte Vorlauf lud nur `StageApp` und legte den Renderer an. Alles, was die Show darüber hinaus zeichnet (`VaultRoom`, `RevealDirector`, die zwanzig Inszenierungen), kam erst beim Betreten der Aufdeckung — und deren Pipes fehlten diesem Renderer für immer. Der erste Frame der Show greift dann in `renderPipes[renderPipeId]` und findet `undefined`.

**Wie es gefunden wurde: durch Ausschluss, nicht durch Nachdenken.** Jede Vermutung einzeln gefahren, jede widerlegt — das Rendern der echten Bühne (ein Vorlauf ganz ohne Frame starb genauso), der mitlaufende Ticker (`autoStart: false` änderte nichts), die GSAP-Uhr (Übernahme erst beim Anhängen änderte nichts). Erst ein unminifizierter Build machte den Stack lesbar, und dort stand nicht die vermutete zerstörte Render-Gruppe, sondern eine fehlende Pipe. Die beiden ADR-40-Vorschläge hätten beide nicht funktioniert.

**Was jetzt steht**

- `src/game/stageModules.ts` — **eine** Liste der Bühnen-Module. Vorlauf, `RevealScreen` und die Outcome-Vorschau ziehen dieselbe; vorher führten alle drei ihre eigene.
- Der Vorlauf arbeitet in drei Schritten, und die Reihenfolge ist bindend: erst alle Zeichen-Module, dann die Atlanten, dann der Renderer. Gewärmt wird an einem Wegwerf-Objekt außerhalb der Bühne — eine Fläche für die Graphics-Shader, je ein Sprite pro Atlas für die Batch-Shader. Nebenbei wandern damit auch die drei Atlas-Texturen in der Verhandlung auf die GPU.
- `getStageApp()` sperrt auf der **Promise** statt auf dem fertigen Handle. Ohne das legen Vorlauf und Aufdeckung in den 280 ms von `init()` zwei WebGL-Kontexte an, deren Ticker beide GSAPs Wurzel-Zeitleiste mit eigener Zeit füttern.
- `autoStart: false` und die Übernahme der GSAP-Uhr beim `attach()` stammen aus der Suche und bleiben. Sie haben den Absturz nicht behoben, bekommen aber mit einem früh angelegten Renderer erst Gewicht: Sonst zeichnet die App ab ihrer Entstehung jeden Frame eine leere Bühne, und GSAPs Uhr steht ab der Verhandlung still, während die Runde schon Tweens anlegt.

**Was die Messung sagt.** Zeitmarken gegen denselben Ablauf mit abgeschaltetem Vorlauf, vierfach gedrosselte CPU, zwei Paare:

| | ohne Vorlauf | mit Vorlauf |
|---|---|---|
| `Application.init()` | 11 219 ms — 123 ms nach Aufbaubeginn, mitten in der Aufdeckung | 1 413 ms — in der Verhandlung |
| schlechtester Frame | 133 ms · 116 ms | 67 ms · 84 ms |
| Frames über 33 ms | 4 · 4 | 1 · 1 |

Der Rest ist die Shader-Übersetzung des ersten echten Bildes, direkt nach dem Anhängen. Dagegen hilft kein Vorlauf mehr, der die Bühne nicht anfassen darf — und anfassen darf er sie nicht, denn ihr erster gerenderter Frame soll der erste Frame der Show bleiben.

**Eine Lehre zur Methode, die teurer war als der Fix:** Absolute Frame-Zahlen sind auf einer belasteten Maschine wertlos. Derselbe Code lieferte 67, 84 und 183 ms. Der erste Vergleich gegen die in M6 notierte Zahl legte deshalb sogar eine *Verschlechterung* nahe. Erst Zeitmarken im Ablauf und paarweise Läufe auf derselben Maschine machten den Unterschied belastbar.

**Was das festhält:** `tests/unit/boundaries.test.ts` lässt nur noch `stageModules.ts` Bühnen-Module nachladen. Wer künftig eines nur in der Aufdeckung ergänzt, bekommt keinen Tippfehler, sondern einen toten Reveal — und fällt hier auf, nicht am Tisch. Die Grenzen in `perf.spec.ts` gehen von 400 ms / 6 Frames auf 300 ms / 4 Frames; bewusst weiter als die gemessenen Werte, weil der Test die Größenordnung sichern soll und nicht das Rauschen.

**Zahlen:** 762 Unit-Tests (2 neu) · gedrosselt schlechtester Frame 65 ms · ungedrosselt 19 ms und kein Frame über Budget · `Application.init()` 9,8 s früher · Einstiegs-Bundle 37,9 KB (Budget 40).


## CI war rot — ein Rennen im Test, kein Fehler im Spiel — 2026-09-05

Der erste Blick auf GitHub nach dem Push: **CI ist rot**, und war es schon vor dieser Arbeit. Der Deploy lief, die Qualitaets-Stufe lief, aber die E2E-Stufe fiel — seit mehreren Commits, an genau einem Test: „lässt die letzte Karte nicht wegtippen" (GDD §4.3), auf allen drei Versuchen, nie lokal.

**Was der Artefakt-Bericht zeigte.** Die Seite stand beim Fehlschlag längst auf dem Ergebnis-Screen („Zu viele Köche", „Nächste Runde"). Der Test wartete darauf, dass `data-revealed` vier Karten meldet — dieses Attribut lebt aber auf dem Reveal-Screen, und der ist nach der Show samt Protokoll ausgetauscht. Wer danach fragt, bekommt einen leeren String, der nie mehr voll wird.

**Warum ausgerechnet auf CI.** Der Test tippt zwanzig Mal auf die letzte Karte, um zu beweisen, dass sie sich nicht vorziehen lässt. Jeder dieser Taps ist ein Playwright-Aufruf mit Netzwerk-Umlauf; auf einem GitHub-Runner dauern zwanzig davon lange genug, dass die Show währenddessen zu Ende läuft. Lokal gewann derselbe Test das Rennen und sah gesund aus. Die Bildrate spielt dabei keine Rolle — der PIXI-Ticker treibt GSAP mit echter Zeit, die Show dauert auf einem langsamen Rechner also **gleich lang**, nur die Testschritte dauern länger.

**Der Fix ist ein Mitschreiber, kein längeres Timeout.** `watchRevealLog()` hängt beim Betreten der Aufdeckung einen `MutationObserver` an den `<body>` und behält den längsten gesehenen Stand. Damit hängt die Zusicherung am **Inhalt**, nicht am Zeitpunkt der Frage — dieselbe Regel, die der Helfer-Kopf seit M1 aufstellt („Wartebedingungen hängen an Zuständen, nie an Uhrzeiten"), nur eine Ebene tiefer: Der Zustand muss den Screen überleben, an dem er hängt.

Belegt lokal, indem die CI-Bedingung erzwungen wurde: zwanzig Sekunden Wartezeit nach den Taps, also weit jenseits des Screen-Wechsels. Vorher unmöglich zu bestehen, jetzt grün.

**Mitgenommen:** Zwei weitere Stellen hatten dasselbe Rennen, nur unauffällig — „deckt Teiler zuerst und Diebe zuletzt auf" (wartet sofort nach dem Betreten und gewann deshalb immer) und der Atlas-Ausfall in `resilience.spec.ts` (wartet auf die dritte von drei Karten, also die letzte). Beide lesen jetzt aus dem Mitschreiber.

**Nachtrag: Der erste PR-Lauf hat einen zweiten roten Test freigelegt.** Der Flow-Fix wirkte — die E2E-Stufe kam durch —, und genau dadurch lief die **Perf-Stufe zum ersten Mal ueberhaupt auf CI**. Bis dahin brach der Flow davor immer ab, und `dee5051` hatte den gedrosselten Fall zwar eingefuehrt, aber nie dort laufen sehen.

Was er dort meldete: Der GitHub-Runner zeichnet Chromium **in Software mit 10 fps**. Im ungedrosselten Reveal-Fall liegen 314 von 352 Frames ueber dem 33-ms-Budget, im gedrosselten 42 von 72. Das ist keine Aussage ueber das Spiel, sondern ueber den Mietrechner — und auch der urspruengliche Grenzwert von sechs Frames waere dort gefallen, nicht erst der auf vier verschaerfte.

Die beiden Perf-Faelle darueber haben dafuer laengst eine Weiche: messen und melden immer, pruefen nur auf echter Grafik (`test.skip(software, ...)`). Der gedrosselte Fall hatte sie als einziger nicht. Jetzt hat er sie. Auf echter Grafik bleibt alles scharf — schlechtester Frame 99 ms bei Grenze 300, drei Frames ueber Budget bei Grenze vier.

**Nebenbei:** GitHub meldet in jedem Lauf, dass `checkout@v4`, `setup-node@v4`, `upload-artifact@v4` und `configure-pages@v5` auf abgekuendigtem Node 20 laufen und nur notgedrungen auf Node 24 gestartet werden — heute eine Warnung, spaeter ein roter Lauf. Alle sechs Actions stehen jetzt auf ihrem Node-24-Major. Die drei Pages-Actions kann nur ein Push auf `main` beweisen; faellt der Deploy, bleibt die bisher veroeffentlichte Seite live.

**Nachtrag 2: Warum die Show auf CI ueberhaupt in Zeitfenster laeuft.** Der zweite PR-Lauf kam durch die Perf-Stufe und fiel dafuer an drei Flow-Tests, die alle dasselbe warteten: einen Screen **hinter** der Show, mit 40 Sekunden Geduld. Die Ursache steht in einer Zahl aus dem Perf-Log: Das Dev-Panel meldet auf dem Runner exakt `p50 100,0 ms` — das ist nicht gemessen, das ist PixiJS' `maxElapsedMS`-Deckel. Rohe Frames brauchen dort bis zu 150 ms.

Der Ticker treibt GSAP. Wo ein Frame laenger als 100 ms braucht, bekommt die Show weniger Zeit gutgeschrieben, als real vergeht — **sie zieht sich in Wanduhr-Zeit**. Auf dem Software-Renderer um rund die Haelfte: Aus zwanzig Sekunden Show werden ueber dreissig. Die 40-Sekunden-Fenster dahinter waren damit auf Kante genaeht, und ein etwas langsamerer Runner kippte sie.

Wartebedingungen, die ein Stueck Show ueberspannen, haben jetzt ihr eigenes Fenster (`AFTER_SHOW_MS`, 90 s) mit der Begruendung im Code. Gewartet wird weiter auf einen **Zustand** — nur laenger, wenn die Maschine langsam zeichnet. Dieselbe Rechnung trifft das Test-Timeout: Drei Runden mit je einer um die Haelfte gedehnten Show passen nicht in zwei Minuten, also stehen dort jetzt fuenf.

Zwei Stellen waren dabei leicht zu uebersehen. `distributeAllToFirst()` wartet auf den Verteil-Screen — im Helfer, nicht an der Aufrufstelle —, und dieser Screen kommt immer direkt hinter einer Show. Und die zwanzig Taps auf die letzte Karte zielten auf den jeweils **aktuellen** Screen: Laeuft die Show waehrend der Taps durch, landen die restlichen auf dem Ergebnis, wo einer davon "Naechste Runde" trifft. Sie zielen jetzt auf die Buehne und hoeren auf, sobald sie nicht mehr steht.

**Das ist nicht nur eine Test-Eigenschaft.** Faellt ein echtes Geraet unter 10 fps, zieht sich die Show dort genauso. Die Gegenmassnahme dafuer steht seit M5: Low-Effects greift ab einem Frame-Median von 22 ms und nimmt Laser, Schatten und Vignette heraus, bevor es so weit kommt.

**Ergebnis:** Lauf `33969705153` ist grün — Qualitaetsstufe, 108 E2E-Faelle, Perf-Stufe (ein geprueft, drei auf dem Software-Renderer uebersprungen). Damit ist der seit M0 offene Punkt *CI laeuft gruen auf GitHub* geschlossen, und die Node-20-Abkuendigung ist aus den Laeufen verschwunden.

**Was das ueber die Test-Suite sagt.** Keiner der vier Befunde war ein Fehler im Spiel — und keiner waere lokal je aufgefallen. Drei davon haben denselben Kern: Der Test nimmt an, die Maschine sei so schnell wie die eigene. Der vierte war eine Weiche, die zwei von drei Faellen hatten. Dass die Perf-Stufe dabei **zum ersten Mal ueberhaupt** auf CI lief, ist der eigentliche Befund: Ein roter Test davor verdeckt alles dahinter, und niemand sieht, was nie gelaufen ist.

**Zahlen:** 4 rote CI-Befunde (ein Rennen, eine fehlende Weiche, ein zu enges Zeitfenster, eine verdeckte Wartestelle) · 14 Wartestellen umgestellt · 6 Actions auf Node-24-Majors · 108 E2E-Faelle auf CI gruen · 0 Produktionscode geaendert.
