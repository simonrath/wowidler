# Simulationszeit und Zufall

Die Simulation arbeitet ausschließlich mit nichtnegativen, sicheren Ganzzahlen in Millisekunden. `simMs` ist Spielzeit, keine Browser- oder Serveruhr. `advance(checkpoint, target, catalog, budget)` akzeptiert ein absolutes Ziel zwischen der aktuellen Spielzeit und höchstens `86_400_000` Millisekunden später. Die Kappe ist technisch; eine geprüfte Leistungszusage für 24 Stunden wird erst durch den späteren Lastversuch möglich.

## Ereignisordnung

Die Warteschlange ist nach **Zeit, Phase, Sequenz** geordnet. Die Sequenz ist eindeutig, wird im Checkpoint gespeichert und niemals nach einer Absage wiederverwendet. Jede neue Planung erhöht `nextSequence`; ein Überlauf führt zum Fehler.

| Phase | Ordnung | Standardereignisse |
| --- | --- | --- |
| Ablauf alter Auren | 0 | explizit durch spätere Aurenhandler gesetzt |
| Geplante Wirkungen | 1 | `damage`, `heal`, `arrival` |
| Todesauflösung | 2 | `death` |
| Ausgelöste Effekte | 3 | `loot`, `objectiveProgress`, `activityComplete` |
| Neue Entscheidungen | 4 | `tick`, `attack` |

Alle direkten Treffer eines Zeitpunkts werden vor der Todesauflösung angewandt; auch zwei gleichzeitig tödliche Treffer dürfen sich gegenseitig treffen. Die Scheduler-Tests zeigen dies mit synthetischen Zustandsänderungen; T07 prüft es zusätzlich mit echten Kampfhandlern (siehe `combat.md`).

Neue Ereignisse dürfen am gleichen Zeitpunkt nur in der aktuellen oder einer späteren Phase liegen. Ereignisse in einer früheren Phase benötigen einen späteren Zeitpunkt. Ein `attack` ist eine Entscheidung; ein bereits feststehender direkter Treffer ist eine geplante Wirkung. Gameplayhandler müssen diese Unterscheidung beim Planen beachten.

Alte Checkpoints ohne `phase` bleiben gültig. Die Tabelle leitet ihre Phase aus dem Ereignistyp ab. Schreiben und Hashen normalisieren die Phase explizit. Ein optionales `actionId` gruppiert die noch ausstehenden Ereignisse einer Aktion. `cancel(actionId)` entfernt nur deren Warteschlangeneinträge; bereits angewandte Wirkungen und RNG-Ziehungen bleiben bestehen. Eine Absage ist kein dauerhaftes Verbot, dieselbe Kennung erneut zu planen. Gameplayhandler müssen eindeutige Aktionskennungen verwalten und echte Abbrüche vor den betreffenden Wirkungen einordnen.

## Atomare Zeitblöcke und Budgets

Ein vollständiger Zeitpunkt ist die kleinste bestätigte Einheit. Der Kern kopiert den letzten Checkpoint, arbeitet alle Ereignisse dieses Zeitpunkts ab und validiert dann den gesamten Entwurf. Eingaben werden nicht verändert. Bestätigte Zustände enthalten keine halbfertige Todesauflösung.

`maxEvents` ist daher eine **weiche** Ereignisgrenze: Sobald ein Zeitpunkt begonnen hat, wird er fertig verarbeitet, auch wenn er mehr Ereignisse enthält als das verbleibende Budget. `shouldYield()` wird nur vor dem nächsten Zeitblock abgefragt. Das Budget verändert keine Zufallswerte, Sequenzen oder Zustandswerte. Nach der letzten fälligen Wirkung darf die Zeit ohne zusätzliche Ereignisse bis zum Ziel springen. `processedEvents` zählt ausschließlich bestätigte Ereignisse, keine entfernten Aktionen oder verworfenen Versuche.

Bei `10_000` verarbeiteten Ereignissen desselben Zeitpunkts und weiterhin fälligen Ereignissen endet der Aufruf mit `diagnostic.code = 'zero-time-cycle'`. Dies ist eine deterministische Obergrenze, kein Beweis einer mathematischen Endlosschleife; auch ein übergroßer endlicher Block wird abgelehnt. **Der komplette fehlerhafte Zeitpunkt wird zurückgerollt**, einschließlich Spielzustand, Warteschlange, Sequenz und RNG. Bereits bestätigte frühere Zeitpunkte bleiben erhalten. Ein Fehlerhandler kann Diagnose und letzten bestätigten Checkpoint anzeigen; die fehlerhaften Wirkungen dürfen nicht bestätigt werden. Handlerfehler, rückwärts gerichtete Planung und ungültige Ergebniszustände werden ebenso behandelt. Ungültige Eingaben werden vor der Simulation als Ausnahme abgelehnt.

Diese Grenze vermeidet einen persistenten Zwischenzustand offener Transaktionen. Falls ein späterer Lastversuch harte Latenzgrenzen verlangt, muss eine versionierte Fortsetzung offener Zeitblöcke entworfen werden; kleinere Budgets allein begrenzen die maximale Blocklaufzeit nicht.

## Erweiterung durch Gameplayhandler

`createAdvance(dispatch)` bindet einen synchronen, deterministischen Reducer. Der Kontext enthält den lokalen Checkpointentwurf, das aktuelle Ereignis, den browsergeeigneten `Catalog` und die Funktionen `schedule`, `cancel` und `random`. Der Reducer ändert Spielzustand und verwendet die Kontextfunktionen für Warteschlange und RNG; Zeit, Sequenz und RNG werden nicht direkt verändert. Er darf den Kontext nicht behalten, keine asynchrone Arbeit starten und keine externen Objekte verändern. Alle spielentscheidenden Informationen müssen im Checkpoint oder im über `snapshotId` und `simulationVersion` passenden, unveränderlichen Katalog liegen. Der Aufrufer ist für diese Versionsbindung verantwortlich.

T07 und spätere Module können ihre Dispatcher über eine explizite `switch(event.type)`-Komposition verbinden. Kein global veränderliches Handlerregister ist vorgesehen. Der exportierte Standard-`advance` bindet die T07-Kampfhandler für Entscheidungen, Treffer, Wirkzeiten, Auren, Tod und Ankunft ein. Andere Gameplay-Ereignisse enden weiterhin mit `unhandled-event`; sie werden niemals stillschweigend gelöscht. Der Kern importiert keine Node-Buildwerkzeuge, keine Coverageberechnung, keine Darstellung und keine Protokollierung.

## Reproduzierbarer Zufall und Checkpoints

Die RNG ist **xoshiro128\*\* 1.1** mit vier gespeicherten 32-Bit-Wörtern. Der Nullzustand ist ungültig; ein Seed beziehungsweise Anfangszustand muss ausdrücklich bereitgestellt werden. Es gibt keinen automatisch aus Uhrzeit erzeugten Seed. `random(min, max)` liefert ganze Werte einschließlich beider Grenzen; Rejection Sampling vermeidet Moduloverzerrung. Bereiche dürfen höchstens `2^32` mögliche Ergebnisse enthalten. Auch ein Bereich mit nur einem möglichen Wert verbraucht eine Ziehung. Renderframes, Anzeigen, Wiederholungen und Logs dürfen niemals Zufallswerte ziehen.

`serializeCheckpoint` schreibt validiertes UTF-8-JSON mit alphabetisch geordneten Objektschlüsseln und normalisierter Warteschlange. Andere Arrays behalten ihre fachlich relevante Reihenfolge. `deserializeCheckpoint` validiert beim Laden erneut. Die Snapshot- und Simulationsversion sind Bestandteil der Bytes. `hashCheckpoint` berechnet daraus einen synchronen, browsergeeigneten FNV-1a-64-Fingerabdruck. Er dient ausschließlich dem deterministischen Vergleich, **nicht** der Authentizitätsprüfung, der Signatur oder einer Sicherheitsentscheidung. Integritäts- und Serverautorisierung müssen unabhängig davon geprüft werden.
