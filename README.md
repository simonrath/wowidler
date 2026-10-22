# WoW Forever Idle

Entwicklungsstand eines HTML/TypeScript-Idle-RPGs auf React/Vinext mit Three.js als Abhängigkeit. **Noch kein vollständiges oder veröffentlichtes Spiel.**

## Lokal starten

Node >=22.13 und pnpm11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

Vorschau normalerweise unter http://localhost:5173. Die Startseite zeigt derzeit die WoW-Komponenten-Workbench.

```sh
pnpm run test -- --maxWorkers=1 --no-file-parallelism
pnpm run typecheck
pnpm run build
```

## In Codex fortsetzen

**Zuerst [docs/CODEX_HANDOFF.md](docs/CODEX_HANDOFF.md) lesen.** Dort stehen wiederhergestellter Commit, Prüfstand, fehlender Magier-Commit, bekannte Grenzen und der konkrete nächste Schritt.

- [Gesamtkonzept](docs/superpowers/specs/2026-10-21-wow-forever-idle.pdf)
- [27-Aufgaben-Plan](docs/superpowers/plans/2026-10-21-wow-forever-idle.md)
- [Klassenverträge](docs/rulebook/classes.md)
- [Kampfregeln](docs/rulebook/combat.md)
- [Zeit und Zufall](docs/rulebook/time-and-random.md)

Vendordaten und Grafiken besitzen eigene Herkunfts-/Lizenzangaben. Locks und NOTICE-Dateien erhalten. Keine Zugangsdaten erforderlich, um lokal an der Workbench und Spiellogik zu arbeiten.
