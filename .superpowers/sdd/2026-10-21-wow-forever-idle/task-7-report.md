# Task 7 — combat, effects, threat and tactics

**Status: DONE.** Final stable serial suite: 106/106 tests across 8 files, exit 0. Final typecheck and diff check: exit 0.

## Implementation

Implemented the prescribed six combat modules and public `CombatAction`, `Effect`, `EffectContext`, `Resolution`, `ActionChoice`, `resolveAction`, `applyEffects` and `chooseAction` contracts. Pure resolution copies its input. Real production handlers now compose with `createAdvance`; unsupported gameplay events still fail closed.

- Validated browser-safe `CombatCatalog` adapter derives spell execution from the actual checked-in T05 packet. Heroic Strike uses sourced next-melee bonus/cost and owned threat; recipe 3275 uses joined recipe duration/material/profession and creates pending output, not claimed inventory.
- Explicit resource costs, cast time, GCD, cooldowns, interruption, school immunity, physical armor, consumable absorption, effective healing/damage, periodic damage, capped/refreshing armor buffs and per-NPC threat.
- Abstract target-side/zone/range/sector validation; ordered maximum-12 priorities with rejected-rule reasons. Unknown item use, unknown effects, and unimplemented compound melee behavior remain blocked.
- Serialized actor extensions for aura/cast/position/threat/cooldowns and idempotent death resolution; actor vitals synchronize to the active persistent character.
- Established impacts execute before death, decisions schedule later impacts, and real combat is resumable across budgets/serialization. The pure-result adapter replays allocations in original sequence order through guarded scheduler functions.
- Capability register links every supported effect to a behavioral test. `docs/rulebook/combat.md` records exact owned formulas, rounding, stacking, timing and limitations. Updated the earlier scheduler integration documentation.

Architecture was raised with the controller before implementation. Controller accepted a validated browser-safe typed catalog extension/adapter and optional state extensions while preserving public signatures. No UI changes, Node tooling imports into the game modules, new sources, image generation, site work or deployment.

## TDD evidence

1. Initial RED: `npm run test -- tests/combat/resolution.test.ts` exited 1, failing collection with `Cannot find module '../../src/game/combat/effects'`. The nine authored behavior tests preceded implementation.
2. First implementation: 8/9 passed. The Heroic Strike assertion exposed the synthetic fixture's existing attackPower=10 contributing one point under the documented formula. Set fixture attackPower explicitly to 0, preserving the intended isolated 10 base + 11 bonus = 21 evidence; no production formula was weakened. Focused tests then passed 9/9 and typecheck passed.
3. Expanded required integration/regression evidence: focused suite passed 15/15 (existing swing replacement, real production long/sliced combat, independent cooldown, threat, sector/zone and unsupported composition).
4. Cast-completion continuation RED: focused suite 15/16, expected enemy health 90 but observed 100 after heal completed and fallback attack should have resumed. Added production post-cast decision scheduling/known-readiness retry. GREEN: 16/16.
5. Self-review duplicate death RED: focused suite 16/17, expected one consecutive defeat but got two for duplicate death notification. Added persisted death-resolution marker/idempotency guard. GREEN: `npm run test -- tests/combat/resolution.test.ts tests/simulation/determinism.test.ts` passed 28/28; typecheck passed.
6. Self-review scheduling allocation RED: focused suite 17/18, an earlier-allocated expiry was replayed with sequence 4 after its later-allocated tick sequence 3. Replayed planned events sorted by their original allocation sequence, preserving scheduler IDs/order. GREEN: the same combat+scheduler command passed **29/29**, output clean except the inherited npm environment warning; final typecheck passed.

7. Self-review eventless-time RED: focused suite 18/19, expected `chooseAction` to return `attack` after reaching 100 ms, but it returned no action because state-only tactics still read the previous time. The production `advance` wrapper now exposes the reached checkpoint time in `state.combatTimeMs`, leaving generic `createAdvance` unchanged. GREEN: combat+scheduler **30/30** and typecheck exit 0. This final RED test was inadvertently added while the first serial full run was still running; that run therefore completed with 105 passing / 1 failing assertion. Product/test edits were then frozen for the final stable run.

## Final validation

- `npm run test`: all **103/103 assertions in 8 files passed**, but process exited 1 with Vitest worker RPC `Timeout calling "onTaskUpdate"` during parallel slow content-import suites. This was **not** counted as a successful suite run.
- The first serial retry eliminated the RPC error but picked up the concurrent final RED test (105 passed / 1 failed), as recorded above. The final stable `npm run test -- --maxWorkers=1 --no-file-parallelism` completed **106/106 tests in 8/8 files, exit 0**, duration 97.37 s. No product/test edits occurred during that final run and no global test configuration was changed.
- `npm run typecheck`: exit 0 after the final implementation fix.
- `git diff --check`: exit 0.
- Focused final coverage: 19 combat tests plus 11 scheduler tests, 30/30 passing.

## Files changed

Created:
- `src/game/combat/attack.ts`
- `src/game/combat/effects.ts`
- `src/game/combat/auras.ts`
- `src/game/combat/threat.ts`
- `src/game/combat/positions.ts`
- `src/game/combat/tactics.ts`
- `tests/combat/resolution.test.ts`
- `docs/rulebook/combat.md`
- This task report.

Updated:
- `src/domain/content.ts` — validated engine effect/spell definitions and typed catalog execution extension.
- `src/domain/state.ts` — optional serializable combat state.
- `src/domain/events.ts` — typed combat events.
- `src/game/simulation/queue.ts` — explicit event phase defaults.
- `src/game/simulation/advance.ts` — real production handler composition.
- `src/content/capabilities.ts` — behavioral evidence register.
- `docs/rulebook/time-and-random.md` — actual T07 integration status.

## Self-review and limits

Read all combat modules and the domain/scheduler/capability diff. Fixed duplicate-death accounting, scheduler allocation replay and the state-only tactics clock after empty time advances, each with a failing regression first. The earlier full-run/edit overlap was an avoidable verification mistake; the frozen final run provides clean evidence. Existing source and contract tests remain applicable; optional state fields retain old fixtures. No mock handler replaces production combat in the new tests.

Owned armor/attack-power/crit/threat/timing/formation rules are explicitly documented and are not authentic server reconstruction. Only the actual packet's two source effect types are admitted; other engine primitives are synthetically proven infrastructure, not claims that additional source spells/classes are complete. Bandage use remains unavailable. Loot/objective/reward persistence, full classes, revival and automatic retry execution remain later tasks. Creation output is pending, never already claimed. Catalog snapshot/simulation-version binding remains the caller responsibility established in T06.

The supplied repository uses dense domain contracts; this task extends them without unrelated restructuring. Combat code stays in the prescribed module set. The npm `Unknown env config "http-proxy"` warning predates the task and appears on test/typecheck invocation; it is not a failing application assertion.

## Review fix round 1 — base `1de8b9a`

Addressed all three Important findings with bounded changes:

1. Interruption now cancels the cast and schedules a decision 1 ms later for a living actor in a running encounter. A cast discarded at completion for an invalid target likewise schedules a later decision. Spent resources remain spent and the cancelled heal still heals zero.
2. An invalid established melee impact clears pending melee state and schedules reevaluation 1 ms later. Targets resolved dead at an earlier timestamp are also discarded without replaying the hit. Same-timestamp simultaneous impacts remain valid. To make reevaluation useful when a different legal enemy exists, target choice now filters legality for the concrete action before applying the unchanged threat ordering/tie-break. This accompanying filter was confirmed in scope by the controller. Existing side/encounter membership checks are retained, with an additional regression covering them.
3. Flee uses the shared self-target eligibility validation: encounter must be running, actor alive and present in the encounter zone. `won`, `lost` and `fled` states are rejected without mutation; a legal flee remains available.

Updated the combat rulebook to describe these exact continuation and eligibility rules. Snapshot/version binding remains deferred to the controller's T17/T18/T25 scope; no unrelated mechanics, host configuration changes or broad refactor.

### RED

`npm run test -- tests/combat/resolution.test.ts`

Exit 1: **7 failed / 19 passed**. Three continuation regressions observed enemy health 100 where 90 was expected; terminal encounters returned `{ ok: true }` for flee; a character in another zone could also flee. Tests were added before production edits.

### GREEN and final verification

After the fixes, `npm run test -- tests/combat/resolution.test.ts tests/simulation/determinism.test.ts` passed 37/37. Added the controller-requested side/membership regression, then froze all product/test edits for final validation:

- `npm run test -- tests/combat/resolution.test.ts tests/simulation/determinism.test.ts`: **38/38 passed**, 27 combat + 11 scheduler tests, 2/2 files, exit 0, duration 1.52 s.
- `npm run typecheck`: exit 0, no compiler errors.
- `git diff --check`: exit 0.

No full suite rerun, per the controller's bounded review-fix instruction. The inherited npm `Unknown env config "http-proxy"` invocation warning is unchanged. No file edits occurred while verification commands were running.

### Files and self-review

Changed `attack.ts`, `effects.ts`, `tactics.ts`, `threat.ts`, `resolution.test.ts`, `combat.md`, and this report. Read the complete review diff after testing. Later decisions use positive simulation time, preventing earlier-phase insertion; target ordering remains deterministic; terminal result rejection returns the original checkpoint. No remaining concern identified within these three review findings.
