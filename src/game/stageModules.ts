/**
 * Die Module, die auf der Buehne zeichnen — an genau einer Stelle geladen.
 *
 * **Warum das eine eigene Datei ist.** PixiJS bindet seine Render-Pipes in dem Moment an
 * den Renderer, in dem dieser entsteht: `renderer.renderPipes` wird aus den bis dahin
 * registrierten Erweiterungen gebaut, und jede Zeichen-Klasse registriert ihre Pipe beim
 * Auswerten ihres Moduls. Wer den Renderer anlegt, bevor alle Zeichen-Module geladen
 * sind, bekommt einen Renderer ohne deren Pipes — und der erste Frame der Show stirbt in
 * `renderGroup.updateRenderable()` mit `renderPipes[renderPipeId]` = `undefined`.
 *
 * Genau daran ist der erste Anlauf auf den Vorlauf gescheitert (ADR-40): Er lud nur
 * `StageApp` und legte den Renderer an; alles, was die Aufdeckung darueber hinaus
 * zeichnet, kam zu spaet. Der Fehler sah nach einem PixiJS-Lebenszyklus-Problem aus und
 * war in Wahrheit eine Reihenfolge im Chunk-Splitting.
 *
 * Deshalb: **eine** Liste, die der Vorlauf und die Aufdeckung teilen. Zwei Listen wuerden
 * auseinanderlaufen, und der Unterschied waere kein Tippfehler, sondern ein toter Reveal
 * (ADR-41). `tests/unit/boundaries.test.ts` haelt fest, dass es bei einer bleibt.
 */

import type * as CameraModule from './Camera';
import type * as SipCounterModule from './fx/SipCounter';
import type * as OutcomeSequenceModule from './outcomes/OutcomeSequence';
import type * as RegistryModule from './outcomes/registry';
import type * as RevealDirectorModule from './RevealDirector';
import type * as StageAppModule from './StageApp';
import type * as VaultRoomModule from './VaultRoom';

export interface StageModules {
  stageApp: typeof StageAppModule;
  room: typeof VaultRoomModule;
  camera: typeof CameraModule;
  director: typeof RevealDirectorModule;
  sequence: typeof OutcomeSequenceModule;
  registry: typeof RegistryModule;
  counter: typeof SipCounterModule;
}

let modules: Promise<StageModules> | undefined;

/**
 * Laedt den kompletten Buehnen-Chunk. Mehrfachaufrufe teilen sich dieselbe Promise —
 * der Vorlauf waehrend der Verhandlung und das spaetere Betreten der Aufdeckung laden
 * nicht zweimal.
 */
export function loadStageModules(): Promise<StageModules> {
  modules ??= (async () => {
    const [stageApp, room, camera, director, sequence, registry, counter] = await Promise.all([
      import('./StageApp'),
      import('./VaultRoom'),
      import('./Camera'),
      import('./RevealDirector'),
      import('./outcomes/OutcomeSequence'),
      import('./outcomes/registry'),
      import('./fx/SipCounter'),
    ]);
    return { stageApp, room, camera, director, sequence, registry, counter };
  })().catch((error: unknown) => {
    // Netz weg mitten im Chunk: Der naechste Versuch soll neu laden duerfen.
    modules = undefined;
    throw error;
  });
  return modules;
}

/**
 * Vorlauf im Hintergrund (Architektur §8) — laeuft waehrend NEGOTIATION und SILENCE.
 * Beim Betreten der Aufdeckung soll weder geladen noch aufgebaut werden (Audit A2).
 *
 * Drei Schritte, und die Reihenfolge ist die ganze Pointe: erst **alle** Zeichen-Module,
 * dann die Atlanten, dann der Renderer. Wer den Renderer vorzieht, bekommt ihn ohne die
 * Pipes der noch fehlenden Module (siehe oben); wer die Atlanten mit der
 * Shader-Uebersetzung ueberlappt, laesst Bild-Dekodierung und Kompilierung um dieselbe
 * CPU konkurrieren und verschiebt den Aussetzer nur.
 *
 * Faellt hier etwas aus, stirbt nichts: Die Aufdeckung versucht jeden Schritt selbst noch
 * einmal und schaltet notfalls auf die DOM-Karten um (Audit A5).
 */
export function preloadStage(): void {
  void (async () => {
    try {
      const { stageApp } = await loadStageModules();
      await stageApp.loadStageAssets();
      await stageApp.warmStageApp();
    } catch (error) {
      console.warn('[stage] Vorlauf fehlgeschlagen', error);
    }
  })();
}
