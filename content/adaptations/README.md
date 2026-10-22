# Explizite Idle-Anpassungen

Eigene Spielregeln werden hier als separate, versionierte Dateien abgelegt. Quelldaten unter `content/sources/` bleiben unverändert. `northshire-idle-v1.json` enthält die ausdrücklich eigenen Regeln für das kleine Startpaket. Die Datei wird als `authored-file` mit SHA-256 im SourceLock erfasst; sie behauptet weder eine GitHub-Quelle noch authentische Serverwerte. `content/authoring/start-packet.json` wird daraus zusammen mit den eingefrorenen Quellen gebaut (`npm run content:starter -- --frozen`).

Eine Normalisierungs-Korrektur nennt `before`, `after`, `reason` und einen vollständigen Quellenbeleg (`sourceId`, `path`, `sha256`, `selector`). Für eine Idle-Anpassung muss zusätzlich `adaptationPath` auf die separate Datei unter `content/adaptations/` zeigen. Diese Datei muss als eigener unveränderlicher Beleg im SourceLock erfasst sein; ihr `localPath` muss übereinstimmen. Die Feld-Provenienz bleibt `derived`, auch wenn die Korrektur einen vorherigen Wert ersetzt. Keine Anpassung darf einen unbekannten Original-Kampfwert als verifiziert ausgeben.

Koordinaten im zentralen Domain-Schema sind endliche Weltkoordinaten mit einem expliziten `locationKey`. Prozentkarten-Koordinaten benötigen vor der Übernahme eine belegte Transformation; eine pauschale Begrenzung auf 0–100 wäre für Weltkoordinaten falsch.
