# Notices

Grimoire, a fan site for World of Warcraft: Forever
Copyright (C) 2026 gimzdev

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public
License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later
version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the
implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License in
`LICENSE` for more details.

Grimoire is not affiliated with or endorsed by Blizzard Entertainment or by any of the projects below.

## Where the data comes from

Every file in `data/` is rebuilt by `scripts/data/build.mjs` from the three projects below and from facts Grimoire
writes itself (`scripts/data/static/`). Nothing is copied from World of Warcraft database sites.
Each data file remains under the terms of the source it was made from.

### talentsforever.com (CC BY 4.0)

Data from talentsforever.com (https://talentsforever.com), licensed under the Creative Commons Attribution 4.0
International licence (https://creativecommons.org/licenses/by/4.0/). talentsforever.com reads it from the World of
Warcraft: Forever beta client.

- Used for: talents and their ranks, trainer abilities with the level each rank is learned at and their tooltips,
  ability icons, racials (with the Priest racials), and the Legacy system's challenges and perk trees (ranks, point
  gates, prerequisites and tooltips).
- Files: `data/talents.json`, `data/abilities.json`, `data/races.json`, `data/classes.json`, `data/builds.json`,
  `data/legacy.json`, `data/meta.json`.
- Changes made by Grimoire: the export is reorganised into Grimoire's own files with its own ids; tooltip lines are
  joined and shortened; the recommended builds (written by Grimoire) are placed on the current trees; the level each
  rank was taught at in Classic (from VMaNGOS) is added so changes can be shown; the Legacy challenges are grouped into
  ladders and given the dungeons each Spelunker challenge lists (Grimoire's own facts).

### LibQuestDB (MIT)

LibQuestDB by Pimptasty (https://www.curseforge.com/wow/addons/questdb).

- Used for: Forever's quest list, including the quests it marks as unobtainable or retired; the quest XP table of
  Forever's client; Forever's own new quests (titles, levels, objectives) as its client describes them; and the zone
  each creature and object stands in.
- Files: `data/quests.json`, `data/npcs.json`, `data/objects.json`, `data/meta.json`.
- LibQuestDB re-expresses its Classic quest facts from the CMaNGOS world database (https://github.com/cmangos/classic-db,
  GPL-3.0) and reads Forever's own quests from the Forever client.

```
MIT License

Copyright (c) 2026 Pimptasty

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### VMaNGOS (GPL-2.0-or-later)

The VMaNGOS world database (https://github.com/vmangos/core and https://github.com/brotalnia/database), Copyright (C)
VMaNGOS, under the GNU General Public License, version 2 or (at your option) any later version. Grimoire uses it under
version 3, as its licence allows.

- Used for: the Classic world Forever is built on, at Classic's last patch (1.12): quests and their text, creatures,
  objects, items and their stats, loot tables, vendors, trainers, factions and zones.
- Files: `data/quests.json`, `data/npcs.json`, `data/objects.json`, `data/items.json`, `data/minor-items.json`,
  `data/drops.json`, `data/npc-loot.json`, `data/vendors.json`, `data/zones.json`, `data/zone-names.json`,
  `data/factions.json`, `data/abilities.json` (Classic trainer levels). `data/dungeons.json` and the recommended builds are
  Grimoire's own writing (`scripts/data/static/`).

## Blizzard Entertainment

World of Warcraft, Warcraft and Blizzard Entertainment are trademarks or registered trademarks of Blizzard
Entertainment, Inc. in the U.S. and/or other countries. The game's names, text, icons and artwork are © Blizzard
Entertainment, Inc. All rights reserved. Icons load from Blizzard's own icon server, and the pictures, including
`public/img/zephras-isle.jpg`, `public/img/skyborne-wind.jpg`, `public/img/world-tree.jpg`, `public/img/archimonde.jpg`
and `public/img/undead.jpg`, are Blizzard's World of Warcraft: Forever art. They are used here as a non-commercial fan
site and are not covered by Grimoire's licence.
