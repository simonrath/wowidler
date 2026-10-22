# Independent expected values

The original `expected.json` fixtures were written before the adapter; the authored
Dynamic cases were added during review from the exact locked source, independently
of adapter output. All expectations are transcribed from
Questie/QuestieDB commit `af56aeef176b2b7534be683907c276c52beabb6d`, whose exact files
are byte-verified by the source lock. No adapter output generated this fixture.

| Expectation | Locked file and selection |
| --- | --- |
| Quest5 race mask4294967373/name | data/Forever/foreverQuestDB.lua, questData return[5][6]/[1] |
| Quest465 original object finisher1609 | data/Forever/foreverQuestDB.lua, questData return[465][3][2][1] |
| Quest5 breadcrumb163 | legacy/classicQuestFixes.lua, Load()[5][breadcrumbs] |
| NPC300 level30 | legacy/classicNPCFixes.lua, Load()[300][minLevel] |
| Item910 objectdrop1560 | legacy/classicItemFixes.lua, Load()[910][objectDrops] |
| Object167 zone10 | legacy/classicObjectFixes.lua, Load()[167][zoneID], enum zoneIDs.DUSKWOOD |
| Quest2 reputation81/100 | legacy/classicQuestReputationFixes.lua, Load()[2][reputationReward] |
| Item1307 quest123 | legacy/itemStartFixes.lua, LoadAutomaticQuestStarts()[1307][startQuest]; raw already has123, noOverwrites must preserve it |
| Quest299 level27 | generated/foreverBaseQuest.lua, Load()[299][questLevel] |
| Quest465 added object630696 | generated/foreverBaseQuest.lua and traces/foreverQuestTraces.lua, Load()[465][finishedBy_add]; duplicate addition must not duplicate or remove original1609 |
| NPC352 coordinates71.29/72.23 | foreverNPCFixes.lua, Load()[352][spawns], enum zoneIDs.STORMWIND_CITY=1519 |
| Horde quest8315 WARRIOR8316/DRUID8382 | legacy/classicQuestFixes.lua, LoadFactionFixes() class literal; remains effective under authored dynamic layer |
| Horde quest78124 starter/finisher211022, object409496, objective text, zone1497 | foreverQuestFixes.lua, LoadDynamic() questFixesHorde[78124], lines 2449–2454; src/corrections/enum/zones.lua UNDERCITY=1497 |
| Alliance quest78124 starter/finisher211033, object409496, objective text, zone1519 | foreverQuestFixes.lua, LoadDynamic() questFixesAlliance[78124], lines 2713–2718; src/corrections/enum/zones.lua STORMWIND_CITY=1519 |
| Quest97277 itemObjectiveFirst=true | foreverQuestFixes.lua direct-write prefix; annotation, not objective quantity |

Correction paths above are relative to `src/corrections/Forever/` unless a full
path is shown. The operation suite reads independent literal `shapes` values in
locked `tools/validation/table-correction-cases.lua`; it never executes its Lua
scenario builder or imports implementation-produced expectations. All17 shape/group
variants cover add, duplicate, absent removal, final removal, empty operations and
atomic conflicts. Additional literals exercise nil holes, default-icon equality,
instance sentinels, conflicting operands, unknown slots and sparse-list rejection.

The authored quest78124 Static row lists both NPC starters211022/211033; the
nonempty Dynamic row replaces it with the selected faction’s sole starter while
preserving object409496. Tests assert the literal effective fields for both factions
and the Horde correction’s prior Static value, exact selector and provider identity.
