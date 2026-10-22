# Task 8 — Shaman core implementation report

Status: DONE_WITH_CONCERNS — authorized bounded core implemented; final full attempt and successful targeted correction documented below. Authorized scope is the controller-approved bounded Shaman core, not full tree completion. Base commit: `0edb48` (existing build branch). Shared contract revision v6 was proposed to and explicitly approved by the controller before production edits.

## Implemented

- Three class-owned profiles: Elemental maintains Searing then casts Lightning Bolt; Enhancement imbues Rockbiter, maintains Strength of Earth and melees; Restoration heals the lowest eligible injured ally and maintains Healing Stream. All have actual mana consumption and attack fallback. Shaman is unpositioned/melee, preserving hostile incoming melee; `battle` is inert compatibility data.
- Imported all50 current70425 Shaman talents and148 rank spell identities/descriptions with exact tiers/prerequisites. Offered exactly3 talents/15 ranks: Convection60001, Thundering Strikes61001, Improved Healing Wave62001. Every offered rank has a real executed-effect test; all47 unavailable talents retain individual T23 primitive requirements.
- Added a distinct independently stateful `totem` actor and ordered pulse/expiry events. Source5HP; zero party slots; active persistent Shaman owner; independent resource/stats/auras/cooldowns/threat/lifetime/pulse clock; one living owner+element. Earth/fire/water are executable; air remains unoffered T23 scope. Hunter pet semantics are unchanged.
- Searing applies real source-owned damage/threat; Healing Stream applies effective group healing and threat after real hostile engagement; Strength of Earth adds actual ally melee AP through the explicit Strength-to-AP projection. NPCs can target and kill totems. Replacement retires only its same-element predecessor, preserves other elements, and cleans old-source buffs. Unique actor IDs prevent stale pulse/expiry corruption. Owner death/departure, encounter end and expiry stop effects; totem death never loses the encounter. Single/sliced/serialized execution matches exactly.
- Rockbiter49/79AP uses one exclusive60min imbue and owned11000bps melee-only threat. The owned starter weapon projection fails closed with assigned mainHand before admission/completion and before actual queued hits; unrelated armor remains legal. No invented item IDs.
- Source totem-tool requirements remain explicitly **unfulfilled**, with an authorized typed `totemToolAccess: owned-idle-encounter-tools` projection checked before summon and during totem execution. Actual inventory/class-quest requirements remain T09/T10/T23 replacement work. Ordinary missing spell reagents still reject atomically.
- Typed direct-heal opt-in to existing `canCrit` supports source Thundering Strikes without changing existing Priest/Paladin heals or giving totem/periodic ticks critical rolls. Existing multiplier2 is owned Idle. Established simultaneous melee damage ordering is preserved; new direct Shaman effects validate living/side/zone/package context.
- Class training, talent allocation, spec switching and combat completion retain persistent character authority and atomic actor-cache refresh. Missing packages, foreign/unlearned ranks, invalid snapshots, insufficient mana and invalid ownership fail closed.
- Current source costs/levels/casts/durations remain separate from explicitly authored midpoints, AP projection, pulse AI, GCD, starter stats, curriculum/prices and qualitative group/range behavior. Runtime remains browser-safe; only the Node compiler reads locked source bytes. Existing UI files were untouched.

## Source admission and boundaries

Read the mandatory brief, Shaman scope, constraints, retrieval manifest, readiness handoff, shared classes v5 contract and implementer prompt first. Used the existing locked Grimoire70425 source only for current identity/descriptions; no70338 talent-effect join or invented source IDs. Admitted `/workspace/scratch/0854f32a873c/t08-primary-shaman-rules.json` as `content/sources/evidence/shaman-rules.json` with source ID `blizzard-shaman-rules` in the source lock.

Primary URL: https://news.blizzard.com/en-us/article/24302097/world-of-warcraft-forever-class-deep-dives-mage-and-shaman . Capture is explicitly a paraphrased fact extract (`turn31view0 lines87-103`), not original HTML. Its1sec totem GCD/5min persistent buff totems/60min weapon imbues agree with the selected current tooltips; short Searing remains30sec. No selected tooltip conflict was found or silently overridden. Totemic Recall25% refund includes the explicitly reported beta bug; recall/projection/Call spells are unoffered evidence and T23 work, not asserted functioning behavior.

Frozen hashes:

| File | SHA256 |
| --- | --- |
| content/sources/evidence/shaman-rules.json | 46dd50892b102e8ab4731a1d1199ebe2a0c803295619a2a60a2ab00305f8f24e |
| content/adaptations/classes-idle-v1.json | c72ae9d773e575da4ba6d18eac2902d9a741d1dada880c4b3c75ac307bbbd248 |
| content/authoring/class-defaults.json | a6cdf11e5a68d52cd36d478ecde5df797ea71673253735ff7f9c0effa3f959f4 |
| tests/classes/shaman.test.ts | c9b8d6e12d869c8936b69f905cee0fca27e6a890de72ddd2f3ddd5e39772d800 |

## TDD and validation evidence

Commands ran from `/workspace/sites/wow-forever-idle`. Displayed times are Vitest runner times on2026-10-21. Existing runner IPC-yield setup was preserved; no dependency/runtime/harness edits.

1. RED18:56:30: `npm run test -- tests/classes/shaman.test.ts --maxWorkers=1 --no-file-parallelism` —4 failed. Expected: imported Shaman talent count0 versus50, and absent Shaman class progress prevented profile allocation. No production implementation preceded this run.
2. GREEN19:00:20: same command —4/4 passed,2.42s. `npm run typecheck` exit0.
3. Expanded behavior GREEN19:02:02: same command —14/14 passed,2.43s; all15 selected talent ranks plus independent lifecycle/crit/threat/weapon/sliced tests.
4. Additional RED19:03:50: same command —16 passed,2 failed. Missing Shaman package wrongly allowed training/allocation; strict new live-effect guard broke established simultaneous melee (`handler-error: actor-dead`). Corrected package checks and established-impact context; no previous-class semantics were intentionally changed.
5. Cross-class GREEN19:04:13: `npm run test -- tests/classes tests/combat tests/simulation --maxWorkers=1 --no-file-parallelism` —10 files,155/155 passed,14.89s; `npm run typecheck` and `git diff --check` exit0. Includes Warrior, Paladin, Hunter, Rogue, Priest and Shaman.
6. Source-rebuild/final focused GREEN19:06:24: `npm run test -- tests/classes/shaman.test.ts tests/classes/creation.test.ts --maxWorkers=1 --no-file-parallelism` —2 files,21/21 passed,3.17s. Own tool access and missing ordinary reagent guards verified. Generated catalog exactly rebuilds from hash-verified sources.
7. Final focused GREEN19:06:58: `npm run test -- tests/classes/shaman.test.ts --maxWorkers=1 --no-file-parallelism` —18/18 passed,2.13s. Includes hostile periodic-effect compatibility and simultaneous death regression.
8. **Product freeze after step7.** One final full-suite run: `npm run test -- --maxWorkers=1 --no-file-parallelism` (stdout/stderr captured in `/workspace/scratch/0854f32a873c/t08-shaman-full-suite.log`). Result appended below. No runtime or test edits after freeze. One source-registry metadata correction followed the full attempt, documented below.

Only pre-existing npm warning: `Unknown env config "http-proxy"`. No configuration workaround applied.

## Files changed

- `content/adaptations/classes-idle-v1.json`, `content/authoring/class-defaults.json`, `content/sources/lock.json`, `content/sources/registry.json`, new `content/sources/evidence/shaman-rules.json`: owned package, generated runtime, locked facts/adaptation.
- `src/domain/{content,events,state}.ts`, `src/game/classes/contracts.ts`: additive typed v6 schemas.
- New `src/game/classes/totems.ts`: totem owner/template/lifecycle/tool and weapon projection guards.
- `src/game/classes/{resources,talents,training}.ts`: Shaman derivation/talent consumers and package validation.
- `src/game/combat/{attack,auras,effects,positions,tactics}.ts`, `src/game/simulation/queue.ts`: pulses, side/lifecycle/targeting/effects, valid-source buffs, direct-heal crit and event ordering.
- `tools/content/classes.ts`: Node-only admitted-source compilation, complete Shaman talent import and per-talent primitive backlog.
- New `tests/classes/shaman.test.ts`, `tests/classes/creation.test.ts`:18 bounded execution/negative/authority tests plus executable class-set assertion updated to6 classes.
- `docs/rulebook/classes.md`: controller-approved v6 contract and explicit source/adaptation/T23 boundaries.
- This report.

## Self-review and concerns

Self-review inspected the shared diffs and source/runtime boundaries. Added coverage for simultaneous lethal impacts rather than allowing live guards to change T07 behavior; hostile periodic effects remain enemy-side. AP buffs from invalid/missing totem packages are excluded from actual ally attacks. No subagents, GitHub network, image generation, deployment or UI restructuring were used.

Approved scope limits: only3 of50 talents executable,11 selected spell ranks,3 totem templates, qualitative encounter-side grouping, no actual tool/class-quest acquisition, owned weapon/Strength projections, no generic mana regeneration or full server AI. All are explicitly retained as T09/T10/T23 work. This is not full class/tree completion or authentic server combat. Retained dead totem records remain until encounter teardown; long-run performance tuning belongs to the later simulation/load gate. Existing `attack.ts` is already a large shared dispatcher; changes follow its current organization, with owned totem state isolated in the focused new module.


## Final full attempt and targeted correction

- Full serial suite19:07:04: **228 passed,3 failed /231 tests;14 passed,2 failed /16 files; exit1;162.61s; no unhandled IPC errors.** All18 Shaman and all class/combat/simulation/UI assertions passed. It is not reported as a clean full run.
- Real source-admission defect: `tests/content/source-lock.test.ts` expected `registry.sources === lock.sources`; the new `blizzard-shaman-rules` source had been added to the lock but not its registry mirror. Read the exact diff and existing invariant; corrected only `content/sources/registry.json` by mirroring the already admitted lock source. No runtime/adaptation/generated catalog/test/harness change followed freeze; all four frozen hashes above remain valid.
- Two `tests/content/playable-packet.test.ts` cases exceeded the existing5000ms timeout without an assertion failure: `rejects missing or unsafe cycle` took15000ms; `rebuilds deterministically and checks the checked-in packet and inventory` took6099ms. No timeout/harness/dependency changes were made.
- Follow-up `npm run test -- tests/content/source-lock.test.ts tests/content/playable-packet.test.ts --maxWorkers=1 --no-file-parallelism`,19:10:18: **29/29 passed,2/2 files; exit0;44.64s**. It retested the complete affected files. Former timeout cases passed at1799ms and3115ms respectively, under the unchanged5000ms limit. Log: `/workspace/scratch/0854f32a873c/t08-shaman-source-followup.log`.
- Final typecheck/diff outcome is recorded with the commit below. Full suite was not automatically repeated, respecting the single-full-run direction; controller was informed and asked for rerun preference. The honest concern is the non-clean initial full attempt, despite all its failed cases passing after the bounded metadata correction/retry.

Final `npm run typecheck && git diff --check`: exit0. Controller explicitly accepted the targeted correction evidence and instructed no second full run; no harness/test refactor. Status remains **DONE_WITH_CONCERNS** for timing flakiness in the initial full attempt. T26 broad full verification must revisit if timing recurs. Fresh independent review remains controller-owned.
