# Magier – Planungsnotizen aus dem unterbrochenen Lauf

**Kein wiederhergestellter Code und kein Testnachweis dieses Exports.** Der im Gespräch gemeldete Commit77cbdf3 ist nicht vorhanden. Diese Notizen erhalten nur die zuvor diskutierten Anforderungen und Entscheidungen; gegen die enthaltenen Quellen und v6-Verträge prüfen.

## Vorgesehener Kernumfang T08/Magier

- Drei tatsächliche Profile Arcane/Fire/Frost, gesamte55-Talent-Struktur aus dem gesperrten Grimoire70425 erhalten; ausgewählte Talente ausführbar, restliche Knoten als konkrete T23-Lücken.
- Ausgewählte Talente: Arcane Focus, Improved Fireball, Improved Frostbolt. Alle Ränge durch beobachtete Trefferausgänge bzw. Abschlusszeiten prüfen; IDs und Werte aus der aktuellen Quelldatei lesen.
- Arcane Missiles5143 als echter unterbrechbarer3-Tick-Kanal. Aktionsgebundene Kanal-Ticks, persistierter Tickindex gegen doppelte Ausführung, Abbruch bei Unterbrechung/Tod/Zonenwechsel/ungültigem Ziel. Danach Taktik fortsetzen. Trefferwurfrichtlinie für Kanal explizit als geprüfte/übernommene oder eigene Regel definieren.
- Fireball143 mit direktem Schaden und eigener periodischer Nachwirkung. Im Gespräch aus dem70425-Tooltip gelesen:45Mana, direkter Mittelpunkt33, zusätzlich3 über6s. Nicht ungeprüft aus diesen Notizen statt Quelle übernehmen.
- Frostbolt205 mit realer Bewegungsverlangsamung. Im Gespräch aus70425 gelesen:35Mana, Mittelpunkt30,40% Verlangsamung für6s.40% Reduktion bedeutet speed6000Bps.
- Eigene benannte Mana-Uhr mit manaPerTick/manaIntervalMs/5s Unterdrückung nach bezahltem Zauber und deterministischer Erneuerung. Keine Kopplung an die24h-Offlinegrenze; keine doppelten Ticks oder Entscheidungen.

## Vorgesehene gemeinsame v7-Erweiterung

V6 bleibt der tatsächlich enthaltene Vertrag. Eine v7-Implementierung muss additiv dokumentiert und geprüft werden:

- Optionaler Kanalvertrag am CombatSpell und gebundener Kanalzustand/Ereignis.
- Typisierte Slow-Aura mit speedBps und tatsächlichem Verbraucher.
- Verallgemeinerung der bisherigen Hunter-Annäherung für Magier, damit rangedMage nicht gegen Nahkampf immun ist.
- Genehmigte begrenzte **eigene Idle-Bewegungsregel**: Mage-Basisannäherung3000ms; beim ersten gültigen Kontakt mit aktiver Verlangsamung einmaliger zusätzlicher ceil(base*(10000-speedBps)/speedBps)-Aufschub. Persistiertes Flag verhindert erneute Verzögerung/Zurücksetzen durch Auffrischen. Kein Freikiten/Disengage, keine Behauptung kontinuierlicher Yards oder Nachberechnung beim Ablauf mitten im Zusatzaufschub. Jeden Kontakt auf Leben/Seite/Zone/Kampfstatus/Klassenpaket prüfen. Hunter1000ms unverändert.
- Kanal-/periodische Talentmodifikatoren einmal anwenden; Fehlschlag und Unterbrechung dürfen Ressourcen/Abklingzeiten nicht zurückrollen oder Entscheidungen dauerhaft stoppen.

## Erforderliche Nachweise

Reale Profilabläufe, alle angebotenen Talentränge, Kanalunterbrechung und doppelte Ticks, tatsächlicher Frostaufschub mit endlichem Feindkontakt trotz mehrfacher Erneuerung, Ablauf/Immunität/Abbruch, Mana-Unterdrückung/Erneuerung über24h, gespeicherte/geteilte Läufe identisch, Klassen-/Rang-/Autoritätsgrenzen. Vollständige Suite und Typprüfung neu ausführen. Die früher berichteten254 Tests gehören nicht zum wiederhergestellten Stand.

Polymorph, Root, weitere Utility, vollständige Talentbäume und fehlende Zauberränge nicht als implementiert deklarieren, wenn nur dieses Kernpaket entsteht.
