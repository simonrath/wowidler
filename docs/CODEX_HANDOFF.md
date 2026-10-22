# Lokale Codex-Fortsetzung – WoW Forever Idle

Stand: 22. Oktober 2026. Dies ist ein Entwicklungsstand, kein vollständiges oder veröffentlichtes Spiel.

## Verbindlicher wiederhergestellter Quellstand

Aus dem separaten Sites-Quellrepository wiederhergestellt: `1fc17b281fc2fc21efd6f893e939a00d718873ba` (Shaman core). Dieser GitHub-Import bildet dessen vollständigen getrackten Dateibaum ab, ergänzt um diese Übergabe, README und Prüfsummenmanifest. Der GitHub-Commit hat deshalb eine andere SHA.

Nach der Verbindungsunterbrechung zeigte der ursprüngliche lokale Checkout nur `3840f3f` plus ältere UI-Arbeit. Er wurde nicht überschrieben. Die neuere Site-Sicherung wurde in einem separaten Checkout geöffnet.

Im Gespräch wurde später ein Magier-Commit `77cbdf3` mit 254 bestandenen Tests gemeldet. Dieser Commit ist im wiederhergestellten Repository nicht vorhanden und wurde vor dem Abbruch nicht in die verfügbare Site-Sicherung übertragen. **Die Magierimplementierung und der 254-Test-Stand sind daher nicht Bestandteil dieses Exports.** Nicht als vorhanden oder geprüft ausgeben. Zunächst eventuell anderweitig vorhandenen Commit suchen; andernfalls das Magier-Teilpaket neu implementieren.

Für die verlorene Magierarbeit liegen [Planungsnotizen](recovery/mage-reimplementation-notes.md) bei; sie sind kein Code-/Testnachweis.

## Was enthalten ist

- Gesamtkonzept: `docs/superpowers/specs/2026-10-21-wow-forever-idle.pdf`.
- Genehmigter 27-Aufgaben-Plan: `docs/superpowers/plans/2026-10-21-wow-forever-idle.md`.
- Domainmodelle, Quellenregister/Locks, 42 passende Clientdefinitionen, eingefrorene Quelldaten und nachvollziehbare Provenienz.
- Questie-Import mit 46.954 Evidenzeinträgen; kein Beleg für vollständig spielbaren Inhalt.
- Geschlossenes Northshire-Datenpaket: Quests 783 → 7 → 15, Kampf/Beute, Lernen und Erste Hilfe. Simulation/Workflow dazu noch nicht als komplette Spielsession verbunden.
- Deterministische Ereignissimulation, RNG, Serialisierung, Kampf/Effekte/Auren/Bedrohung/Taktiken.
- Geprüfte Kernpakete für Krieger, Paladin, Jäger, Schurke, Priester und Schamane; drei ausführbare Profile je Paket. Nur ausgewählte Talente ausführbar; übrige Knoten und Fehlstellen bleiben explizit erfasst.
- Jäger-Begleiter, zielgebundene Kombopunkte/Energie, Heilung/Schild/HoT sowie drei unabhängige Totemvorlagen.
- WoW-Komponenten und Komponenten-Workbench mit nativen PNGs/SVG-Zuschnitten und QA-Abbildungen. Die Startseite ist noch die Workbench, nicht die fertige Spieloberfläche.

## Fortschritt und nächster Schritt

T01–T07 und T19 sind abgeschlossen. T08 ist in sechs von neun **Kernpaketen** abgeschlossen; dies bedeutet nicht vollständige Talent-/Zauberabdeckung. Nächste Pakete: Magier, Hexenmeister, Druide, jeweils mit eigener fachlicher Prüfung. Danach T09–T18, T20–T27 nach Plan; T19 nicht erneut implementieren.

Noch ausstehend sind insbesondere vollständige Inventar-/Quest-/Reise-/Berufs-/Gruppen-/PvP-/Legacy-Abläufe, D1-Autorität/API/Offline-Catchup, die erste vollständige Spielsession, alle Systemfenster, Three.js-Szene/Audio, vollständige Inhaltsintegration, Balancing, Import/Export und Veröffentlichung. Three.js ist als Abhängigkeit vorhanden; eine fertige 3D-Spielszene ist nicht enthalten.

Lies vor Änderungen `docs/rulebook/classes.md`, `combat.md` und `time-and-random.md`. Gemeinsame Klassenverträge v6 dürfen nicht stillschweigend geändert werden. Eine Implementierung gleichzeitig; unabhängiges Review nach jedem Paket. Quellenwerte und ausdrücklich eigene Idle-Adaptionen trennen. Unbekannte Nenner bleiben unbekannt; kein „100 %“-Anspruch aus Importzahlen.

## Lokaler Start

Voraussetzungen: Node >=22.13 (zuletzt Node24), pnpm11.25.0. Der saubere Clone wählt das portable Profil automatisch. Keine Sites-Zugangsdaten zum lokalen Entwickeln erforderlich.

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

Die portable Vorschau läuft normalerweise auf http://localhost:5173. Falls lokale Anmeldung benötigt wird: `/signin-with-chatgpt?return_to=/` (portable Entwicklungsidentität, nicht Produktionsauthentifizierung).

```sh
pnpm run test -- --maxWorkers=1 --no-file-parallelism
pnpm run typecheck
pnpm run build
pnpm run content:starter -- --frozen
pnpm run content:import -- --snapshot FOR-IDLE-2026-10-21-PUBLIC --frozen
```

Der große Questie-Import erzeugt ignorierte Build-Evidenz unter `outputs/`; diese ist nicht Teil des Imports und wird aus den enthaltenen Quellen reproduziert. Nicht mit einem aktivierten, vollständig spielbaren Laufzeitkatalog verwechseln. Tests können mehrere Minuten dauern.

## Prüfstand und offene Review-Punkte

Die folgenden Ergebnisse sind historische Berichte aus dem vorherigen Lauf, keine nach der Wiederherstellung neu ausgeführten Tests:

- Krieger: vollständige Suite128/128 vor Reviewfix, danach54/54 betroffene Tests.
- Paladin:145/145 vollständig, danach71/71 nach Heilbedrohungsfix.
- Jäger:164/164 vollständig, danach93/93 nach Annäherungs-/Fähigkeitenlistenfix.
- Schurke:190/190 vollständig, danach117/117 nach Waffenprüfungsfix.
- Priester:211/211 vollständig, danach137/137 nach Zielwahlfix.
- Schamane:18/18 spezifisch,155/155 Klassen/Kampf/Simulation. Vollständiger Lauf228 bestanden/3 fehlgeschlagen: eine Registerspiegelung wurde korrigiert; zwei 5-Sekunden-Inhaltstest-Timeouts. Anschließend29/29 betroffene Quellen-/Inhaltstests bestanden bei unveränderten Limits. **Kein vollständiger 231/231-Erfolg dieses gesicherten Stands behaupten.**

Offene Kleinigkeiten/Integrationsrisiken:

- Verwaiste Strength-of-Earth-Aura kann bei fehlendem Totemakteur bis Ablauf aktiv bleiben; gültige lebende Quelle bei Party-/Importintegration prüfen.
- T05-Inhaltstests zeigten gelegentliche 5s-Timeouts. Nicht blind Limits erhöhen; bei Wiederholung Fixtures/CPU-Ursache prüfen.
- Klassen-Workbench `aria-pressed` für echte Auswahl statt transienten visuellen Druckzustand korrigieren (T20).
- Queue-Sortierung pro Ereignis beim späteren Offline-Lasttest profilieren (T17).
- Neue Begegnungen dürfen Abklingzeiten/Ressourcen/Suppressionsuhren nicht versehentlich zurücksetzen.
- Rogue/Schamane nutzen markierte Starter-Waffen-/Werkzeugprojektionen. T09/T10 müssen echte Inventar-/Questprüfungen anschließen; ursprüngliche Voraussetzungen sind damit noch nicht erfüllt.
- Klassen-Verifikations-JSON ist ergänzende Dokumentation, kein Ersatz für die private ausführungsgebundene T03-TestEvidence bei späterer Coverage.

## Quellen und Veröffentlichung

Vendordaten, Grafiken, NOTICE-/Lizenzdateien und Hashlocks mitführen. Alle GitHub-Zugriffe wurden über den GitHub-Connector ausgeführt. Keine geheimen Zugangsdaten exportieren. `.openai/hosting.json` enthält nur die bestehende Site-ID und Bindungskonfiguration; sie nicht durch eine neue Site ersetzen.

Bestehende private Site: `appgprj_6ad8731c8ba0819191378ff0175bb323`. Letzter geprüfter nativer Status: keine Live-Version/Version0. Diese Übergabe veröffentlicht keine Site. Für die weitere lokale Arbeit ist kein Hosting erforderlich.

## Startprompt für Codex

> Lies docs/CODEX_HANDOFF.md, das Gesamtkonzept und den 27-Aufgaben-Plan. Prüfe den tatsächlichen Git-Stand und führe die passenden Baseline-Checks aus. Setze bei T08/Magier fort; Krieger/Paladin/Jäger/Schurke/Priester/Schamane nicht erneut bauen. Bewahre die gemeinsamen v6-Verträge, Quellenlocks und offenen Inhaltslücken. Implementiere je ein Paket, prüfe es unabhängig und setze anschließend den Plan fort. Ein vollständiger Datenimport ist keine vollständige Spielimplementierung.
