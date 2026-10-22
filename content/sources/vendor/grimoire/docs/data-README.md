# Rebuilding the game data

`build.mjs` writes every file in `data/` from three openly licensed sources and the hand-written facts in `static/`.
Nothing comes from World of Warcraft database sites. Credits and licence texts are in `NOTICE.md` at the top of the repo.

```bash
node scripts/data/build.mjs --vmangos mangos.sqlite --talents data.json --libquestdb path/to/QuestDB
```

Node.js 22.5 or newer is needed (it reads the database with the built-in `node:sqlite`). Add `--out somewhere` to
write the files elsewhere than `data/`.

## The three sources

| Flag | Source | Licence | Where to get it |
| --- | --- | --- | --- |
| `--talents` | talentsforever.com export | CC BY 4.0 | Download https://talentsforever.com/data.json. The build refuses an export whose `license` is not `CC-BY-4.0`. |
| `--libquestdb` | LibQuestDB by Pimptasty | MIT | Download the addon from https://www.curseforge.com/wow/addons/questdb and unzip it; pass the `QuestDB` folder (the one with `QuestDB.toc` and `Data/Forever`). |
| `--vmangos` | VMaNGOS world database | GPL-2.0-or-later | A SQLite copy of the VMaNGOS world database, made as below. |

### Making the VMaNGOS SQLite file

VMaNGOS publishes its world database as a MySQL dump plus migrations. The steps below are the ones its own CI uses,
then a conversion to SQLite:

```bash
git clone --depth 1 https://github.com/brotalnia/database
git clone --depth 1 -b development https://github.com/vmangos/core vmangos
7z e database/world_full_14_june_2021.7z                 # world_full_14_june_2021.sql
mysql -e "CREATE DATABASE mangos DEFAULT CHARSET utf8 COLLATE utf8_general_ci"
mysql --max_allowed_packet=128M mangos < world_full_14_june_2021.sql
(cd vmangos/sql/migrations && ./merge.sh)                 # writes world_db_updates.sql
mysql --max_allowed_packet=128M mangos < vmangos/sql/migrations/world_db_updates.sql
git clone --depth 1 https://github.com/dumblob/mysql2sqlite
mysqldump --skip-extended-insert --compact --default-character-set=utf8 mangos > mangos.sql
./mysql2sqlite/mysql2sqlite mangos.sql | sqlite3 mangos.sqlite
```

Any MySQL or MariaDB server works for the import. The SQLite file is only an input: it is not part of the repo.

## What each source gives

- **talentsforever.com:** talents with every rank, the trainer spellbook of each class with the level of every rank
  and its tooltip, spell icons, racials and the Priest racials, and the Legacy system: its 65 challenges and the three
  perk trees with every rank, point gate and prerequisite. Read from the World of Warcraft: Forever beta client.
- **LibQuestDB:** which quests exist in Forever (and which it marks as unobtainable or retired), the quest XP table of
  Forever's client, Forever's own new quests (title, level, objective text), and the zone of each creature and object.
- **VMaNGOS:** everything Forever keeps from Classic at patch 1.12: quests with their text, givers and rewards,
  creatures, objects, items and their stats, loot tables, vendors, trainers, factions and zones.

## Grimoire's own facts (`static/`)

- `classes.json`: colours, armour and weapons, and each tree's role.
- `races.json`: race ids, starting zones and which talentsforever race each one is.
- `legacy.json`: which Legacy Challenges form a ladder (levels, skills, honor ranks, Field of Honor weeks), the dungeons
  each Spelunker challenge lists, the tradeskills' skill lines and the battleground factions.
- `builds.json`: the recommended builds, written as talent names in the order the points go in; the build turns them
  into talent codes for the current trees and prints any that no longer fit or had to be reordered.
- `dungeons.json`: dungeon, raid and battleground pages. The new dungeons' levels follow Blizzard's announced list.
- `zones.json`: Forever's new zones.
- `scripted-spawns.json`: raid bosses the server summons by script (so the database has no spawn for them), with their raid.
- `site.json`: launch dates.

The output lists anything to check, such as a build that no longer places all its points.
