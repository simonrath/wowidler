# World of Warcraft Forever Idle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das freigegebene Gesamtkonzept als vollständig spielbares HTML und Three.js Idle RPG für den überprüften Forever Inhaltsstand umsetzen und auf einer neuen privaten ChatGPT Site veröffentlichen.

**Architecture:** Ein versioniertes Inhaltsregister versorgt eine deterministische, von Darstellung und Bildrate unabhängige Simulation. Ein Sites Serverdienst bestätigt Aktionen, Zeit und Speicherstände; eine HTML Oberfläche mit originalen WoW Bauteilen und eine Three.js Weltbühne stellen denselben Zustand dar. Sichtbare und nachträglich berechnete Zeit verwenden denselben Simulationskern.

**Tech Stack:** Sites Vinext Starter, React, TypeScript, Three.js, Zod, Vitest, Testing Library mit jsdom, Cloudflare D1 und Drizzle. Der D1 Testharness verwendet eine zur vorhandenen Wrangler Version passende Miniflare Version. Die mit dem Starter gelieferten Versionen bleiben erhalten; zusätzliche Abhängigkeiten werden einmal passend aufgelöst und im vorhandenen Lockfile fixiert. Kein Supabase, keine externe MMO Verbindung, keine KI Bildgenerierung.

**Spec:** Freigegebenes `WoW_Forever_Idle_Gesamtkonzept.pdf`, 34 Seiten, Version 1.0 vom 21. Oktober 2026; Library ID `libfile_69fe1947d7088191a3844bdb46f32dff`. Verifizierte lokale Fassung: `/workspace/scratch/0854f32a873c/output/pdf/WoW_Forever_Idle_Gesamtkonzept.pdf`. Bei Ausführungsbeginn unverändert nach `docs/superpowers/specs/2026-10-21-wow-forever-idle.pdf` in den neuen Site Checkout übernehmen. Das Konzept und dieser Plan reisen mit dem Quellcode.

## Global Constraints

- „Referenz ist FOR-IDLE-2026-10-21-PUBLIC: der öffentliche Beta Stand samt bis zum Stichtag offiziell angekündigter erster Inhaltsphase.“ Verfügbarkeit, Datenreife und Umsetzung bleiben getrennt.
- „Der Spieler besitzt mehrere Charaktere, steuert aber immer nur einen aktiven Charakter zur selben Zeit.“ Diese Sperre gilt für das gesamte Profil, auch bei mehreren Geräten.
- „Jeder übernommene Inhalt braucht eine Quelle, eine gültige Version und eine funktionierende Verwendung.“ Kein unbekannter Kampfwert wird still durch einen generischen Wert ersetzt.
- „Ein vollständig importierter Ausschnitt einer unvollständigen Datenbank ist keine vollständige Abdeckung des Spiels.“ Ein unbekannter Nenner bleibt `null`.
- „Die Spielsprache ist Deutsch; Originalnamen und englische Suchbegriffe bleiben zusätzlich verfügbar.“
- „Bis zu zwölf Regeln bilden die normale Priorität.“ Aktivitätsfolgen haben höchstens zehn geplante Schritte.
- „Standardmäßig endet die Tätigkeit nach dem ersten Tod.“ Mit aktivierter Wiederholung wird nach zwei aufeinanderfolgenden Niederlagen gestoppt: höchstens ein weiterer Versuch nach der ersten Niederlage.
- „Ziel sind bis zu 24 Stunden exakte Simulation pro Rückkehr; die Obergrenze wird vor Zusage durch einen Lastversuch geprüft.“ Die technische Kappe beträgt zunächst `86_400_000` Millisekunden.
- „Ziel sind maximal 60 Bilder pro Sekunde und eine auch bei deaktivierter 3D Szene vollständig nutzbare Oberfläche.“
- „Die neue Site startet privat.“ Geräteübergreifende Fortschrittsdaten liegen in D1; Browserdaten dienen nur Einstellungen und unbestätigter Darstellung.
- „Fehlende Ergänzungen werden von Hand als SVG, gezeichnete Textur oder Three.js Geometrie erstellt.“ Keine Bildgenerierung.
- Jeglicher Zugriff auf GitHub erfolgt ausschließlich über den ChatGPT GitHub Connector. Keine GitHub Downloads per curl, Shell HTTP, Browser oder git clone. Der Sites Quellworkflow verwendet ausschließlich seine eigene Hosting Quelle.
- Original 1.12, Classic Era und Forever werden nicht miteinander gleichgesetzt. Neue Völkerkombinationen, Zauber, Camping und Vermächtnis gehören zum Zielumfang.
- Bekannte technische Mindestanforderung des Sites Starters: Node.js `>=22.13.0`; vorhandenes Runtime Node ist `24.19.0`. Die Starter Integration und ihre Build Helfer bleiben erhalten.

## Review Focus

1. Verlorene Antworten, doppelte Befehle und konkurrierende Tabs dürfen keine Beute duplizieren und keinen älteren Stand zurückschreiben. Tests in T17 und T18.
2. Ein abgebrochener Rückkehrjob darf die 24 Stunden Kappe nicht bei jedem Neuladen neu ansetzen. Tests in T16 und T17.
3. Volle Taschen nach einem seltenen Beutewurf müssen die bereits ausgewürfelte Beute erhalten und die Tätigkeit nachvollziehbar pausieren. Tests in T09 und T16.
4. Ein Forever Eintrag mit fehlendem Pflichtwert, unbekannter Korrektur oder nicht unterstütztem Effekt darf nicht versehentlich als vollständig spielbar zählen. Tests in T03 bis T05 und T23.
5. Rendererfehler, lange deutsche Texte und kleine Bildschirme dürfen erreichbare Spielaktionen oder bestätigten Fortschritt nicht verlieren. Prüfungen in T19 bis T22 und T26.

## Ausführungsgrenze und Zerlegung

Dieser Plan konkretisiert das freigegebene Konzept. Er enthält keine bereits implementierten Produktfunktionen. Vor der Ausführung prüft Simon den Plan und wählt das Ausführungsverfahren gemäß Superpowers.

Sechs Arbeitspfade bilden ein gemeinsames Produkt: A Inhaltsdaten, B Spielregeln, C Server und Speicher, D Oberfläche, E Three.js und Grafik, F Inhaltsabschluss und Veröffentlichung. Einzelne Aufgaben sind erst abgeschlossen, wenn ihre eigenen Prüfungen bestehen. Die Spielprobe aus T20 ersetzt nicht den vollständigen Umfang aus T23 bis T27.

Inhaltslücken blockieren die betroffene Funktion und die Vollständigkeitsfreigabe, aber nicht unabhängige Entwicklungsarbeiten. Ein früher spielbarer Zwischenstand heißt ausdrücklich Spielprobe. Eine Site wird nicht als vollständiges Forever Spiel bezeichnet, solange Pflichtlücken bestehen.

## Geplante Dateistruktur

| Pfad | Verantwortung |
| --- | --- |
| `app/page.tsx`, `app/layout.tsx`, `app/globals.css` | Geschützte Anwendung, Metadaten und Einstieg |
| `app/api/game/{state,commands,lease,catchup,export,import}/route.ts` | Authentifizierte HTTP Grenzen ohne eigene Spielregeln |
| `src/domain/{ids,content,state,commands,events,result,views}.ts` | Geteilte Verträge und Laufzeitschemas |
| `src/content/{registry,coverage,provenance,capabilities}.ts` | Inhaltszugriff, Abdeckung und freigegebene Fähigkeiten |
| `tools/content/{cli,lock,questiedb,client-tables,normalize,resolve,package,diff}.ts` | Offline Import und reproduzierbare Inhaltspakete |
| `content/{sources,snapshots,adaptations,authoring}/` | Fixierte Quellen, Referenzinventare und belegte Ergänzungen |
| `src/game/simulation/` | Zeit, Ereignisqueue, Zufall und Fortschreiben |
| `src/game/{combat,classes,inventory,quests,world,professions,camping,economy,encounters,pvp,legacy,activities}/` | Fachlich getrennte Spielsysteme |
| `src/server/game/{repository,leases,commands,catchup,migrations,backup}.ts` | Autoritative Änderungen und Wiederherstellung |
| `db/schema.ts`, `drizzle/` | Schema und unveränderliche Datenbankmigrationen |
| `src/ui/{GameShell,WindowManager}.tsx`, `src/ui/{view,client}.ts` | Fenster, Projektion und Serververbindung |
| `src/ui/wow/`, `src/ui/windows/` | Wiederverwendbare WoW Bauteile und vollständige Bedienwege |
| `src/world/{WorldStage,SceneLoader,AnimationController,picking,Effects,Audio}.ts` | Three.js Darstellung ohne Spielzustandsmutation |
| `assets/{source-lock,components,crops,scenes}.json` | Grafikherkunft, Zuschnitte und Szenenregister |
| `public/assets/`, `public/content/` | Paketierte browsergeeignete Dateien |
| `tests/{fixtures,content,simulation,combat,classes,inventory,quests,world,professions,economy,encounters,pvp,legacy,activities,server,ui,progression}/` | Sinnvolle Verhaltensprüfungen |
| `reports/{content,performance,qa,release}/` | Belege, offene Lücken und Abnahme |
| `docs/{superpowers,rulebook}/` | Freigaben, Pläne und eigene Idle Regeln |

Produktquellcode wird im neuen Checkout `/workspace/sites/wow-forever-idle` erstellt; falls belegt, wird einmal ein eindeutiger neuer Name gewählt und danach beibehalten. Dieser Plan selbst liegt bis zum Ausführungsbeginn als eigenständiges Dokument vor.

## Gemeinsame Verträge

T01 definiert und exportiert die folgenden Namen. Spätere Aufgaben erweitern ausschließlich die zugehörigen fachlichen Unions; sie erzeugen keine zweiten Frontend Versionen der Zustandsmodelle.

```ts
type Branch = 'original112' | 'era' | 'forever';
type EntityKey = `${Branch}:${EntityKind}:${number}`;
type EpochMs = number; // Nichtnegative sichere Ganzzahl für Serverzeit.
type SimMs = number;   // Nichtnegative sichere Ganzzahl für Spielzeit.
type RngState = readonly [number, number, number, number];
type Revision = number;
type Validation = { ok: true } | { ok: false; issues: Issue[] };
type Result<T> = { ok: true; value: T } | { ok: false; error: GameError };

interface Checkpoint {
  state: GameState;
  simMs: SimMs;
  queue: ScheduledEvent[];
  rng: RngState;
  nextSequence: number;
  snapshotId: string;
  simulationVersion: string;
}
interface CommandEnvelope {
  commandId: string;
  expectedRevision: Revision;
  leaseToken: string;
  command: GameCommand;
}
interface AdvanceBudget { maxEvents: number; shouldYield(): boolean }
interface AdvanceResult {
  checkpoint: Checkpoint;
  processedEvents: number;
  reachedTarget: boolean;
  pause?: PauseReason;
}
```

`EntityKind` enthält alle Inhaltskategorien des Konzeptabschnitts 02 einschließlich Beziehungen wie Volk/Fraktion/Klasse und Händler/Artikel. `ProfileState` ist das Aggregat mit gemeinsamen Freischaltungen, Charakteren und aktiver Charakter ID. `GameState` enthält genau dieses Aggregat und die laufende Begegnung mit ihren Akteuren; Akteure referenzieren dauerhafte Charakterdaten statt diese zu duplizieren. Damit sind aktive Tätigkeit, Quests, Inventar und noch offene Belohnungen eindeutig zugeordnet. Definitionen bleiben in den genannten Domain Dateien; Inhalte selbst werden nicht in Typdefinitionen eingebaut.

`GameCommand` ist eine diskriminierte Union. Nur ein serverbestätigter Befehl oder ein Simulationsereignis ändert `GameState`. `GameView` und `SceneView` sind schreibgeschützte Projektionen, keine zusätzlichen Speicherstände. Alle Domänentests verwenden `makeState(overrides)`, `makeCheckpoint(overrides)` und `makeCatalog(entities)` aus T01; jeder Test legt die für seine Aussage notwendigen Werte ausdrücklich im Test oder einer benannten Fixture fest.

## Reihenfolge und Abhängigkeiten

| Pfad | Aufgaben | Startvoraussetzung |
| --- | --- | --- |
| A Daten | T02 bis T05, später T23 | T01 |
| B Spielregeln | T06 bis T16 | T01; reale Inhalte nach T05 |
| C Speicher | T17, T18, T25 | T06, T16 für vollständigen Nachweis |
| D Oberfläche | T19 bis T21 | T01; Integration nach T18 |
| E Darstellung | T22 | T19; bestätigt dargestellte Ereignisse aus T18 |
| F Abschluss | T23 bis T27 | Jeweils genannte Fachaufgaben |

T19 kann nach stabilen Domain Verträgen neben Datenarbeiten vorbereitet werden. Zusammenführung erfolgt ausschließlich mit bestätigten Schnittstellen. Sites Registrierung, gemeinsame Dateien und Veröffentlichung verantwortet der Hauptagent.

### Task 1: Domain Verträge und testbare Projektgrundlage

**Konzept:** 01, 26, 27. **Abhängigkeit:** freigegebener Plan.

**Files:** Create `src/domain/{ids,content,state,commands,events,result,views}.ts`, `tests/fixtures/factories.ts`, `tests/domain/contracts.test.ts`, `vitest.config.ts`; Modify Starter `package.json`, `tsconfig.json`; Copy freigegebene Spezifikation und Plan unter `docs/superpowers/`.

**Interfaces:** Produces `EntityKey`, `EntityKind`, `Entity`, `Catalog`, `SnapshotSpec`, `GameState`, `ProfileState`, `CharacterState`, `ActorState`, `Checkpoint`, `ProfileSnapshot`, `GameCommand`, `GameEvent`, `GameView`, `SceneView`, `Validation`, `Result<T>`, `PauseReason`, `makeState`, `makeCheckpoint`, `makeCatalog`. `ProfileSnapshot` umfasst Eigentümer, Profilrevision, Profilzustand und Versionen. `Catalog.get(key: EntityKey): Entity | undefined`; `Catalog.requirePlayable(key: EntityKey): Result<Entity>`. Fachliche Formen und ihre Laufzeitschemas liegen in den jeweils zugeordneten Domain Dateien.

- [ ] **Step 1:** In einem isolierten neuen Site Checkout den Sites Vinext Starter über `project-setup.mjs` vorbereiten und vorhandene Integration erhalten. Der Hauptagent registriert die neue private Site genau einmal und sichert ihre ID mit dem Sites Helfer; eine bereits begonnene Registrierung wird fortgesetzt. Erforderliche Test und Three.js Abhängigkeiten über den vorgesehenen Installationsweg ergänzen. `test` bedeutet `vitest run`, `typecheck` bedeutet `tsc --noEmit`. Vitest verwendet node für Fachtests und jsdom für UI Tests. Lockfile einchecken. Registrierung behauptet noch keine Spielvollständigkeit.
- [ ] **Step 2:** Failing test `rejectsInvalidDomainStates` anlegen: negative Mengen, nicht endliche Zeiten und unzulässige Klassenkombinationen verletzen die Schemas; `forever:npc:1` und `era:npc:1` sind verschiedene Schlüssel. `expect(parseCheckpoint({...valid, simMs: NaN}).ok).toBe(false)`.
- [ ] **Step 3:** `npm run test -- tests/domain/contracts.test.ts` ausführen; den erwarteten fehlenden Export oder die fehlende Validierung beobachten. Domain Schemas, Typen und kleine neutrale Fixture Fabriken implementieren. Geld und Zeiten sind Ganzzahlen, Kampfwerte benutzen dokumentierte Skalierung; keine `any` Umgehung für Pflichtdaten.
- [ ] **Step 4:** Dieselbe Testsuite und `npm run typecheck` müssen erfolgreich sein. Ein Fixture enthält bewusst noch keine behaupteten Originaldaten. Domain und Starter dürfen ohne Browserzugriff importiert werden.
- [ ] **Step 5:** Diese in sich prüfbare Grundlage mit Spezifikation und Plan committen. Eintrag in `docs/superpowers/progress.md`: Verträge fertig, Produkt noch keine Spielprobe.

### Task 2: Quellenlock und verbindlicher Inhaltsnenner

**Konzept:** 01, 02, 26, 31, 32. **Abhängigkeit:** T01.

**Files:** Create `content/sources/{registry,lock}.json`, `content/snapshots/FOR-IDLE-2026-10-21-PUBLIC/{scope,reference-inventory}.json`, `tools/content/lock.ts`, `tests/content/source-lock.test.ts`.

**Interfaces:** Produces `SourceLock`, `SourceFile`, `ReferenceInventory`, `loadSourceLock(input: unknown): Result<SourceLock>`, `verifySourceFile(bytes: Uint8Array, record: SourceFile): Validation`. Jede Quelle dokumentiert Zweig, Commit/Blob, SHA-256, exakten Pfad, belegte Felder, verfügbare Sprache/Build und bekannte Grenzen. Ein fehlender Build bleibt ausdrücklich unbekannt.

- [ ] **Step 1:** Test `rejectsMutableOrChangedSource` verlangt unveränderlichen Commit oder eine gleichwertig gehashte Primärquelle. Ein falscher Hash scheitert. Test `unknownDenominatorRemainsNull`: `expect(inventory.categories.items.expectedCount).toBeNull()` bei nicht belegtem Gesamtkatalog.
- [ ] **Step 2:** `npm run test -- tests/content/source-lock.test.ts` muss zunächst scheitern.
- [ ] **Step 3:** Register implementieren. Recherchebasis aus dem freigegebenen Konzept übernehmen: QuestieDB `af56aeef176b2b7534be683907c276c52beabb6d`, classic-db `ac81ce5ebca0d8b372f199bd73c12b87b5527c52`, mangos-classic `547c55eb9cd6b7795d2951f844d679d3d7f18957`, WoWDBDefs `77582e12f6f61c7647635bc31c152b119b9dd7f9`. Weitere Quellen vor Nutzung exakt fixieren. GitHub Dateien ausschließlich mit Connector abrufen und Bytes samt Prüfsumme sichern.
- [ ] **Step 4:** Tests müssen bestehen. Der Referenzkatalog enthält alle Kategorien aus Konzept 02, begründete Ausschlüsse und separate Beta/angekündigt Felder; Importmengen ersetzen keinen unabhängigen Nenner. Bekannte neun neue Dungeons, Klassenkombinationen und drei ersten Raids gegen die freigegebenen Primärquellen abgleichen.
- [ ] **Step 5:** Quellenlock und Referenzinventar committen. Offene Belege mit stabilen Lücken IDs nach `reports/content/FOR-IDLE-2026-10-21-PUBLIC/gaps.json` schreiben.

### Task 3: Normalisierung Provenienz und Abdeckungsbericht

**Konzept:** 02, 26. **Abhängigkeit:** T02.

**Files:** Create `src/content/{provenance,coverage,capabilities}.ts`, `tools/content/{normalize,resolve}.ts`, `tests/content/coverage.test.ts`.

**Interfaces:** Produces `RawEntity`, `NormalizedEntity`, `TestEvidence`, `CoverageReport`, `normalize(records: RawEntity[], lock: SourceLock): NormalizedEntity[]`, `resolveReferences(records: NormalizedEntity[]): Result<Catalog>`, `buildCoverage(inventory: ReferenceInventory, catalog: Catalog, evidence: TestEvidence[]): CoverageReport`. Neue Inhaltsformen erweitern das zentrale Domain Inhaltsschema, ohne parallele gleichnamige Typen anzulegen.

- [ ] **Step 1:** Tests `keepsBranchesAndFieldEvidenceSeparate`, `missingRequiredFieldBlocksPlay`, `removedRequiredIdReducesCoverage` und `unknownDenominatorHasNoPercent` schreiben. Erwartung: `expect(report.categories.items.percent).toBeNull()` ohne belegten Nenner. Fehlender NPC Kampfwert ergibt `requirePlayable(npc).ok === false`.
- [ ] **Step 2:** `npm run test -- tests/content/coverage.test.ts` scheitert beobachtbar an den neuen Funktionen.
- [ ] **Step 3:** Pro Feld Quelle, Selektor, Hash, Korrekturfolge und Zustand `verified | derived | missing | conflicting` speichern. Eigene Idle Regeln liegen unter `content/adaptations/`, nicht in still veränderten Quelldaten. Referenzen, Voraussetzungsschleifen und Koordinaten prüfen. Abdeckung unterscheidet erfasst, verbunden, spielbar und geprüft; nur vorhandene Tests erlauben den letzten Status.
- [ ] **Step 4:** Tests bestehen. Bericht enthält `coverage.json`, `coverage.html`, `gaps.json`, `provenance-audit.json`; globale Vollständigkeit bleibt bei offenem Pflichtnenner gesperrt. Eine Ausschlussänderung ohne Begründung wird abgewiesen.
- [ ] **Step 5:** Normalisierung und Bericht committen.

### Task 4: Effektiver QuestieDB Import

**Konzept:** 09, 10, 26. **Abhängigkeit:** T03.

**Files:** Create `tools/content/{cli,questiedb,diff,package}.ts`, `tools/content/questiedb-corrections.json`, `tests/content/questiedb.test.ts`, `tests/fixtures/content/questiedb/`.

**Interfaces:** Produces `importQuestie(input: QuestieInputs, lock: SourceLock): ImportResult`, `packageCatalog(catalog: Catalog, snapshot: SnapshotSpec): PackageManifest`. CLI script: `npm run content:import -- --snapshot FOR-IDLE-2026-10-21-PUBLIC --frozen`.

- [ ] **Step 1:** Unabhängig belegte Fixtures für Rohdaten, jede tatsächlich verwendete Korrekturebene und Forever Zusatzdaten anlegen. `appliesCorrectionsInDocumentedOrder` muss auf ein vorher festgehaltenes wirksames Ergebnis prüfen. `rejectsUnknownCorrection` und `sameInputsProduceSameBytes` ergänzen.
- [ ] **Step 2:** `npm run test -- tests/content/questiedb.test.ts` muss scheitern.
- [ ] **Step 3:** Die tatsächliche Ladesemantik aus fixiertem README, `src/meta`, `data/Forever`, `docs/forever-delta-base.md` und Korrekturdateien dokumentieren und implementieren. Lua Tabellen strukturell lesen. Funktionale Korrekturen nur durch ausdrücklich unterstützte Transformationen ausführen; keine ungeprüfte Lua Ausführung im Browser oder Server. Unbekannte Operation stoppt den Adapter mit Datei und Operation.
- [ ] **Step 4:** Tests und eingefrorener Import bestehen. Zunächst in Staging schreiben; nur validierte Pakete aktivieren. Paketmanifest enthält Inhalte, Prüfsummen, Schema/Adapter/Regelversionen und Abhängigkeiten. Sample Questdrop Tabellen sind als begrenzte Quelle ausgewiesen, nicht als vollständige Forever Beute.
- [ ] **Step 5:** Adapter, Fixtures und Importbericht committen; große reproduzierbare Rohartefakte nur gemäß Quellen und Paketkonzept ablegen.

### Task 5: Fehlende Wertequellen und ausführbares Startpaket

**Konzept:** 04 bis 10, 15, 16, 26. **Abhängigkeit:** T04.

**Files:** Create `tools/content/client-tables.ts`, `content/authoring/{forever-overrides,start-packet}.json`, `tests/content/playable-packet.test.ts`, `reports/content/FOR-IDLE-2026-10-21-PUBLIC/effect-inventory.json`.

**Interfaces:** Produces `importBuildTables(input: BuildTableInput): ImportResult`, `validatePlayablePacket(packet: ContentPacket, capabilities: CapabilitySet): Validation`, `EffectInventory`. `BuildTableInput` verlangt Build, Locale, Hotfixstand, Tabellenbytes und passende Definitionen.

- [ ] **Step 1:** Testpaket mit einer belegten Questkette, Gegnern, Beute, Lehrer, Rezeptkette und nötigen Fähigkeiten festlegen. Tests verlangen vollständige Werte und Referenzen. `expect(validatePlayablePacket(packetWithMissingReward, capabilities).ok).toBe(false)`; dasselbe für unbekannten Effekt und Platzhaltergesundheit.
- [ ] **Step 2:** `npm run test -- tests/content/playable-packet.test.ts` scheitert.
- [ ] **Step 3:** Verfügbare aktuelle Forever Werte samt Herkunft ergänzen. Original 1.12 Tabellen bleiben Referenz und werden nicht ungeprüft übernommen. Für jede aktive Originalfähigkeit erforderliche Effekttypen inventarisieren. Kein fehlender Datensatz erhält eine erfundene Original ID oder eine Nullbelohnung. Das Startpaket verwendet nur geschlossene Abhängigkeiten; eigene balancierte Idle Parameter werden ausdrücklich als Adaption geführt.
- [ ] **Step 4:** Tests bestehen; das Startpaket ist fachlich ausführbar. Fehlende tatsächliche Quellen für übrige Inhalte bleiben im Bericht. Kein Nachweis wird allein aus der Existenz einer DBD Definition abgeleitet.
- [ ] **Step 5:** Quellengebundene Ergänzungen und Startpaket committen. Das ist die Datenbasis der Spielprobe, kein Ersatz für T23.

### Task 6: Deterministischer Simulationskern

**Konzept:** 11, 22, 27. **Abhängigkeit:** T01; Inhaltsregistry aus T03.

**Files:** Create `src/game/simulation/{queue,random,advance,serialization}.ts`, `tests/simulation/determinism.test.ts`, `docs/rulebook/time-and-random.md`.

**Interfaces:** Produces `advance(checkpoint: Checkpoint, target: SimMs, catalog: Catalog, budget: AdvanceBudget): AdvanceResult`, `serializeCheckpoint(checkpoint): Uint8Array`, `hashCheckpoint(checkpoint): string`.

- [ ] **Step 1:** Tests mit gleicher Fixture und Seed schreiben: ein langer Lauf und viele Läufe mit unterschiedlichen Ereignisbudgets enden mit identischem Checkpoint Hash. `expect(hashCheckpoint(sliced)).toBe(hashCheckpoint(whole))`. Gleiche Zeitstempel, abgesagte Aktionen und eine Nullzeit Endlosschleife gehören in eigene Fälle.
- [ ] **Step 2:** `npm run test -- tests/simulation/determinism.test.ts` muss scheitern.
- [ ] **Step 3:** PRNG mit gespeichertem Vierwortzustand, Ganzzahlzeit und stabiler Queue implementieren. Ordnung: Zeit, Phase, Sequenz. Vorgeschlagene ausdrücklich dokumentierte Idle Reihenfolge je Zeit: Ablauf alter Auren, geplante Wirkungen, Todesauflösung, ausgelöste Effekte, neue Entscheidungen. Gleichzeitige direkte tödliche Treffer werden vor der Todesauflösung beide angewandt. Darstellung und Logs ziehen keine Zufallswerte. Nullzeit Zyklen liefern einen diagnostizierten Fehler ohne Bestätigung des fehlerhaften Blocks.
- [ ] **Step 4:** Tests bestehen. Ein Yield darf Queue, RNG oder Zeit nicht anders verändern als derselbe ungeteilte Lauf. `Math.random`, Browserzeit und Renderframe sind aus dem Kern ausgeschlossen.
- [ ] **Step 5:** Kern und nachvollziehbare Zeitregeln committen.

### Task 7: Kampf Effekte Bedrohung und Taktik

**Konzept:** 06, 10, 11, 12. **Abhängigkeit:** T05, T06.

**Files:** Create `src/game/combat/{effects,attack,auras,threat,positions,tactics}.ts`, `tests/combat/resolution.test.ts`, `docs/rulebook/combat.md`.

**Interfaces:** Produces `CombatAction`, `Effect`, `EffectContext`, `Resolution`, `ActionChoice`, `resolveAction(checkpoint: Checkpoint, action: CombatAction, catalog: Catalog): Resolution`, `chooseAction(actor: ActorState, state: GameState, catalog: Catalog): ActionChoice`, `applyEffects(checkpoint: Checkpoint, effects: Effect[], context: EffectContext): Resolution`. `Resolution` enthält neuen Checkpoint samt aktualisiertem RNG und geplanten Ereignissen, keine bereits persistierte Belohnung. Alle zufälligen Wirkungen verändern ausschließlich den übergebenen Checkpoint RNG.

- [ ] **Step 1:** Tests für Ressourcenpreis, Wirkzeit, GCD, Unterbrechung, Immunität, Rüstung, Absorption, periodische Effekte, Stapelregeln und Bedrohung anlegen. Fixture: 100 Schaden minus 20 Absorption ergibt exakt 80 tatsächlichen Schaden. Ein unterbrochener Heilzauber heilt null. Dreizehn Taktikregeln werden abgewiesen.
- [ ] **Step 2:** `npm run test -- tests/combat/resolution.test.ts` scheitert.
- [ ] **Step 3:** Effektinventar aus T05 schrittweise mit echter Semantik unterstützen. Datengebundene Formeln und Rundung im Regelbuch festhalten. Bedrohung pro Gegner, zulässige Ziele und Positionssektoren beachten. Bis zwölf Regeln in Reihenfolge prüfen; jede nicht ausführbare Aktion erhält einen konkreten Grund. Unbekannte Effekte bleiben gesperrt, statt still nichts zu tun.
- [ ] **Step 4:** Tests bestehen. Eine Fallkombination aus Buffablauf, Zonenwechsel, DoT und gleichzeitigem Tod hat ein festes erwartetes Ergebnis. Jeder unterstützte Effekttyp hat eine beobachtbare Wirkung und mindestens einen fachlichen Nachweis.
- [ ] **Step 5:** Kampf und Taktik committen; Capability Register aktualisieren.

### Task 8: Alle Klassen Talente Völker und Begleiter

**Konzept:** 04, 05, 06, 20. **Abhängigkeit:** T07.

**Files:** Create `src/game/classes/{creation,resources,forms,talents,pets,training}.ts`, `tests/classes/{creation,mechanics,talents}.test.ts`, `content/authoring/class-defaults.json`.

**Interfaces:** Produces `CreateCharacterInput`, `DerivedActor`, `LearnAbilityInput`, `createCharacter(input: CreateCharacterInput, catalog: Catalog): Result<CharacterState>`, `deriveActor(actor: ActorState, catalog: Catalog): DerivedActor`, `validateTalentAllocation(actor: ActorState, allocation: Readonly<Record<EntityKey, number>>, catalog: Catalog): Validation`, `learnAbility(state: GameState, input: LearnAbilityInput, catalog: Catalog): Result<GameState>`.

- [ ] **Step 1:** Erlaubte Kombinationen aus dem Quellenkatalog parametrisiert prüfen; verbotene auch beim direkten Befehl ablehnen. Mechaniktests: zielgebundene Kombopunkte, Wutgewinn, Energieregeneration, Druidengestalt und erlaubte Aktionen, eigener Tierangriff und Bedrohung, Totemgruppe, Dämon und Heilrolle. Talentvoraussetzungen und Ränge prüfen; ein gelerntes Talent verändert einen ausgeführten Effekt.
- [ ] **Step 2:** `npm run test -- tests/classes` muss scheitern.
- [ ] **Step 3:** Neun Klassen mit gemeinsamen Akteur und Effektbausteinen implementieren. Pets sind Akteure mit eigenen Abklingzeiten, Gesundheit, Taktik und Zuständen. Volksfähigkeiten besitzen aktuelle Daten statt erinnerter Vanilla Werte. Drei Talentbäume je Klasse samt Forever Meilensteinen und dualer Spezialisierung aus den Daten. Lehrer, Klassenquests und Reagenzien verbinden. Jede angebotene Spezialisierung erhält eine ausführbare Standardtaktik.
- [ ] **Step 4:** Alle Klassenprüfungen bestehen; Tank, Heiler und Schaden sind tatsächlich spielbar. Ein Tier verbraucht keinen normalen Gruppenplatz. Ungelernter Rang, falsche Gestalt oder fehlendes Reagenz ändern den Zustand nicht.
- [ ] **Step 5:** Klassenpaket und Quellenbezug committen.

**Teilpakete:** Den Prüf/Implementierungs/Commit Zyklus von T08 getrennt für Krieger, Paladin, Jäger, Schurke, Priester, Schamane, Magier, Hexenmeister und Druide ausführen. Jedes Teilpaket deckt seine drei Talentprofile, Ressourcen und Klassenbesonderheiten ab und erhält eine eigene fachliche Prüfung. Gemeinsame Klassenverträge vor dem ersten Teilpaket festhalten; eine spätere Klasse darf sie nicht unbemerkt ändern.

### Task 9: Inventar Ausrüstung und Beutetransaktionen

**Konzept:** 10, 15, 27. **Abhängigkeit:** T07.

**Files:** Create `src/game/inventory/{items,equipment,loot,pending-rewards,sets}.ts`, `tests/inventory/{equipment,loot}.test.ts`.

**Interfaces:** Produces `EquipmentSlot`, `LootResolution`, `equipItem(state: GameState, instanceId: string, slot: EquipmentSlot, catalog: Catalog): Result<GameState>`, `rollLoot(checkpoint: Checkpoint, sourceKey: EntityKey, rewardId: string, catalog: Catalog): LootResolution`, `claimPendingReward(state: GameState, rewardId: string, catalog: Catalog): Result<GameState>`. `LootResolution` enthält den neuen Checkpoint samt RNG und offenen Belohnungen; es gibt keinen außerhalb des Checkpoints gehaltenen Beutezufall.

- [ ] **Step 1:** Tests für Zweihand/Nebenhand, Klassenbindung, Einzigartigkeit, Setbonus, Stapel und Ausrüstungssatz anlegen. Loot Fixtures unterscheiden garantierte, unabhängige, exklusive und referenzierte Gruppen. Bei vollem Beutel: `expect(pending.rolledItems).toEqual(originalRoll)` nach Wiederaufnahme; wiederholte `rewardId` erzeugt keine zweite Beute.
- [ ] **Step 2:** `npm run test -- tests/inventory` scheitert.
- [ ] **Step 3:** Inventarinstanzen mit dauerhaften IDs, geschützten Gegenständen, Slotkapazität und eindeutiger Belohnungszuordnung implementieren. Bei voller Tasche bereits ausgewürfelte Beute speichern und pausieren. Setboni, Verzauberungen und Procs verwenden das Effektsystem. Auto Verkauf schützt Quest und gesperrte Gegenstände. Ausrüstungssätze referenzieren vorhandene Instanzen.
- [ ] **Step 4:** Tests bestehen. Beute und Gold werden erst über die spätere gemeinsame Serverbestätigung dauerhaft; Neuladen kann keinen neuen Wurf auslösen. Zyklische Beutereferenzen scheitern bereits in T03.
- [ ] **Step 5:** Inventar und Belohnungspipeline committen.

### Task 10: Quests Erfahrung und Freischaltungen

**Konzept:** 03, 09, 20. **Abhängigkeit:** T08, T09.

**Files:** Create `src/game/quests/{requirements,objectives,progress,rewards}.ts`, `src/game/progression.ts`, `tests/quests/quest-flow.test.ts`.

**Interfaces:** Produces `applyGameEvent(state: GameState, event: GameEvent, catalog: Catalog): GameState`, `acceptQuest(state: GameState, questKey: EntityKey, catalog: Catalog): Result<GameState>`, `turnInQuest(state: GameState, questKey: EntityKey, choiceId: string | null, catalog: Catalog): Result<GameState>`, `grantExperience(state: GameState, amount: number, catalog: Catalog): GameState`.

- [ ] **Step 1:** Verifizierte Startquest als Fixture: falscher Gegner und Sieg vor Annahme zählen nicht; passende Siege erhöhen genau erlaubte Ziele. Vorzeitige Abgabe scheitert. Bei Belohnungsauswahl ohne `choiceId` wird pausiert; zweite Abgabe vergibt nichts. Tests für Voraussetzung, gegenseitigen Ausschluss, Eskortfehlschlag und gemeinsame erlaubte Zielgutschrift ergänzen.
- [ ] **Step 2:** `npm run test -- tests/quests/quest-flow.test.ts` scheitert.
- [ ] **Step 3:** Ereignisbasierte Ziele, Queststatus und Belohnungen implementieren. Erfahrung führt bis 60; Freischaltungen referenzieren Quellenbedingungen. Sprechen, Benutzen, Erkunden, Begleiten und Verteidigen erhalten eigene auswertbare Ziele. Fehlende narrative oder Belohnungsdaten bleiben Lücken, keine automatisch abgeschlossenen Timer.
- [ ] **Step 4:** Die vollständige Folge annehmen, reisen, Ziel erfüllen, Gegenstand beanspruchen, auswählen und abgeben besteht. Zwei identische Ereignis IDs erzeugen keinen doppelten Fortschritt.
- [ ] **Step 5:** Quest und Fortschrittssystem committen.

### Task 11: Welt Reisen Erkundung und Aktivitätsfolge

**Konzept:** 07, 08, 09, 21. **Abhängigkeit:** T10.

**Files:** Create `src/game/world/{map,routes,travel,discovery,events}.ts`, `src/game/activities/queue.ts`, `tests/world/travel.test.ts`.

**Interfaces:** Produces `TravelPlan`, `Activity`, `ActivityStep`, `planRoute(state: GameState, destination: EntityKey, catalog: Catalog): Result<TravelPlan>`, `startActivity(state: GameState, activity: Activity, catalog: Catalog): Result<GameState>`, `setActivityQueue(state: GameState, steps: ActivityStep[], catalog: Catalog): Result<GameState>`.

- [ ] **Step 1:** Testgraph mit Fußweg, unbekanntem Flugpunkt, fraktionsgebundenem Hafen und gesperrter Kante anlegen. Unbekannter Flugpunkt darf nicht benutzt werden. Elf geplante Schritte werden abgewiesen. Ruhestein benötigt Bindungsort und bereiten Cooldown; eine unterbrochene Reise setzt ohne Zeitgewinn fort.
- [ ] **Step 2:** `npm run test -- tests/world/travel.test.ts` scheitert.
- [ ] **Step 3:** Graphsuche, Reisezeit, Goldkosten, Entdeckungen und ortsgebundene Aktionen implementieren. Aufträge verbinden vorhandene Wege. Neue Forever Verbindungen verwenden ihre eigenen Daten. Events erhalten Bedingungen und Herkunft; eigene Ereignisse sind Idle Zusätze. Sicherheit stoppt vor nicht freigegebenem Risiko, ohne vergangene Kosten rückgängig zu machen.
- [ ] **Step 4:** Tests bestehen. Jede verbundene Zone hat eine erreichbare gültige Route oder einen begründeten Ausnahmezustand. Ortswechsel ist ein Ereignis der gemeinsamen Zeitbasis.
- [ ] **Step 5:** Welt und Tätigkeitsfolge committen.

### Task 12: Berufe Rezeptketten und Camping

**Konzept:** 16, 17. **Abhängigkeit:** T09, T11.

**Files:** Create `src/game/professions/{skills,gather,craft,training}.ts`, `src/game/camping/{camp,objects,buffs}.ts`, `tests/professions/chains.test.ts`.

**Interfaces:** Produces `CraftPlan`, `planCraft(state: GameState, recipeKey: EntityKey, quantity: number, catalog: Catalog): Result<CraftPlan>`, `applyCraftCompletion(checkpoint: Checkpoint, craftId: string, catalog: Catalog): Result<Checkpoint>`, `placeCampObject(state: GameState, actorId: string, objectKey: EntityKey, catalog: Catalog): Result<GameState>`. Zufälliger Fertigkeitsanstieg und Zusatzertrag verwenden denselben gespeicherten Checkpoint RNG.

- [ ] **Step 1:** Belegte Materialkette sammeln, verarbeiten, herstellen, ausrüsten prüfen. Tests für letzten Materialstapel, fehlenden Arbeitsplatz, unbekanntes Rezept, benötigtes Werkzeug, Fertigkeitsanstieg, sekundäre Fertigkeiten und Berufsspezialisierung. Camping Tests: Kapazitäten 3/5/10, Beitrag je Gruppenmitglied, Kosten/Cooldown und ausschließende Buffgruppe.
- [ ] **Step 2:** `npm run test -- tests/professions/chains.test.ts` scheitert.
- [ ] **Step 3:** Alle vorgesehenen neun primären und drei sekundären Berufsarten implementieren, tatsächliche Rezeptdaten getrennt importieren. Klassenspezifische Fertigkeiten nicht als zusätzliche Hauptberufe zählen. Nur eine zeitraubende Haupttätigkeit; Materialnachschub plant erreichbare Schritte. Camping nutzt echte anwesende NPC Gruppenmitglieder als ausdrücklich benannte Adaption.
- [ ] **Step 4:** Tests bestehen. Zutatenbilanz stimmt für Abbruch und Wiederaufnahme. Ein Lagerbonus entsteht erst nach Aufbau/Rast und lässt sich nicht mit derselben Buffgruppe mehrfach stapeln.
- [ ] **Step 5:** Berufe und Camping committen.

### Task 13: Wirtschaft Ruf Gilde Handel und Post

**Konzept:** 18, 20. **Abhängigkeit:** T12.

**Files:** Create `src/game/economy/{vendors,market,reputation,mail,trade,guild}.ts`, `tests/economy/transactions.test.ts`.

**Interfaces:** Produces `MailDraft`, `TradeOffer`, `MarketInput`, `MarketQuote`, `buyItem(state: GameState, vendorKey: EntityKey, itemKey: EntityKey, quantity: number, costLimit: number, catalog: Catalog): Result<GameState>`, `sendMail(profile: ProfileState, draft: MailDraft, catalog: Catalog): Result<ProfileState>`, `executeTrade(profile: ProfileState, offer: TradeOffer, catalog: Catalog): Result<ProfileState>`, `quoteMarket(state: GameState, input: MarketInput, catalog: Catalog): MarketQuote`.

- [ ] **Step 1:** Tests für Händlerbestand, Rufvoraussetzung, Höchstkosten, geschützten Verkauf, gebundene Postanlage und erlaubte Sendung zwischen eigenen Charakteren. Doppelte Sendung mit gleicher ID ändert Bestände nicht erneut. Ein Ankauf/Verkauf Zyklus mit fixem Marktstand darf Gold nicht vermehren.
- [ ] **Step 2:** `npm run test -- tests/economy/transactions.test.ts` scheitert.
- [ ] **Step 3:** Gold und Warenbilanzen gemeinsam verändern. Händler nutzen geprüfte Waren; simulierter Markt hat feste transparente Grenzen und begrenzte Bestände. Rufpfade, Rezepte und Preise wirken tatsächlich. NPC Gilde verwaltet Gruppenorganisation. Post und direkter Handel haben Bindungs/Fraktionsregeln. Keine erfundenen menschlichen Marktteilnehmer oder Chats.
- [ ] **Step 4:** Tests bestehen. Handelsaktionen erzeugen eindeutige Buchungseinträge und keinen verdeckten passiven Mehrfachertrag. Markt, Gilde und Post bleiben Pflichtbereiche des vollständigen Zielumfangs.
- [ ] **Step 5:** Wirtschaftssystem committen.

### Task 14: NPC Gruppen Dungeons Raids und Weltbosse

**Konzept:** 12, 13, 14. **Abhängigkeit:** T08, T10, T11, T12.

**Files:** Create `src/game/encounters/{party,access,rooms,mechanics,lockouts,world-bosses}.ts`, `tests/encounters/{party,mechanics}.test.ts`.

**Interfaces:** Produces `PartyState`, `MechanicTrigger`, `validateParty(party: PartyState, encounterKey: EntityKey, state: GameState, catalog: Catalog): Validation`, `startEncounter(state: GameState, encounterKey: EntityKey, party: PartyState, catalog: Catalog): Result<GameState>`, `applyMechanic(checkpoint: Checkpoint, trigger: MechanicTrigger, catalog: Catalog): Resolution`.

- [ ] **Step 1:** Tests für echte Gruppen mit 5/10/20/40 Teilnehmern plus Pets/Adds anlegen. Alle 40 Teilnehmer erhalten eigene Aktionen; Heilung wählt den richtigen Verbündeten, Unterbrechung verhindert echten Cast, Positionierungsfehler verursacht Schaden. Phase samt Adds setzt nach Checkpoint identisch fort. Fehlender Schlüssel und aktive Sperre verhindern Start.
- [ ] **Step 2:** `npm run test -- tests/encounters` scheitert.
- [ ] **Step 3:** Rollen, Untergruppen und räumliche Buffgrenzen implementieren. Räume, Patrouillen, Abzweigungen, optionale Bosse und Objektaktionen nutzen den Inhaltsgraph. Originale Zugänge erhalten; Siege erzeugen keine erfundene lineare Raidfolge. Bossphasen verwenden unterstützte Effekte. Weltbosse erhalten eigene Verfügbarkeit und ausdrücklich markierte Einzelspieler Übersetzung von Konkurrenz.
- [ ] **Step 4:** Tests bestehen. Jede als spielbar markierte Begegnung hat einen erfolgreichen und einen nachvollziehbar scheiternden Prüfverlauf. Die drei bestätigten Raidgrößen bleiben 10/20/40; kein pauschales Zusammenlegen zu zehn Akteuren.
- [ ] **Step 5:** Instanzsystem committen; konkrete noch nicht belegte Bossmechaniken bleiben in T23 offen.

### Task 15: Schlachtfelder Welt PvP und Rangfortschritt

**Konzept:** 19. **Abhängigkeit:** T14, T13.

**Files:** Create `src/game/pvp/{battleground,objectives,teams,honor,seasons,world-pvp,duels}.ts`, `tests/pvp/objectives.test.ts`.

**Interfaces:** Produces `PvpRole`, `PvpOutcome`, `startBattleground(state: GameState, mapKey: EntityKey, role: PvpRole, catalog: Catalog): Result<GameState>`, `advanceObjectives(state: GameState, event: GameEvent, catalog: Catalog): GameState`, `grantPvpResult(state: GameState, resultId: string, outcome: PvpOutcome, catalog: Catalog): GameState`.

- [ ] **Step 1:** Darkspear Fixture: 15 gegen 15, vier kontrollierbare Punkte, mittlere Flagge, Sieg bei 2000 Punkten. Ohne Zielbeitrag steigt kein Zielpunktestand allein durch Zeitablauf eines Ergebnisfensters. Rangvoraussetzungen, Wochenkappe und doppelte Ergebnis ID prüfen. Welt PvP ist nur im gewählten Konfliktmodus aktiv.
- [ ] **Step 2:** `npm run test -- tests/pvp/objectives.test.ts` scheitert.
- [ ] **Step 3:** NPC Teams mit Rollen und echten Klassenaktionen simulieren. Kontrollpunkt und Flaggenregeln bestimmen den Ausgang. Ehre und Rangpunkte getrennt speichern; Aufwertung erfordert tatsächlichen blauen Gegenstand, Siegel und Rang. Kalender und Aufgaben nutzen bestätigte Regeln. Weitere Schlachtfelder erst nach Datenprüfung aktivieren. Duelle und Weltkonflikte als NPC Simulation kennzeichnen.
- [ ] **Step 4:** Tests bestehen. Beide Teams können gewinnen; Sieg und Niederlage entstehen aus dem Verlauf. Neu laden verändert weder Saisonzeit noch Belohnung. Keine Online Rangliste vortäuschen.
- [ ] **Step 5:** PvP System committen.

### Task 16: Vermächtnis Sicherheit und Offline Verlauf

**Konzept:** 20, 21, 22. **Abhängigkeit:** T13, T14, T15.

**Files:** Create `src/game/legacy/{challenges,allocation,collections}.ts`, `src/game/activities/{safety,recovery,catchup}.ts`, `tests/{legacy/progression,activities/offline}.test.ts`.

**Interfaces:** Produces `SafetyPolicy`, `SafetyDecision`, `CatchupPlan`, `allocateLegacy(profile: ProfileState, characterId: string, allocation: Readonly<Record<EntityKey, number>>, catalog: Catalog): Result<ProfileState>`, `assessSafety(state: GameState, policy: SafetyPolicy): SafetyDecision`, `prepareCatchup(checkpoint: Checkpoint, serverAnchor: EpochMs, capturedNow: EpochMs): CatchupPlan`. `CatchupPlan` friert Zielspielzeit, betrachtete Serverzeit und ausgeschlossene Zeit einmalig ein.

- [ ] **Step 1:** Legacy Fixture umfasst 65 Herausforderungen mit Kategorien 27/18/12/2/3/3 und maximal 16 ausgegebenen Punkten pro Charakter. Dieselbe Herausforderung zählt einmal. Offline Tests vergleichen identischen 24 Stunden Verlauf mit sichtbaren Teilschritten. Standard stoppt nach erstem Tod; Opt-in nach zweiter aufeinanderfolgender Niederlage; ein Sieg setzt diesen Zähler zurück. Kostenlimit, Materialmangel und volle Tasche stoppen mit genauem Grund.
- [ ] **Step 2:** `npm run test -- tests/legacy tests/activities` scheitert.
- [ ] **Step 3:** Konto und Charakterfortschritt korrekt trennen. Recovery, Reparatur und Wiederanreise kosten echte Simulationszeit. `prepareCatchup` begrenzt einmal auf `86_400_000`; blockweise Weiterführung benutzt das festgehaltene Ziel. Bei notwendiger Belohnungswahl nicht automatisch entscheiden. Hinter einem Stop entsteht keine unbemerkte Aktivität.
- [ ] **Step 4:** Tests bestehen. Reload von zwanzig Chunks gewinnt keine weitere ausgeschlossene Stunde. Auch beim frühen Stop wird der betrachtete Serverzeitraum bestätigt, ohne pausierte Restzeit als künftiges Guthaben zu speichern. Ein voller Beutel erhält bereits gewürfelte Beute. Hardcore bleibt deaktiviert, bis eigene Regeln und Nachweise vollständig sind; keine vermeintlich harmlose Aktivierung im Menü.
- [ ] **Step 5:** Vermächtnis und Offline Fachlogik committen.

### Task 17: Autoritativer Speicher und technischer Machbarkeitsnachweis

**Konzept:** 22, 27, 28. **Abhängigkeit:** T06, T16.

**Files:** Create `src/server/game/{repository,leases,catchup}.ts`, `tests/server/{authority.test,d1-harness}.ts`, `tools/bench/offline.ts`; Modify `db/schema.ts`, `cloudflare-env.d.ts`, `.openai/hosting.json`; Generate neue `drizzle/*.sql`.

**Interfaces:** Produces `CommitBundle`, `CommitResult`, `LeaseResult`, `CatchupResult`, `GameRepository.load(ownerId: string): Promise<ProfileSnapshot>`, `commit(bundle: CommitBundle): Promise<CommitResult>`, `acquireLease(ownerId: string, sessionId: string, now: EpochMs): Promise<LeaseResult>`, `continueCatchup(ownerId: string, jobId: string, leaseToken: string): Promise<CatchupResult>`. `CommitBundle` enthält erwartete Profilrevision, eindeutige Versuch ID, neue Zustände, Receipt, Jobcursor, RNG und Queue. Lease gehört zum Profil. Der Testharness führt die generierten Migrationen auf einer lokalen Miniflare D1 Instanz aus.

- [ ] **Step 1:** Gegen lokale D1 Semantik Tests für konkurrierende Tabs, zwei aktive Charaktere, alte Revision, verlorene Antwort, abgelaufene Lease mitten im Block und Übernahme schreiben. Identischer Befehl liefert zuerst den gespeicherten Receipt, auch bei inzwischen alter Revision; gleiche ID mit anderem Payload ergibt Konflikt. Ein erzwungener Fehler vor Bestätigung darf keinerlei Teilbuchung hinterlassen.
- [ ] **Step 2:** `npm run test -- tests/server/authority.test.ts` scheitert. Eine reine Repository Attrappe genügt nicht als D1 Transaktionsnachweis.
- [ ] **Step 3:** D1 Schema für Profile, Charakterzustände, Befehlsreceipts, Leases, Jobs und Checkpoints implementieren. Alle zusammengehörigen Schreibvorgänge in einem atomaren Batch mit Profil CAS durchführen. Konkreter Guard: erster bedingter Profilupdate setzt eine einmalige Commit Versuch ID; alle abhängigen Statements sind auf genau diesen Marker beschränkt. Ein fehlgeschlagener CAS führt deshalb auch ohne SQL Fehler zu null abhängigen Änderungen. Bei CAS Konflikt den Receipt erneut lesen, um inzwischen erfolgreich bestätigte identische Befehle korrekt zurückzugeben. Jobziel und Serverzeit werden nie pro Chunk neu berechnet. Datenmigrationen sind schemabezogen; Inhaltsimporte liegen separat.
- [ ] **Step 4:** Tests bestehen. Benchmark mit 24 Stunden und 40 Teilnehmern plus Pets/Adds misst Heap, CPU pro Chunk, Gesamtereignisse, Zahl Requests und vollständige Ergebnisgleichheit. Startbudget 10.000 Ereignisse, bei belegtem Zeitlimit früher sauber yielden; Endzustand muss budgetunabhängig bleiben. Produktionslimits und tatsächlich gemessene Maxima in `reports/performance/offline.json` festhalten. Bei Überschreitung Chunking verbessern oder 24 Stunden Zusage vor Freigabe korrigieren.
- [ ] **Step 5:** Schema, Migrationen und Machbarkeitsbericht committen. Bestätigte Lease Dauer 60 Sekunden mit Erneuerung nach 15 Sekunden ist eine Implementierungswahl; Ablaufprüfung nutzt allein Serverzeit. Ohne belastbaren Nachweis keine Cloud/Offline Garantie veröffentlichen.

### Task 18: Geschützte API und Client Verbindung

**Konzept:** 24, 27. **Abhängigkeit:** T17.

**Files:** Create `src/server/game/commands.ts`, `app/api/game/{state,commands,lease,catchup}/route.ts`, `src/ui/{client,view}.ts`, `tests/server/api.test.ts`; Modify `app/page.tsx`, `app/layout.tsx`.

**Interfaces:** Produces `CommandReceipt`, `dispatchCommand(ownerId: string, envelope: CommandEnvelope): Promise<CommandReceipt>`, `projectGameView(state: GameState, catalog: Catalog): GameView`, `fetchGameView(): Promise<GameView>`, `sendCommand(envelope: CommandEnvelope): Promise<CommandReceipt>`. API: GET `/api/game/state`; POST `/api/game/commands`, `/api/game/lease`, `/api/game/catchup`. Authentifizierung verwendet die vorhandenen serverseitigen Sites Helfer.

- [ ] **Step 1:** Tests: fehlende Identität 401, fremder Profilzugriff 403, ungültige Domain Eingabe 400, Revisions/Lease Konflikt 409. Simulierte verlorene Antwort mit gleicher `commandId` liefert dasselbe Ergebnis. Während Rückkehrberechnung sind gewöhnliche Mutationen 409 `CATCHUP_RUNNING`; Übernahme und ausdrücklich angeforderter Abbruch haben eigene gültige Wege.
- [ ] **Step 2:** `npm run test -- tests/server/api.test.ts` scheitert.
- [ ] **Step 3:** Dünne Routen implementieren, Eigentümer aus Sites Identität ableiten und niemals aus Clientdaten übernehmen. Geschützte Seite dynamisch rendern. Keine eigenen OAuth oder reservierten Sign-in Routen. Der Client zeigt bestätigten Zustand; lokale Animationsvorhersage kann keine Beute gewähren. Abbruch eines Rückkehrjobs bestätigt den bereits berechneten Teil und zeigt verworfene Restzeit ausdrücklich.
- [ ] **Step 4:** Tests bestehen. Aktiver Charakterwechsel bestätigt denselben Profilzustand atomar. Netzabbruch zeigt Wiederverbinden statt Erfolg zu erfinden. Eine fremde importierte Figur wird keinem falschen Profil zugeordnet.
- [ ] **Step 5:** API und Client committen.

### Task 19: Originale WoW Bauteile und Grafikatlas

**Konzept:** 23, 24, 25, 32. **Abhängigkeit:** T01, T02.

**Files:** Create `assets/{source-lock,components,crops}.json`, `tools/assets/prepare.ts`, `src/ui/wow/{Frame,Button,IconSlot,UnitFrame,Tooltip,ActionBar,Minimap,ProgressBar}.tsx`, `src/ui/wow/theme.css`, `tests/ui/components.test.ts`, `docs/qa/wow-components.md`; Add browsergeeignete Dateien unter `public/assets/`.

**Interfaces:** Produces `WowFrame`, `WowButton`, `IconSlot`, `UnitFrame`, `WowTooltip`, `ActionBar`, `Minimap`, `ProgressBar`; Props beschreiben Darstellung und Callback, enthalten keine Spielregeln. `prepareAssets(manifest: AssetManifest): PreparedAssetManifest`.

- [ ] **Step 1:** Test `atlasCropUsesDeclaredRectangle` verifiziert echte Bildabmessungen und Zuschnittbereiche. Zustandsmatrix umfasst normal, gedrückt, hervorgehoben, deaktiviert, gewählt und Cooldown. Ein zu großer Zuschnitt scheitert. Prüffälle mit langen deutschen Namen und fehlendem Icon anlegen.
- [ ] **Step 2:** `npm run test -- tests/ui/components.test.ts` scheitert.
- [ ] **Step 3:** Fixierte Originaldateien ausschließlich über den GitHub Connector beschaffen. Basis: `doorknob6/vanilla-wow-interface-textures`, ergänzend `Gethe/wow-ui-textures` ausdrücklich Branch `classic`, danach Commit fixieren. Herkunft und dokumentierten Nutzungsstand beilegen. Rahmen aus Originalecken und Kanten, Dialog und Knopfzustände korrekt ausschneiden. Keine Atlasstreifen auf ein ganzes Fenster verzerren. Fehlende Ergänzungen manuell und getrennt markieren.
- [ ] **Step 4:** Tests bestehen. Komponentenwerkbank im internen Sites Preview bei gleicher Skalierung mit festgehaltenen klassischen Referenzen vergleichen: Aktionsleiste/Endstücke, Minimap, Unitframes, Tasche, Charakterbogen, Questpergament, Talente, Dialog, Tooltip. Ergebnisse pro Bauteil dokumentieren; keine pauschale Freigabe aus einem Seitenscreenshot.
- [ ] **Step 5:** Bauteile, Assets und Herkunft committen. Keine generischen Dashboard Karten als WoW Ersatz einführen.

### Task 20: Durchgehende erste Spielprobe

**Konzept:** 03, 04, 09, 15, 23, 24. **Abhängigkeit:** T05, T08 bis T12, T18, T19.

**Files:** Create `src/ui/{GameShell,WindowManager}.tsx`, `src/ui/navigation.ts`, `src/ui/windows/{CharacterCreation,WorldMap,QuestLog,Combat,Inventory,ReturnReport}.tsx`, `tests/ui/first-session.test.ts`, `docs/qa/first-session.md`; Modify reine Darstellung in `src/ui/view.ts`.

**Interfaces:** Consumes `GameView` und `projectGameView` aus T01/T18. Produces `UiState`, `WindowView`, `selectWindowView(view: GameView, ui: UiState): WindowView`, `GameShell({view,onCommand})`, `WindowManager`. Fensterzustand enthält Fokus, Stapelung und Auswahl; er verändert keine aktive Tätigkeit. Die Serverprojektion benötigt keinen lokalen Fensterzustand.

- [ ] **Step 1:** Interaktionsprüfung für erlaubte Charakterwahl, richtigen Startort, Questannahme, Kartenroute, Kampf, tatsächliche Beute, Vergleich/Ausrüsten und Questabgabe schreiben. Eine fehlende Voraussetzung wird als konkreter Sperrgrund dargestellt. Zustandsbestätigung über den echten Command Vertrag prüfen, nicht durch lokale Erfolgsmeldungen.
- [ ] **Step 2:** `npm run test -- tests/ui/first-session.test.ts` scheitert.
- [ ] **Step 3:** Hauptansicht mit Weltbereich und aufliegenden WoW Fenstern umsetzen. 1440 Layout: links etwa 220 px, rechts etwa 280 px, oben Unitframes und Minimap, unten Aktionsleiste/Taschen/Log. Erster Lernablauf eröffnet Systeme schrittweise. `C`, `M` und konfigurierbare Tasten über WindowManager routen; Eingabefelder dürfen keine Kampfbefehle auslösen.
- [ ] **Step 4:** Tests bestehen; danach Browser QA über den unterstützten `cua_repl` Sites Preview: frischer Charakter erfüllt den gesamten Startablauf; Neuladen und Rückkehr setzen denselben Verlauf fort. Ergebnis in QA Dokument, offene Fehler konkret beheben. Kein Produktstatus „vollständig“.
- [ ] **Step 5:** Durchgehende Spielprobe committen. Erste reviewbare Spielansicht ist vorhanden; Endumfang bleibt offen.

### Task 21: Sämtliche Spielsysteme vollständig bedienbar

**Konzept:** 06 bis 24. **Abhängigkeit:** T13 bis T16, T20.

**Files:** Create `src/ui/windows/{Talents,Spellbook,Professions,Camping,Party,Expedition,PvP,Legacy,Reputation,Vendors,Market,Mail,Guild,Collections,Settings}.tsx`, `tests/ui/system-flows.test.ts`, `docs/qa/system-flows.md`.

**Interfaces:** Consumes `GameView` und `GameCommand` aus T18/T20; Produces Window Registry mit genau einem vollständigen Bedienweg je freigegebenem System. Neue Befehlsvarianten werden im gemeinsamen Domain Vertrag ergänzt.

- [ ] **Step 1:** Fachliche Journeys testen: Talent lernen verändert Effekt; Rezept fehlt Werkzeug; Camping Aufbau erzeugt Bonus; Gruppe vorbereiten/starten; Belohnung aufheben; Ranggegenstand aufwerten; Legacy Punkte verteilen; Mail an eigenen anderen Charakter senden. Ein gesperrter Inhalt nennt die tatsächlich fehlende Voraussetzung.
- [ ] **Step 2:** `npm run test -- tests/ui/system-flows.test.ts` scheitert.
- [ ] **Step 3:** Fenster mit Originalbauteilen erstellen. Taktikeditor bis zwölf Regeln, Aktivitätsfolge bis zehn Schritte, Pet/Gestalt/Zauberrang und Ausrüstungssätze vollständig bedienen. Inventar besitzt gleichwertige Klickaktionen für Drag and Drop. Markt und PvP ausdrücklich simuliert benennen. Fehler, Rückzug, Pause, Fortsetzen und Wipe erhalten echte Aktionen.
- [ ] **Step 4:** Tests und Browser Journeys bestehen. Kleine Breiten 759/760 und 1099/1100 sowie 1440 prüfen: sichtbarer Fokus, erreichbare Schließenknöpfe, keine abgeschnittenen Tooltips und langen Texte. Schriftgröße, Bewegung, Audio und Tastatur sind wirksame Einstellungen.
- [ ] **Step 5:** Vollständige Bedienung committen. Menüs ohne implementierte Rückwege bleiben offene Aufgaben, auch wenn ihr Hauptknopf funktioniert.

### Task 22: Three.js Weltbühnen Animationen und Audio

**Konzept:** 07, 17, 25. **Abhängigkeit:** T19, T20.

**Files:** Create `src/world/{WorldStage,SceneLoader,AnimationController,picking,Effects,Audio}.ts`, `assets/scenes.json`, `src/ui/WorldCanvas.tsx`, `tests/ui/world-stage.test.ts`, `docs/qa/scenes.md`.

**Interfaces:** Produces `WorldStage.mount(canvas: HTMLCanvasElement, settings: RenderSettings): WorldStage`, `stage.setScene(view: SceneView): void`, `stage.dispose(): void`, `selectSceneView(view: GameView): SceneView`, `RenderSettings`. `WorldSelection` ist die Union `{kind: 'actor'; actorId: string; entityKey: EntityKey} | {kind: 'location' | 'resource' | 'object'; entityKey: EntityKey}`. Sie ist ausschließlich Auswahl, kein Schadens oder Beutebefehl. Zwei gleichnamige Mobinstanzen bleiben über `actorId` unterscheidbar. Der Browserrenderer benötigt keinen kompletten Serverzustand.

- [ ] **Step 1:** Testframe Uhr mit 120 angebotenen Frames innerhalb einer Sekunde: höchstens 60 Renderdurchläufe. Versteckte Szene rendert nicht. Szenewechsel entsorgt Ressourcen; Kontextverlust lässt GameView und Command Bedienung intakt. Auswählen in Szene und Liste öffnet dieselbe Aktion.
- [ ] **Step 2:** `npm run test -- tests/ui/world-stage.test.ts` scheitert.
- [ ] **Step 3:** Kleine zonenspezifische Bühnen mit Licht, Parallaxe und optionalem Wetter erstellen. Originalmodelle nur nach konkreter erfolgreicher Konvertierung verwenden; fehlende Kulissen, Requisiten und Animationen manuell bauen. Ruhe, Reise, Angriff, Zaubern, Treffer und Tod unterstützen. Instanz und Lagerzustand spiegeln bestätigte Ereignisse wider. Pixelauflösung, Schatten und Partikel begrenzen; Audio erst nach Benutzereingabe.
- [ ] **Step 4:** Tests und visuelle Szenenprüfung bestehen. Fehlende Textur nutzt sauberen Ersatz, 3D aus lässt sämtliche Spielaktionen bestehen. Renderer oder Framezahl können keine Simulationsergebnisse ändern. Jede als vollständig dargestellte Zone besitzt erkennbare lokale Merkmale.
- [ ] **Step 5:** Darstellung und Szenenregister committen.

### Task 23: Vollständige Inhaltsintegration nach Snapshot

**Konzept:** 02, 04 bis 20, 26, 29. **Abhängigkeit:** T03 bis T16, T21, T22.

**Files:** Populate `content/authoring/`, `content/snapshots/FOR-IDLE-2026-10-21-PUBLIC/`; Add tests in `tests/content/{reachability,effects,completeness}.test.ts`; Update Paket und Berichtsartefakte.

**Interfaces:** Consumes Importer und Capability Register; Produces versionierte Pakete für jede im Referenzinventar enthaltene Kategorie. `verifySnapshot(snapshot: SnapshotSpec, catalog: Catalog, evidence: TestEvidence[]): SnapshotVerdict` liefert `complete | incomplete` samt Pflichtlücken, niemals einen wohlwollenden Zwischenstatus „100%“.

- [ ] **Step 1:** Für jede erwartete ID und jede erforderliche Beziehung einen Anspruch aus dem unabhängig belegten Inventar ableiten. Entfernen eines Pflichtgegenstands, einer Questbelohnung, eines Bosszaubers oder eines Reisewegs muss die Abnahme konkret verschlechtern. `expect(verifySnapshot(snapshot, missingBossMechanic, evidence).status).toBe('incomplete')`.
- [ ] **Step 2:** `npm run test -- tests/content/reachability.test.ts tests/content/effects.test.ts tests/content/completeness.test.ts` scheitert für die dokumentierten offenen Inhalte.
- [ ] **Step 3:** Nach Regionen und Systemen paketweise alle offenen Datensätze und Effekte schließen. Jede Klasse und Spezialisierung, jeder relevante Gegenstand und Zauberrang, jede Mobfamilie samt Sonderverhalten, alle Questziele, Berufe/Rezepte, Händler, Lehrer, Rufpfade, Camping Objekte, Instanzräume/Bosse, Weltbosse, PvP Karten und Legacy Herausforderungen erhalten ihre Funktion. Funde verwenden echte Herkunft; eigene übersetzte Regeln sind markiert. Später angekündigte Originalraids nicht ungeprüft einschließen. Technische Hilfseinträge nur begründet ausschließen.
- [ ] **Step 4:** Tests bestehen ausschließlich bei geschlossenem Zielbestand. Pro Kategorie Nenner und Vollständigkeitsbeleg manuell gegenprüfen. Ein fehlender verfügbarer Forever Datenbestand ist ein konkreter externer Blocker und wird mit Datei/Feld/benötigtem Beleg gemeldet; er darf nicht durch zufällig generierte Mengen kaschiert werden.
- [ ] **Step 5:** Jedes abgeschlossene Inhaltspaket mit Bericht committen, anschließend Gesamtmanifest fixieren. Ein kompletter Import ohne spielbare Effekte schließt diese Aufgabe nicht ab.

### Task 24: Progression Balance und vollständige Spielwege

**Konzept:** 03, 05, 16, 20, 28. **Abhängigkeit:** T23.

**Files:** Create `tools/bench/progression.ts`, `tests/progression/full-routes.test.ts`, `content/adaptations/balance.json`, `reports/performance/progression.json`.

**Interfaces:** Produces `runProgressionScenario(input: ProgressionScenario, catalog: Catalog): ProgressionReport`. Ein Szenario enthält Klasse, Spezialisierung, Startkombination, vorgegebene Entscheidungen und Seed; es darf nur öffentliche Spielbefehle nutzen.

- [ ] **Step 1:** Szenarien für alle angebotenen Spezialisierungen und vollständige Berufsketten anlegen. Kein Entwicklergold, keine erfundenen Gegenstände oder unmittelbare Leveländerung. Erwartung: Stufe 60 und passender Endgame Zugang sind über verfügbare Schritte erreichbar; jede Fachkette besitzt erreichbare Eingaben und ein brauchbares Endprodukt.
- [ ] **Step 2:** `npm run test -- tests/progression/full-routes.test.ts` und `npm run bench:progression` zunächst ausführen; tatsächliche Blockaden dokumentieren.
- [ ] **Step 3:** Deadlocks und unerreichbare Voraussetzungen beheben. Nur offen markierte Idle Balanceparameter wie Zeitkompression und Fortschrittstaktung ändern, keine belegten Originalwerte heimlich überschreiben. Zielkorridor 80 bis 140 Stunden effektiver Zeit bis 60 als Messziel auswerten. Klassenerhalt und sinnvolle Tank/Heilrollen wichtiger als mechanisch gleiche Zahlen.
- [ ] **Step 4:** Szenarien bestehen. Berichte nennen reale Wege, Spielzeit, Niederlagen, Gold und Materialbilanz. Jeder Dungeon/Raid hat Gewinn und nachvollziehbaren Fehlverlauf. Bei unvermeidlicher Abweichung vom freigegebenen Konzept konkrete Änderung vor Veröffentlichung benennen.
- [ ] **Step 5:** Abgestimmte Balance und Progressionsbelege committen.

### Task 25: Migration Export Import und Wiederherstellung

**Konzept:** 22, 27, 28. **Abhängigkeit:** T17, T23.

**Files:** Create `src/server/game/{migrations,backup}.ts`, `app/api/game/{export,import}/route.ts`, `tests/server/save-lifecycle.test.ts`; Extend `src/ui/windows/Settings.tsx`.

**Interfaces:** Produces `SaveArchive`, `ImportPlan`, `VersionSet`, `exportSave(snapshot: ProfileSnapshot): SaveArchive`, `validateImport(bytes: Uint8Array, ownerId: string, catalog: Catalog): Result<ImportPlan>`, `migrateSave(archive: SaveArchive, targetVersions: VersionSet): Result<ProfileSnapshot>`, `restoreCheckpoint(ownerId: string, checkpointId: string, expectedRevision: Revision): Promise<CommitResult>`.

- [ ] **Step 1:** Speicherstände mitten in Reise, Kampf, Tod, Herstellung und Rückkehrjob exportieren. Nach Import gleicher RNG/Queue und identischer Folgeverlauf. Beschädigte Datei, fremder Eigentümer, ungültige Bindung, zukünftige Schema Version und fehlendes Inhaltspaket überschreiben keinen gültigen Stand.
- [ ] **Step 2:** `npm run test -- tests/server/save-lifecycle.test.ts` scheitert.
- [ ] **Step 3:** Schema/Simulations/Snapshot Versionen prüfen, Migration auf Kopien ausführen und vor Bestätigung validieren. Rotierende Checkpoints und Wiederherstellung mit Revision implementieren. Inhaltswechsel nur am sicheren Checkpoint; laufender Job behält seine ursprüngliche Version oder erhält eine nachgewiesene Migration.
- [ ] **Step 4:** Tests bestehen. Import kann keine zusätzliche aktive Figur außerhalb des Profil Locks erzeugen. Export enthält keine Hosting oder Connector Zugangsdaten. Angewendete Datenbankmigrationen bleiben unverändert; Reparaturen erhalten neue Migrationen.
- [ ] **Step 5:** Speicherlebenszyklus committen.

### Task 26: Gesamtprüfung und Veröffentlichungskandidat

**Konzept:** 23 bis 29. **Abhängigkeit:** T21 bis T25.

**Files:** Create `docs/qa/release-journeys.md`, `reports/qa/release.json`, `reports/release/candidate.json`; Update Anwendungstitel, Regelbuch und Änderungsnotizen.

**Interfaces:** Produces `ReleaseCandidate` mit Commit, Snapshot, Simulation/Schema Version, Abdeckung, Testbelegen, Leistungsdaten und genauem Produktstatus. Kein Test darf bloß durch Aktualisieren von Snapshots oder Baselines grün gemacht werden.

- [ ] **Step 1:** Frischer, mittlerer und Endgame Stand als konkrete Journeys festlegen. Einschließen: komplette Tätigkeit, Klassenwechsel, Gruppe, Bossmechanik, Handwerk, Handel, PvP, Vermächtnis, sichere Pause, 24 Stunden Rückkehr und Gerätewechsel. Erwartete sichtbare Ergebnisse und Persistenz vorher notieren.
- [ ] **Step 2:** `npm run typecheck`, `npm run test` und die relevanten Benchmarks ausführen; fehlende Erwartungen als echte Fehler behandeln. Vor dem Browser Preview den aktuellen Sites Managed Preview Leitfaden lesen.
- [ ] **Step 3:** CUA Browser QA ausschließlich über den unterstützten Sites Preview durchführen. Alle beschriebenen Wege wirklich bedienen. Auf 1440, 1100, 760 und kleiner Breite Text, Fensterzustände, Fokus, Tooltipkanten, Aktionsleiste und 3D Aus prüfen. Native Bauteile gegen die einzelnen Referenzen vergleichen. Fehler beheben und nur betroffene Prüfungen wiederholen; bei neuen Regeländerungen relevante Regressionen erneut ausführen.
- [ ] **Step 4:** Tests, Inhaltsabnahme und Browserbefunde bestätigen den Kandidaten. Maximal 60 fps, unabhängige Simulation und gemessener Aufholprozess sind belegt. Falls Browserinfrastruktur ausfällt, ihre Einschränkung berichten; vorgeschriebene verbleibende Prüfungen durchführen und keinen ungesehenen visuellen Nachweis behaupten.
- [ ] **Step 5:** Kandidat committen und Gesamtänderung unabhängig prüfen lassen. Materialielle Funde vor Veröffentlichung beheben. Interne QA Bilder sind keine ungefragt auszuliefernden Dateien.

### Task 27: Neue private Site veröffentlichen und übergeben

**Konzept:** 01, 27, 29, 30. **Abhängigkeit:** T26; vollständiger Produktstatus zusätzlich T23 bestanden.

**Files:** Preserve `.openai/hosting.json`; Create/Update `reports/release/deployment.json`, `docs/CHANGELOG.md`; Package unveränderte geprüfte Ausgabe außerhalb des Checkouts oder unter ignoriertem `outputs/`.

**Interfaces:** Consumes Sites `project_id`, Source Workflow Ergebnis `{project_id, commit_sha, archive}`, gespeicherte Versions ID; Produces bestätigte Deployment URL und Versionsbeleg.

- [ ] **Step 1:** Vor Registrierung prüfen, ob für dieses Projekt bereits eine Site ID oder laufende Registrierung gespeichert ist. Bei neuer Site genau einmal privat registrieren, ID sofort mit dem vorgesehenen Helfer im Hostingmanifest sichern. Eine unklare Erstellung auflösen, bevor erneut angelegt wird. Registrierung darf während der freigegebenen Umsetzung früher stattfinden; Veröffentlichung bleibt an den Kandidaten gebunden.
- [ ] **Step 2:** D1 Bindung und generierte Migrationen prüfen. Einmal erfolgreich geprüften unveränderten Build nicht beliebig wiederholen. Verbleibende Checks und `build-site.mjs` in der definierten Reihenfolge ausführen; nicht auf einen alten Build anderer Quellen zurückgreifen.
- [ ] **Step 3:** Aktuellen Sites Source Workflow mit Credential ausschließlich über versteckte Standardeingabe starten. Verifiziertes `project_id`, `commit_sha` und `archive` unverändert an die private Save/Deploy Funktion weiterreichen. Kein zusätzliches GitHub Remote verwenden und keine Credentials in Argumenten, Dateien oder Ausgaben speichern.
- [ ] **Step 4:** Deployment nur bei Zwischenzuständen weiter abfragen; bei erfolgreichem nativen Ergebnis mit URL beenden. Bei Fehler bestehenden Versions/Deploymentstand fortsetzen. Privaten Zugriff erhalten und nicht zur Fehlerbehebung öffentlich schalten.
- [ ] **Step 5:** Tatsächliche URL und ehrlichen Inhaltsstatus übergeben. Regelbuch, Speichern/Export und zentrale Bedienung nennen. Keine Vollständigkeitsbehauptung bei offenen Pflichtlücken. Relevante Verifikationsgrenzen und verbleibende konkrete Blocker offen berichten.

## Selbstprüfung des Plans

| Konzeptabschnitt | Umsetzungsaufgaben |
| --- | --- |
| 01 bis 02 Umfang und Vollständigkeit | T01 bis T05, T23, T27 |
| 03 Spielablauf | T10, T20, T24 |
| 04 bis 06 Völker Klassen Fähigkeiten | T05, T07, T08, T21, T23 |
| 07 bis 10 Welt Quests Gegner | T04, T09 bis T11, T22, T23 |
| 11 bis 14 Kampf Gruppen Instanzen | T06 bis T08, T14, T16, T23 |
| 15 bis 18 Inventar Berufe Wirtschaft | T09, T12, T13, T21 |
| 19 bis 21 PvP Vermächtnis Tod | T15, T16, T21 |
| 22 Offline | T06, T16 bis T18, T25 |
| 23 bis 25 Oberfläche und Darstellung | T19 bis T22, T26 |
| 26 bis 27 Daten Architektur Speicher | T01 bis T06, T17, T18, T25 |
| 28 bis 30 Prüfung Lieferung Grenzen | T23 bis T27 |
| 31 bis 32 Quellen | T02, T04, T05, T19 |

Die fünf Review Focus Fälle haben jeweils konkrete Tests. Gemeinsame Typen besitzen genau einen Eigentümer in T01; später definierte Rückgabetypen gehören zum genannten Fachmodul. Daten, UI und Rendering verändern weder autoritative Zeit noch Eigentümer. Alle Fachaufgaben enden mit beobachteter Prüfung und eigenem Commit.

Offene Originaldaten und Grafikbelege sind bereits benannte Inhalte der Importaufgaben, keine erfundenen fertigen Eingaben. Eine technische Aufgabe kann abgeschlossen sein, während T23 weiterhin konkret blockiert ist. Der finale gewünschte Endumfang wird dadurch nicht herabgesetzt.

## Ausführungsempfehlung und nächste Entscheidung

Empfohlen ist **Subagent-driven**: abgegrenzte Aufgaben mit frischen Implementierern und unabhängiger Prüfung. Datenimport, Simulation und Oberfläche haben unterschiedliche Fehlerbilder; die festen Schnittstellen dieses Plans machen gezielte Reviews sinnvoll. Der Hauptagent koordiniert Integration, Site Identität und Veröffentlichung.

Alternativ ist **Native** möglich: der Hauptagent implementiert die Aufgaben selbst, danach erfolgt eine unabhängige Gesamtprüfung. Das reduziert wiederholten Kontext und laufende Einzelreviews, liefert aber fachliche Rückmeldung später.

Nächste benötigte Antwort: Bestätigung, dass dieser Plan das freigegebene Konzept korrekt umsetzt, und Wahl zwischen Subagent-driven oder Native. Bis dahin werden weder Produktcode noch neue Hosting Ressourcen angelegt.
