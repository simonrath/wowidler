# T08 Warrior core implementation report

Status: DONE_WITH_CONCERNS — controller-approved bounded core package; full Warrior talent execution remains requested work tracked for T23. No claim that all nine class mechanics or all Warrior talents are complete.

## Implemented

- Established `task-8-shared-contracts.md` before Warrior implementation. Persistent CharacterState owns class progression; materialized ActorState has a validated snapshot for actor-only derive/allocation APIs. Commands refresh snapshots; schema validation rejects divergence, missing authority and NPC snapshots. Root explicitly approved this architecture.
- Pure source-backed creation for all 56 mutually cross-checked race/class/faction combinations and nine class identities. Other eight mechanical packages remain unsupported. Starting statistics and composite internal IDs are explicit owned Idle rules, never missing-field defaults.
- Browser-safe validated `Catalog.classes` and generated `content/authoring/class-defaults.json`; Node-only compiler in `tools/content/classes.ts` verifies each input against admitted byte/hash records before compilation. No Node tool imports enter gameplay modules.
- Admitted the official class rules as a **paraphrased primary fact extract**, retaining its actual URL, retrieval reference, capture kind and exact content SHA256. This is not a captured original article hash. Talent unlock10, dual40 and invested-point milestone positions11/16/21/31 are distinct. Costs, one-point-per-level schedule, row gates, switching, source description interpretation, starting balance and other unsourced rules are locked owned Idle authoring.
- Three distinct executable Warrior profiles: Arms uses Rend with an explicit no-refresh-while-active tactic guard; Fury uses Berserker critical bonus; Protection uses Defensive damage mitigation/threat plus Bloodrage. Each has an attack fallback and production simulation tests.
- Actual rage from dealt/taken damage, capped resource effects, immediate/periodic Bloodrage, stance-specific action legality, stance cooldown/retention, source rank training, an explicitly authored class quest link, reagents and rank predecessors, city-trainer reset, independent dual-spec allocations and out-of-combat switching.
- Six offered talents modify actual execution: Improved Heroic Strike, Improved Rend, Improved Tactical Mastery, Deep Wounds, Cruelty and Improved Bloodrage. Real source prerequisites, ranks, row gates, class/point budgets and unsupported allocation rejection are enforced. Periodic total rounding distributes remainder to the final tick.
- Retained all52 current Warrior talents/150 rank descriptions and source selectors, including source prerequisite relationships, rows, columns, status and IDs. Each of46 blocked talents has a machine-readable T23 gap and required primitive description. All52 current racial descriptions/IDs (including12 Priest variants) are retained and explicitly unsupported, with no 70425-to70338 custom-ID effect join.
- Machine-readable verification counts and per-offered-talent executed test evidence: `content/authoring/class-core-verification.json`. Counts distinguish imported52 / executable6 / execution-tested6 / blocked46. Tested talent count does not claim that every rank or possible combination was separately executed.

## TDD evidence

1. RED: `npm run test -- tests/classes --maxWorkers=1 --no-file-parallelism` failed with `Cannot find module '../../src/game/classes/creation'`; creation contracts/tests preceded implementation.
2. GREEN: `npm run test -- tests/classes/creation.test.ts --maxWorkers=1 --no-file-parallelism`:3/3 passed after implementation and exact source-rebuild check.
3. RED: class mechanics/talent suite failed because `src/game/classes/talents` did not exist. Tests specified production profile execution, damage rage, training/rank/stance/reagent rejection, prerequisite/rank/tier gating and dual/reset behavior before that implementation.
4. GREEN: classes9/9 passed after integrating real effects with T07 production advance.
5. Regression RED: Arms default tactic test expected `aura-already-active` but received no rejection. Added explicit authored tactic aura guard; GREEN classes+combat41/41.
6. Regression RED: removing persistent class progress while retaining an actor snapshot was erroneously accepted (`expected true to be false`). Schema fix rejects snapshots without persistent authority; focused mechanics9/9 GREEN.
7. Added executed-effect checks covering all six offered talents, snapshot authority and identical continuation through serialized small-budget runs. All passed. Focused classes+combat+domain48/48 before the final snapshot fix; mechanics9/9 after it.

## Final validation, after code freeze

- `npm run test -- --maxWorkers=1 --no-file-parallelism`: **11 files,128 tests passed**, zero failed,99.00s. Full suite run once, serial; no runner RPC timeouts. Includes all existing source-lock/content, domain, simulation, combat and UI tests.
- `npm run typecheck`: exit0, no TypeScript errors.
- `git diff --check`: exit0.
- Existing npm environment warning about unknown `http-proxy` appeared; test runner output otherwise had no warnings/failures. No source/code edits during final validation; only this report and derived test-evidence file were added afterward.

## Files changed

- New gameplay modules: `src/game/classes/{contracts,creation,resources,forms,talents,pets,training}.ts`.
- Extended typed contracts: `src/domain/{content,state,commands}.ts`.
- Production effect/tactic integration: `src/game/combat/{attack,effects,auras,tactics}.ts`.
- New tests: `tests/classes/{helpers,creation.test,mechanics.test,talents.test}.ts`.
- Locked sources: `content/adaptations/classes-idle-v1.json`, `content/sources/evidence/class-rules.json`, updated `content/sources/{registry,lock}.json`.
- Compiler/generated outputs: `tools/content/classes.ts`, `content/authoring/{class-defaults,class-core-verification}.json`.
- Durable shared contract copy: `docs/rulebook/classes.md` (identical text).
- Shared contract and this report under `.superpowers/sdd/2026-10-21-wow-forever-idle/`.

## Self-review and remaining scope

Fixed two concrete self-review defects with failing regression tests: Rend's default refresh starvation and actor snapshot authority forgery. Profile-triggered stance changes now obey the same cooldown/rage retention as direct stance changes. Preserved T07 clock/RNG/phase contracts, atomic rejection, existing UI and starter build tooling. No subagents, external publishing or GitHub network operations were used.

Remaining requested work is explicit, not deleted from scope: eight separate T08 class cycles; full46 blocked Warrior talents and unsupported racial execution; full rank/curriculum/reagent catalog and milestone-specific ability unlock semantics; quest/trainer/world/UI wiring in their later tasks/T23. The selected Defensive Stance quest link uses captured quest1638 identity with owned curriculum policy; general quest completion is not implemented here. Pets have an explicit future ownership/zero-party-slot contract only; no Warrior pet or later class pet mechanics are claimed.

The shared snapshot contract requires later level/stat/talent/form/rank commands to refresh actor snapshots atomically. Tests intentionally make stale snapshots fail closed; downstream implementers must respect this documented contract. `mechanics: playable` on Warrior means this bounded executable core, not full-tree completion; the generated gap lists and verification record state the remaining scope. Root owns independent review, broader Sites build/release and subsequent class gates.

## Review fix round1 — required class execution package

Finding: actions/effects could silently resolve a persistently classed character with a generic catalog, losing its class modifiers and rage behavior. Fixed with a shared typed `classExecutionReason` guard that checks persistent ownership and supported class definition for both acting and receiving characters. Direct attacks/casts/effects reject missing or unsupported packages atomically. Stats and actor-only talent/spell/rage helpers now require the execution package when the actor carries class state. A queued classed melee impact rolls back rather than applying generic damage. Legacy fixtures without persistent class progress keep their generic combat behavior.

RED: `npm run test -- tests/classes/mechanics.test.ts --maxWorkers=1 --no-file-parallelism` produced2 failed/9 passed: attack was accepted (`expected true to be false`) and queued impact lacked a diagnostic (`expected undefined to be defined`). The new regression covers missing and explicitly unsupported packages, incoming/outgoing actions/effects, omitted effect catalog, unchanged inputs, empty scheduled/outcome results, direct helper rejection and timestamp rollback.

GREEN after final test assertions: `npm run test -- tests/classes tests/combat tests/simulation --maxWorkers=1 --no-file-parallelism`: **5 files54/54 passed**,8.81s, started17:17:36UTC. `npm run typecheck`: exit0. `git diff --check`: exit0. Existing npm `http-proxy` environment warning only. Full suite was not rerun, as requested; original128-test full result remains explicitly attributed to commit da1a81e in the verification JSON. Per-talent test file hashes now refer to the amended test file and the54-test validation.

Changed `src/game/classes/resources.ts`, `src/game/combat/{attack,effects}.ts`, `tests/classes/mechanics.test.ts`, verification JSON and this report. No source factual claims, content scope, UI/world integration or T23 backlog changed. No outstanding issue with this review finding.
