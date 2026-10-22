# Task 2 — Source lock and independent reference inventory

Baseline: `3717689`. Scope: source metadata, exact evidence bytes, validators and independent snapshot inventory. Domain interfaces, product UI, simulation and hosting identity were preserved. No GitHub downloads were performed by this task: the 51 QuestieDB files and the finalized 68-file additional-source batch were reused from connector-only staging.

## Deliverables

- `content/sources/registry.json`, `lock.json`: 11 sources; 124 captured files; 34,633,963 captured bytes. Three historical/schema sources are pinned but explicitly unretrieved. Every captured file has a source ID, immutable commit/blob or content-addressed primary extraction, original path, SHA-256, byte length, local path, field coverage, branches, language/build and limits.
- `tools/content/schema.ts`, `lock.ts`: strict source and inventory schemas; exported SourceLock/SourceFile/ReferenceInventory types; Result-returning loaders; synchronous exact-byte SHA-256/length/Git-blob verification returning Validation. Mutable revisions, orphan files, duplicate captures/destinations, invalid relative paths and branch/source mismatches fail validation.
- `content/snapshots/FOR-IDLE-2026-10-21-PUBLIC/{scope,reference-inventory}.json`: 40 categories from concept02; explicit exclusions; separate beta and announced denominators and independent availability/data-maturity/implementation axes. Unknown full-catalog denominators remain null, including items and total dungeons/raids.
- Published official matrix independently enumerates 56 race/class/faction combinations; race9, class9, faction2. Skyborne is one race with two faction variants. New-dungeon subset enumerates9; first-phase raid subset enumerates3 and remains announced for December9. Barrow Deeps size10/bosses8 and Hyjal Summit size20/bosses13 were recaptured from official full-text articles. Onyxia is the named encounter; raid size remains null because the captured primary evidence does not verify40.
- `reports/content/FOR-IDLE-2026-10-21-PUBLIC/gaps.json`: 46 stable open gap IDs. These cover unknown independent denominators, Questie NPC placeholders, missing scope IDs, exact source build gaps, differing additional client builds, thin new quest rewards, Classic loot rates, unvalidated item reconstruction and source licensing limitations.

## Source evidence and limits

QuestieDB is fixed at `af56aeef176b2b7534be683907c276c52beabb6d`. Its exact51 byte captures include Forever entity DBs, meta, the generated/legacy/trace/authored correction layers, localization, enums and documentation. No placeholder0/1 NPC health is imported as usable combat data. Correction precedence remains a later parser task.

The exact approved pins for classic-db `ac81ce5ebca0d8b372f199bd73c12b87b5527c52`, mangos-classic `547c55eb9cd6b7795d2951f844d679d3d7f18957` and WoWDBDefs `77582e12f6f61c7647635bc31c152b119b9dd7f9` are registered as unretrieved; they have no fabricated file hashes or builds. Original1.12 server references and cross-branch table schemas never imply Forever gameplay coverage. Classic Era remains a separate role with no captured Era dataset.

Additional staging finalized before registration: Grimoire `39f3c87be20c6388762fae48cc71c0c91432421d` and wow-database `852e47451e7e08229488f1f0a8c0a4402c3580e4`. All68 original bytes were independently checked again against staged SHA-256, size and Git blob. Grimoire talents/abilities carry build1.60.1.70425; Grimoire gear/NPC loot remain original112; mixed quest/world metadata has both explicit branches. Client table originals are compressed gzip build70338, not silently treated as the newer build. No extra later zone-file research was admitted to this lock.

Five small official factual extraction files record source URL, retrieval date and extraction method/ref. Their hash covers saved factual extraction bytes, not unavailable original HTML. The class matrix and new-dungeon table were reopened successfully. The raid overview remained inaccessible, but official-domain search verified the three names/date. The official Legacy article verified8/13 boss counts and Onyxia; the What's Next article verified10/20 sizes and December9. Captured sources are evidence, not independently verified complete entity catalogs or rights clearances.

## TDD RED / GREEN evidence

1. Wrote the first four tests before production implementation. `npm run test -- tests/content/source-lock.test.ts` at14:06:11 failed because `tools/content/lock.ts` did not yet exist.
2. Added only typed failing loader/verifier stubs and the source fixtures, then reran at14:08:36. Expected assertion RED:3 failures (`rejectsMutableOrChangedSource`, `verifies every captured source and rejects orphan or duplicate records`, `unknownDenominatorRemainsNull`). The static independent-subset fixture test passed; no passing fixture test is represented as an implementation RED.
3. Implemented strict schemas and actual byte verification. Focused run at14:09:28 passed4/4. Initial typecheck passed.
4. Added the additional-source boundary test before admitting additional files. Focused run at14:10:18 failed1/5 because the Grimoire talent build was absent. Registration initially exposed an incorrect assumed client repository path; inspected the staged manifest and corrected the test lookup to the exact upstream `data/forever/client-extract/SpellEffect.jsonl.gz`, and the build/field classification to match that path. Focused run at14:11:33 passed5/5.
5. Final whole-project run `npm test` at14:11:42 passed12/12 across2 files, including all7 existing domain contract tests. `npm run typecheck` exited0. `git diff --check` before staging exited0. The staged full check identified two existing upstream trailing-whitespace lines in `classicObjectFixes.lua:469` and `itemStartFixes.lua:2135`; these are intentionally preserved for exact byte identity. The authored-file check `git diff --cached --check -- . ":!content/sources/vendor/**"` exited0. The environment-only npm `http-proxy` warning was present; no host configuration changed. No test failures remain unreported.

## Self-review

Verified all124 files from the committed local paths through the production verifier, including gzip originals and Git blob hashes. Registry sources exactly match lock sources. Cross-branch old loot and newer talent/client snapshots are retained separately. No source import count is used as a total reference denominator. Every concept02 category has either independently supported counts or an explicit unknown count/gap. No byte capture is marked playable; no unsupported combat magnitudes or numeric entity IDs were invented. Changes are confined to source evidence, content metadata, build-time tooling, tests and this report. Source files are outside public assets and are not imported by runtime modules.

Remaining work belongs to later tasks: actual parsing/correction precedence, normalized IDs and joins, complete reference denominators, verified server NPC stats/AI, missing new quest rewards, matching client/server rules and playable consumers. Full raid overview/Onyxia size remains an honest evidence gap.


## Review fix round 1

Verified the Important finding against captured `grimoire/NOTICE.md` (LibQuestDB and VMaNGOS sections), `data/meta.json` and tuple definitions in `docs/data-types.ts`. NPC/object captures combine original1.12 identity/template data with Forever zone associations. Their registry/lock branches are now `[original112, forever]`; field coverage explicitly separates `original112.identity-and-template-fields` from `forever.zone-association`. Applicable source/file limitations record LibQuestDB QuestDB-v0.1.0, client1.60.1.69913 and harvest2026-09-28, alongside existing talent70425 and client-table70338 distinctions. The mixed file build remains null because one build cannot version all constituent fields. Quest/meta limitations, scope, README and the existing stable `FOR-GAP-BUILD-CONFLICT` gap now retain this third client snapshot.

The Minor finding was also verified: the saved Legacy evidence records a named Onyxia encounter and does not provide an exhaustive raid boss count. `firstRaids` Onyxia bossCount is now null; the raid-details gap explicitly states the distinction. No exhaustive statement was invented or newly downloaded.

TDD evidence: added two focused regression tests first. `npm run test -- tests/content/source-lock.test.ts` at14:18:48 exited1, with exactly2 failures: `retains Forever LibQuestDB zones inside mixed Classic NPC and object captures` (original112-only actual branches) and `does not infer an exhaustive Onyxia boss count from one named encounter` (actual1 instead of null). After metadata fixes, the covering command at14:19:15 exited0:

```text
npm run test -- tests/content/source-lock.test.ts
✓ tests/content/source-lock.test.ts (7 tests)
Test Files 1 passed (1)
Tests 7 passed (7)
```

Additional covering commands/output at14:19:32:

```text
npm run typecheck
> tsc --noEmit
(exit 0)

npm test
✓ tests/domain/contracts.test.ts (7 tests)
✓ tests/content/source-lock.test.ts (7 tests)
Test Files 2 passed (2)
Tests 14 passed (14)
```

Self-review: `git diff -- content/sources/vendor` is empty; all124 exact-byte verifications pass through the focused production-verifier test, preserving vendor hashes/byte lengths. Registry and lock source arrays remain identical. Classic-only loot and the existing differing client builds are unchanged. Source schema/runtime/domain/hosting code and npm host settings are untouched. `git diff --check` exited0. The environment-only `http-proxy` npm warning remains. Both review findings are covered and no test failure remains.
