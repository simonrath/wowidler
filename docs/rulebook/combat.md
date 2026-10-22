# Kampfregeln: owned Idle v1

T07 führt echte deterministische Kampfzustände aus. Diese Formeln sind ausdrücklich **eigene Idle-Anpassungen**, keine Rekonstruktion der Forever-Serverformeln. Unbekannte Quelldaten bleiben unbekannt. Nur die beiden Effekttypen des validierten T05-Pakets werden als übernommene Zauber zugelassen: `next-melee` (Effekt 17, Heldenhafter Stoß 78) und `create-item` (Effekt 24, Leinenverband 3275). Zusätzliche Engine-Primitiven haben synthetische Fachtests, aber schalten keinen weiteren importierten Zauber frei.

## Verträge und Datengrenze

`createCombatCatalog(packet)` validiert das vollständige Paket einschließlich Provenienz und Capability-Gate, kopiert es durch die Schemaauswertung und leitet die Ausführungsdefinitionen ab. Keine Node- oder Build-Abhängigkeit läuft im Browser. Der Aufrufer bindet Katalog, `snapshotId` und `simulationVersion` unveränderlich an dieselbe Simulation. Ein fremder Katalog darf nicht zur Fortsetzung eines Checkpoints verwendet werden. Fehlende Zauber, Rezepte und unbekannte Effekte liefern konkrete Sperrgründe.

`resolveAction(checkpoint, action, catalog)` und `applyEffects(checkpoint, effects, context)` ändern keine Eingabe und liefern `Resolution` mit neuem Checkpoint, neu geplanten Ereignissen und beobachteten Wirkungen. Der Dispatcher übernimmt diese Ergebnisse durch die bewachten Scheduler-Funktionen. `chooseAction(actor, state, catalog)` liest nur Zustand und zieht keinen Zufall. `GameState.combatTimeMs` spiegelt den aktuellen Simulationszeitpunkt, auch nach ereignislosen Zeitsprüngen; bei alten Startzuständen ohne dieses Feld gilt explizit Startzeit 0.

Die optionalen Actor-Felder für Auren, Wirkzeit, GCD, Bedrohung, Position und nächste Nahkampfaktion sind versionierbare Checkpointdaten und bleiben beim Serialisieren erhalten. Ressourcen und Gesundheit eines Charakter-Actors werden unmittelbar in den aktiven Profilcharakter gespiegelt. Sie sind keine unabhängigen Ressourcenbestände.

## Zahlen und Reihenfolge

Alle Werte sind ganzzahlig. Prozentwerte nutzen Basispunkte, 10000 bedeutet 100 Prozent. Folgende Formeln sind `idle-combat-v1`:

| Schritt | Eigene Idle-Regel |
| --- | --- |
| Basistreffer | inklusive RNG-Ziehung `[minDamage,maxDamage]` plus `floor(attackPower × attackIntervalMs / 14000)` plus expliziter Nahkampfbonus |
| Kritisch | zweite RNG-Ziehung `[1,10000]`; bei `Wert ≤ critChanceBps` gesamter Treffer × 2 |
| Immunität | passende aktive Schulimmunität setzt Schaden auf 0 |
| Rüstung | nur physisch: `floor(Schaden × 100 / (100 + Rüstung))`; Buffrüstung wird vorher addiert |
| Absorption | aktive Schilde in Anwendungsreihenfolge verbrauchen ihre Restpunkte; erst danach sinkt Gesundheit |
| Tatsächlicher Schaden | höchstens die verbleibende Gesundheit; Übertreffer erzeugt keine Bedrohung |
| Heilung | höchstens fehlende Gesundheit; Gesundheit 0 lässt sich damit nicht wiederbeleben |
| Schadenbedrohung | pro getroffenem NPC: `floor(tatsächlicher Schaden × Multiplikator / 10000)` |
| Heilbedrohung | `floor(tatsächliche Heilung / 2)` auf jedem NPC, der das geheilte Ziel bereits in seiner Bedrohungstabelle führt |

Beispiel: 100 Rohschaden, 0 Rüstung und 20 Absorption führen zu genau 80 tatsächlichem Schaden. Rüstung 100 halbiert physischen Schaden. Zwei Stapel eines Buffs mit je 10 Rüstung senken 100 Schaden auf 83.

Zufall kommt ausschließlich aus `checkpoint.rng` über den Simulationskontext. Auch feste Schadensspannen verbrauchen eine Ziehung. Anzeige, Taktikauswahl und Wiederaufnahme ziehen nichts. Identische Ausgangsdaten und Budgetschnitte ergeben denselben Checkpoint.

## Aktionen, Ressourcen und Wirkzeit

Ein Zauber prüft bekannte Fähigkeit, Mindeststufe, Wirkzeit-Sperre, GCD, individuellen Cooldown, Ressourcen, gültiges Ziel und gegebenenfalls Rezepterfordernisse, bevor irgendetwas verändert wird. Kosten, GCD und Cooldown beginnen mit der akzeptierten Aktion. Unterbrechung entfernt die noch ausstehende Cast-Aktion und plant für einen lebenden Actor in einer laufenden Begegnung eine neue Entscheidung 1 ms später; ausgegebene Ressourcen und Material werden nicht erstattet. Ein unterbrochener Heilzauber heilt null. Nahkampfschläge laufen unabhängig vom GCD; die nächste Nahkampfaktion kann nicht doppelt vorgemerkt werden.

Für 78 werden Bonus 11, Kosten 15 und Bedrohungsmultiplikator 15000 unmittelbar aus dem Paket übernommen. Der nächste Nahkampftermin erhält den Bonus. Ein bereits geplanter eigener Basisschlag wird ersetzt, nicht zusätzlich ausgelöst. Die eigenen Timingregeln geben diesem Next-Melee-Zauber weder Castzeit noch GCD. Die Paketangabe bestimmt seinen individuellen Cooldown.

Für 3275 liefert das zugehörige Rezept die Wirkzeit (im Paket 3000 ms), Profession, Mindestfertigkeit und Reagenzien. Material wird beim Start verbraucht. Bei Erfolg wird das im Effekt bestimmte Item als **ausstehender Ertrag** in `pendingRewards` abgelegt. Es wird weder direkt ins Inventar gelegt noch als bereits eingelöste Belohnung markiert; persistente Bestätigung bleibt Aufgabe späterer Transaktionen. GCD 1500 ms und Ressourcenkosten 0 für diese Herstellungsaktion sind ausdrückliche eigene Idle-Regeln. Die Verwendung/Heilwirkung des hergestellten Verbands ist weiterhin gesperrt.

Synthetische bzw. spätere versionierte Zauber müssen Castzeit, GCD, Cooldown, Ressourcenpreis und Zielart ausdrücklich angeben. Fehlt ein Feld, wird die Definition abgewiesen. Nicht unterstützte Mischungen von Next-Melee mit zusätzlichen Effekten werden gesperrt.

## Zeitblöcke, Auren und Tod

Die vorhandene Ordnung bleibt verbindlich: Auraablauf, feststehende Wirkungen, Tod, ausgelöste Wirkungen, neue Entscheidungen. Entscheidungen planen Treffer frühestens **1 ms später**, damit sie keine frühere Phase desselben Zeitpunkts einfügen. Abgeschlossene Wirkzeiten können eine Entscheidung in der späteren Entscheidungsphase desselben Zeitpunkts auslösen. Verwirft ein bestehender Zauber oder Nahkampftreffer sein inzwischen ungültiges Ziel, prüft der lebende Actor in einer laufenden Begegnung seine nächste Entscheidung 1 ms später. Noch nicht bereite Aktionen werden erst zum nächsten bekannten Bereitschaftszeitpunkt neu geprüft; es gibt keine Nullzeit-Schleife.

Alle feststehenden Treffer eines Zeitpunkts werden vor Todesauflösung angewandt. Zwei gleichzeitig tödliche Nahkampfschläge treffen beide. Bei gleichzeitigem Charakter- und Gegnertod lautet das Ergebnis `lost`; es entsteht keine automatische Belohnung. Tod entfernt noch offene Wirkzeiten und Next-Melee-Aktionen. Standardaktivitäten pausieren mit `death`; ab der zweiten aufeinanderfolgenden Niederlage steht `consecutive-defeats`. Wiederbelebung und der erlaubte einzelne Wiederholungsversuch gehören zur späteren Aktivitätssteuerung und werden hier nicht vorgetäuscht.

Eine Aura läuft bei `jetzt + Dauer` **vor** Wirkungen dieses Zeitpunkts ab. DoT-Ticks liegen deshalb strikt vor dem Ablaufzeitpunkt. Dauer 200 ms und Intervall 100 ms erzeugen einen Tick bei 100 ms. Auren mit gleicher Kennung und gleichem Urheber ersetzen/erneuern sich; Buffs erhöhen bis zur ausdrücklich angegebenen Stapelgrenze. Andere Urheber bleiben getrennt. Jede Erneuerung bekommt einen neuen Token; alte Ablauf- und Tickereignisse dürfen die erneuerte Aura nicht verändern. Schilde erneuern ihren gesamten angegebenen Vorrat; Immunitäten und DoTs stapeln nicht. DoTs werden beim Zonenwechsel nicht entfernt. Bereits feststehende direkte Schadenereignisse bleiben wirksam; neue Nahkampfaktionen und Zauber prüfen den Aufenthaltsort erneut.

Der Fachtest kombiniert Schildablauf, Zonenwechsel, DoT und einen gleichzeitig tödlichen Gegentreffer: bei 100 ms endet der Schild, die Aura verursacht 10 Schaden und der andere feststehende Treffer ebenfalls 10; beide Actors erreichen 0, der Charakter steht in Zone 2, das Ergebnis ist `lost`, die Belohnungsliste bleibt leer. Ein Ereignisbudget von 1 liefert denselben vollständigen Zeitblock.

## Ziele und Taktik

Die aktuelle Formation unterscheidet Charakter- und NPC-Seite. Ziele müssen leben und zur geforderten Seite gehören. Charaktere müssen für neue Aktionen in der Begegnungszone stehen. `front`, `flank`, `rear` und `melee`/`ranged` sind abstrakte Sektoren, keine erfundenen Weltkoordinaten. Eine positionslose alte Begegnung gilt ausdrücklich als einfache Nahkampfformation. Eine sektorabhängige Fähigkeit benötigt trotzdem eine explizite passende Position; aus fehlenden Daten wird kein Rückenangriff.

Pro NPC existiert eine eigene Bedrohungstabelle. Das höchste lebende und für die konkrete Aktion zulässige gegnerische Ziel wird gewählt, bei Gleichstand die lexikografisch kleinere Actor-ID (ohne localeabhängigen Vergleich). Neue NPCs und bekannte Quellzauber bekommen dadurch keine behauptete originale Server-KI.

Bis zu zwölf Regeln werden in gespeicherter Reihenfolge geprüft. Deaktivierte Regeln, nicht erfüllte Bedingungen und gesperrte Aktionen erhalten je einen konkreten Grund. Gesundheit/Ressource wird ohne Fließkomma-Prozentvergleich gegen die Basispunktgrenze geprüft; eine Ressource mit Maximum 0 erfüllt keine Schwellenbedingung. Die erste ausführbare Regel gewinnt. Eine leere Priorität enthält als eigene Idle-Standardregel den einfachen Angriff. Flucht ist nur für einen lebenden, in der Begegnungszone anwesenden Actor einer laufenden Begegnung zulässig; abgeschlossene Ergebnisse werden dadurch nicht verändert. Gegenstände ohne implementierte Anwendung bleiben `unsupported-item`. Dreizehn Regeln scheitern sowohl bei der Zustandsvalidierung als auch bei der direkten Taktikauswahl.

## Nachweise und Grenzen

`src/content/capabilities.ts` führt das belegte Effektregister mit den zugehörigen Testfällen aus `tests/combat/resolution.test.ts`. Das aktive T05-Inventar wird vollständig ausgeführt; andere DBC-Effektarten bleiben ausgeschlossen. Es gibt keine Behauptung vollständiger Klassen, Talente, Widerstände, Ausweichen, Trefferchance, Reichweiten in Metern, PvP, Beute-, Quest- oder Server-KI-Semantik. Unbehandelte Simulationsereignisse bleiben `unhandled-event`. Produktionsdispatcher und synthetische Scheduler-Tests verwenden dieselbe atomare Zeitblockgrenze.
