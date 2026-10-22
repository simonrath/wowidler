# Task 4 — Effective QuestieDB import

Status: DONE. Final frozen verification passed; repeated full-snapshot outputs match byte hashes and manifest identity. Base: ea99cf3.

## Result and boundary

Implemented `importQuestie(input: QuestieInputs, lock: SourceLock): ImportResult`,
`packageCatalog(catalog: Catalog, snapshot: SnapshotSpec): PackageManifest`,
`diffCatalog`, and the requested frozen CLI. All source tables and correction
selectors are extracted from verified locked bytes. Callers provide byte buffers,
a faction/class persona and optionally an explicit output selection; callers cannot
supply trusted field values or selector labels. The frozen CLI uses no selection.

The controller explicitly approved a **source-evidence admission** boundary:
retain every source relation and missing target, preserve OR/group semantics, and
leave canonical gameplay relationships/prerequisites unavailable until translated.
A partial source package creates `evidence-active.json`, never gameplay `active.json`.
Its manifest says `admission=validated-source-evidence`, `gameplayReady=false`.
No entity is made playable, no unknown combat magnitude is fabricated, no IDs are
invented to fill graph holes, and the independent denominator remains null.
T05 supplies the closed executable packet. Source fields remain accessible as
`questie.*` evidence but do not automatically materialize into gameplay entities.

## Exact pinned inputs and extraction

Questie/QuestieDB commit: `af56aeef176b2b7534be683907c276c52beabb6d`.
The original51 captured files plus7 exact semantics captures are admitted and
SHA256/Git-blob/byte-length checked before parsing. Six captures were provided
initially; the controller retrieved `src/meta/normalize.lua` through the GitHub
connector when the operation engine exposed a needed normalization dependency.
No source was downloaded by shell/HTTP or executed as Lua.

Additional admitted files:

- docs/api.md
- docs/adr/0016-table-correction-operations.md
- src/corrections/tablePatch.lua
- src/corrections/registry.lua
- src/corrections/manifest.lua
- tools/validation/table-correction-cases.lua
- src/meta/normalize.lua

Actual provider order comes from parsed `src/config.lua#config.ownedCorrections`,
not directory sorting or caller labels. Four raw DBs are followed by all18 Static
providers (6legacy,4generated deltas,4traces,4authored) and8 Dynamic providers
(4legacy faction/class providers,4authored). Forever selects Classic rules;
registry.staticMergeOptions' older-expansion overlay does not apply when source
and target order are both1. `itemStartFixes` retains its explicit
noNewEntries/noOverwrites policy, including an existing explicit field deletion.
All declared provider prefixes and methods are structurally validated.

The closed reader supports literal tables, positional nil holes, named/indexed
keys, safe-number addition/subtraction, declared enum lookup, parentheses,
class-indexed literal tables, literal faction branch selection, and literal
`l10n(...)` English keys. Module declarations/imports are parsed, never invoked.
The observed `QuestieCorrections.itemObjectiveFirst` and
`killCreditObjectiveFirst` direct writes are retained as sourced display-order
annotations (including quest97277), not objective quantities. Unknown calls,
functions, aliases, operations, field indexes and malformed shapes stop with file
and operation context. No generic Lua VM/eval/loadstring/dofile exists.

All four metadata files and enum tables are extracted, including Forever race bits
32/33. Numbers such as4294967373 stay exact; no JavaScript bitwise operation is used.
German names/objective text/NPC subnames are separately sourced; English values and
full correction histories remain available. Missing German text stays missing.

## Correction semantics

Shape rules implement lists, grouped lists, atomic pairs/triggers, six objective
groups, spawn lists, whole waypoint paths and complete extra-objective rows.
Surviving order is preserved; additions append absent complete normalized values.
Grouped removals preserve omitted groups. Repeated points within a waypoint path
survive. Replacement-plus-operation and overlapping add/remove are rejected;
atomic additions conflict with a different existing value. Objective group4 allows
remove-old then add-new. Operands are validated before normalization, including
otherwise skipped noNewEntries rows. Empty operations neither acquire field
ownership nor create an entity and do not validate/read the backend value.

Explicit nil constructor values are no-ops; empty replacement tables clear fields.
Read normalization follows the admitted source: absent objective icon/extra-objective
index zero, phase-zero omission, two-element instance sentinels, waypoint third-slot
omission, faction strings, pair-zero deletion, and the distinction between nil
empty spawn/waypoint lists and never-nil questgiver/objective groups. Missing numeric
*fields* are not promoted into knowledge by copying the upstream getter default0.
NPC minLevelHealth/maxLevelHealth become explicitly sourced compatibility0/1,
while combat.maxHealth and every other gameplay combat stat remain missing.

Questie map coordinates remain source map percentages; no fake world coordinates
or map-node IDs are created. DropTables/classicItemDrops.lua is verified and listed
as a limited sample questdrop dependency, not complete Forever loot. Support files
(XP/maps/dungeons/drop samples) are captured dependencies rather than independently
verified playable entities. No reward/objective-count inference is made from prose.

## Packaging and graph diagnostics

Packages stage all files, validate evidence fingerprints/graph/schema, calculate
SHA256 and byte counts, verify staged files, then atomically replace the appropriate
pointer. Existing package files are rechecked on repeat imports; corruption or
validation failure preserves the old pointer. Manifest includes schema, adapter and
rules versions, source revisions, all58 exact file dependencies, persona, annotations,
per-partition hashes/counts/sizes and reference-gap totals. Partitions are build-only;
none of the vendored Lua or giant JSON evidence is imported into browser/Worker code.

The complete typed source-reference graph retains relation field and structural
selector, original ID, target and resolution. It contains301487 edges for the default
Alliance/WARRIOR persona:408 target references to uncaptured Questie entities and
53104 references into external domains (zones/spells/skills/factions/phases/etc.).
Signed source identifiers retain their sign and remain outside translated gameplay
semantics. Remaining247975 edges resolve to captured Questie entities. Giver groups,
objective groups, prerequisite alternatives and missing targets remain in original
source fields; they are not flattened into empty verified relationships or AND lists.

Full entity output:46954 records, comprising21294 items,13393 NPCs,7035 objects,
and5232 quests. These are capture counts, not a complete-game denominator.

## TDD and verification evidence

Initial RED (2026-10-21 14:46 UTC):

```
npm run test -- tests/content/questiedb.test.ts
FAIL tests/content/questiedb.test.ts
Error: Cannot find module '../../tools/content/questiedb'
Test Files 1 failed (1); Tests no tests
```

This was expected: independent literal fixtures and behavioral tests were committed
to the worktree before production modules. Fixtures are documented in
`tests/fixtures/content/questiedb/README.md`. The locked upstream operation fixture
contains17 shape/group variants and supplies literal expected unions/empty values,
independently of this implementation; no Lua scenario builder is executed.

Additional observed RED from strengthened independent removal cases:

```
npm run test -- tests/content/questiedb.test.ts -t 'uses independent'
expected {} to deeply equal undefined
```

This exposed the required empty spawnlist versus never-nil questgiver distinction.
The implementation was fixed; focused shape tests then passed.

Additional observed RED from registry-policy self-review:

```
npm run test -- tests/content/questiedb.test.ts -t 'validates skipped'
expected [Function] to throw an error
```

An invalid operation in an otherwise skipped noNewEntries row was being skipped.
Validation now precedes the skip; a paired fixture also proves noOverwrites cannot
resurrect a previously explicitly deleted value.

Full suite before the final focused policy fix:

```
npm run test
Test Files 4 passed (4)
Tests 36 passed (36)
Duration 30.55s
```

Final focused regression run after the policy fix and added case:

```
npm run test -- tests/content/questiedb.test.ts
Test Files 1 passed (1)
Tests 8 passed (8)
Duration 43.54s
```

Coverage includes all used correction layers, nil holes, masks above32bits,
normalized atomic equality, every shape's add/duplicate/remove/empty operation,
conflicts/malformed values, complete-value grouping, unknown functional operations
after byte admission, byte tampering, both faction/class selection mechanisms,
source-only graph gaps, health placeholders, deterministic bytes, staging checksums,
corrupt existing packages and unchanged pointers on failure. The same corrected
inputs yield identical normalized fingerprints and package bytes. Tests parse all
providers; selected-output tests avoid repeating normalization of all46954 records.
The frozen CLI separately processes the entire admitted source snapshot.

`npm run typecheck` passed. Test output has no application warnings or unhandled
errors; npm emits the pre-existing environment warning about unknown `http-proxy`.
`git diff --cached --check` passed. Sites starter/hosting files are unchanged.

## Changed files

- tools/content/questiedb.ts: public adapter, real provider inventory/order, source evidence, localization and complete source-reference diagnostics.
- tools/content/questiedb-lua.ts: closed structural data reader (controller-approved helper).
- tools/content/questiedb-patch.ts: shape-aware operation engine (controller-approved helper).
- tools/content/questiedb-corrections.json: versioned supported semantics and explicit limits.
- tools/content/{cli,diff,package}.ts: frozen CLI, content diff, staged validated source/runtime-distinct packages.
- src/domain/content.ts: central build-context/dependency/reference contracts, retaining the existing entity union.
- src/content/provenance.ts: known Questie evidence fields and explicit exclusion from automatic gameplay materialization.
- tools/content/normalize.ts: source-only evidence-field selection and indexed lock lookup; existing contracts preserved.
- tests/content/questiedb.test.ts and tests/fixtures/content/questiedb/: behavioral regressions and independently sourced literals.
- content/sources/lock.json and seven vendor files: exact new source admission.
- package.json/pnpm-lock.yaml: import script and exact tsx4.22.1 dev dependency, installed offline from the existing store.
- this report.

## Self-review and limitations

Self-review corrected raw Quest465's initial overly narrow fixture assertion from
its locked raw literal: object1609 must remain before added630696. The implementation
already preserved the original. Further review caught empty-list normalization,
direct-write annotations, full German lookup payloads, strict skipped-row validation
and explicit-deletion noOverwrites behavior; each is covered by focused regressions.

An initial tsx executable invocation hit the sandbox's Unix socket restriction.
The supported `node --import tsx` invocation avoids its CLI IPC server and succeeds
without escalation or permission changes.

No unresolved implementation blocker. The intentional limits are source partiality,
external-domain graph targets, persona-specific dynamic composition, absent gameplay
magnitudes, unnormalized support gameplay semantics, and large reproducible build-only
evidence. The generated package is approximately340MB, ignored under outputs/ and
not committed. This is not a runtime bundle; T05 should select/translate a small
closed packet. Source/raw imports must never be used as a playable-count claim.

## Frozen CLI transcript

Command (default explicit output persona: Alliance/WARRIOR):

```
npm run content:import -- --snapshot FOR-IDLE-2026-10-21-PUBLIC --frozen
```

Exact final transcript and repeat-verification result follow.

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> site-creator-vinext-starter@0.1.0 content:import
> node --import tsx tools/content/cli.ts --snapshot FOR-IDLE-2026-10-21-PUBLIC --frozen

{
  "snapshot": "FOR-IDLE-2026-10-21-PUBLIC",
  "frozen": true,
  "sourceFiles": 58,
  "gameplayReady": false,
  "references": {
    "total": 301487,
    "missingEntities": 408,
    "externalDomains": 53104
  },
  "persona": {
    "faction": "Alliance",
    "playerClass": "WARRIOR"
  },
  "importFingerprint": "d4e90de63dd49a508f75b0641741990ea53dbe631311e2d4d83018e07977bef3",
  "captured": 46954,
  "expectedCount": null,
  "complete": false,
  "playable": 0,
  "layers": 26,
  "contents": [
    {
      "path": "item.json",
      "kind": "item",
      "sha256": "e6b763047f573f8fe51ec0e70fd8ce03244a863f0f4a0ecdcd036007c7b2191f",
      "bytes": 120274236,
      "count": 21294
    },
    {
      "path": "npc.json",
      "kind": "npc",
      "sha256": "7634cbc8613224de4d5a94483e4c6ffce31b542310f1aca942d32e9e2f49c076",
      "bytes": 98755121,
      "count": 13393
    },
    {
      "path": "object.json",
      "kind": "object",
      "sha256": "7350164e020b57f72299c2ce5de6a89752a6367db5e836ba4953f1df52440dbb",
      "bytes": 31590557,
      "count": 7035
    },
    {
      "path": "quest.json",
      "kind": "quest",
      "sha256": "1d25537111e487b1f4ac7bac3c89c41d6fc6b2db5c92b045e1c294aab460ee8a",
      "bytes": 44770569,
      "count": 5232
    },
    {
      "path": "source-references.json",
      "kind": "source-references",
      "sha256": "35dd00696a469091a09771d9236b32c9207d6a723a15875f82031970f0d86bc2",
      "bytes": 44437543,
      "count": 301487
    }
  ],
  "directory": "outputs/content/questiedb/a79f42eb71cbae38d3fcccadac7019bbba095c44aca020ce12ed3f7e403e8712",
  "limitations": [
    "Source database is incomplete; denominator stays null.",
    "No NPC health is converted into combat stats.",
    "Map-percent spawns are not world coordinates.",
    "DropTables/classicItemDrops.lua is a sample questdrop source, not full Forever loot.",
    "Dynamic output belongs to the specified faction/class persona.",
    "No gameplay availability or playable status inferred from a source record.",
    "Absent numeric fields stay missing evidence; upstream getter default zero is not imported as gameplay knowledge.",
    "Source references and prerequisite groups are retained with gaps, not translated into executable gameplay relationships."
  ]
}
```

The final post-policy-fix frozen command exited0. Its complete JSON output is identical
to the preceding full run, including all entity/reference partition hashes and
manifest directory. This also proves complete-snapshot byte determinism; existing
package checksums were revalidated before the evidence pointer was retained.

Exact output directory:
`/workspace/sites/wow-forever-idle/outputs/content/questiedb/a79f42eb71cbae38d3fcccadac7019bbba095c44aca020ce12ed3f7e403e8712`

Manifest SHA256/package ID: `a79f42eb71cbae38d3fcccadac7019bbba095c44aca020ce12ed3f7e403e8712`.
`outputs/content/questiedb/evidence-active.json` exists;
`outputs/content/questiedb/active.json` does not exist.

Final `npm run typecheck` exited0 after the policy regression fix.


## Review fix round 1 — source graph admission and authored Dynamic fixtures

Base: `5389e54`. Both Important findings are addressed without changing vendor bytes
or correction semantics. No extra helpers, runtime imports, or gameplay activation
were introduced.

`questieReferenceGraph` now derives typed edges from the selected normalized evidence.
Every outgoing source reference is retained; an otherwise captured target omitted from
a selected package is explicitly `missing-entity` in that package. Origins and selected
annotations are scoped to the selection. Full imports continue to retain every source
reference, including unresolved targets and external domains, with group/slot selectors.

Before creating a staging directory, `packageCatalog` reconstructs the complete expected
source graph from fingerprint-checked packaged entities and compares every edge. This
rejects nonexistent origins, false captured targets, incorrect resolution, ID/type/field/
selector mismatches, omitted edges and duplicates. It cannot issue a validated evidence
pointer for a caller-supplied inconsistent graph. The malformed-graph regression verifies
both the existing pointer and directory listing remain unchanged for all ten mutations;
a valid missing-target package remains admissible as partial evidence and retains its edge.

The authored Dynamic fixture independently transcribes quest78124's Horde and Alliance
`LoadDynamic()` rows from locked `foreverQuestFixes.lua` (2449–2454 and 2713–2718), with
UNDERCITY1497/STORMWIND_CITY1519 resolved from the locked enum. Assertions cover exact
starters, finishers, objective text and zone. The Horde assertion also verifies the prior
Static two-NPC starter value, Dynamic provider reason and source selector. These are
literal source expectations, not snapshots generated by the adapter. Vendor source bytes
and the source lock are unchanged.

### Focused RED/GREEN and typecheck

RED command (before production edits):

```sh
npm test -- tests/content/questiedb.test.ts -t 'validates every source reference|appliesCorrectionsInDocumentedOrder'
```

Observed exit1, 2 failed / 8 skipped, 10.69s. The selected-origin assertion received false;
the malformed edge from `forever:item:999999` was incorrectly accepted instead of throwing.
This directly reproduced both graph failure modes.

GREEN command:

```sh
npm test -- tests/content/questiedb.test.ts
```

Observed exit0, 1 test file / 10 tests passed, 52.19s. Coverage includes the graph mutation
matrix and pointer preservation, partial source admission, selected import scoping,
independent authored Dynamic fields for both factions, and all previous adapter cases.

```sh
npm run typecheck
```

Observed exit0 (`tsc --noEmit`). The environmental npm `http-proxy` warning was left alone.
No repeated full suite was needed for this focused review round.

### Self-review and scope

Reviewed the complete diff and ran `git diff --check` successfully. Changed files:
`tools/content/questiedb.ts`, `tools/content/package.ts`,
`tests/content/questiedb.test.ts`, fixture `expected.json`/`README.md`, and this report.
The only production graph semantic change is selected-package scope and honest target
resolution; full-snapshot data is expected to remain byte-identical. Validation is
build-time, before partition serialization or staging. Rich source relationships still
do not claim executable gameplay relationships, complete knowledge, or playable status.
The new validator uses the same explicit typed-field mapping as the importer, but derives
expected edges from normalized field evidence instead of trusting supplied edge labels.

### Full frozen integration through the new validator

After focused GREEN, ran exactly once:

```sh
npm run content:import -- --snapshot FOR-IDLE-2026-10-21-PUBLIC --frozen
```

Observed exit0. The complete JSON output was compared with the prior verified frozen
run and is identical, including all five partition hashes and the package directory.
All 301,487 real source edges passed the new evidence-derived graph validation; none
were omitted. The unchanged counts are 247,975 captured targets, 408 missing entities,
and 53,104 external-domain references. No gameplay activation pointer was created.
The already-existing artifact checksums were revalidated before retaining its evidence
pointer. No second frozen run was needed. Exact output:

```json
{
  "snapshot": "FOR-IDLE-2026-10-21-PUBLIC",
  "frozen": true,
  "sourceFiles": 58,
  "gameplayReady": false,
  "references": {
    "total": 301487,
    "missingEntities": 408,
    "externalDomains": 53104
  },
  "persona": {
    "faction": "Alliance",
    "playerClass": "WARRIOR"
  },
  "importFingerprint": "d4e90de63dd49a508f75b0641741990ea53dbe631311e2d4d83018e07977bef3",
  "captured": 46954,
  "expectedCount": null,
  "complete": false,
  "playable": 0,
  "layers": 26,
  "contents": [
    {
      "path": "item.json",
      "kind": "item",
      "sha256": "e6b763047f573f8fe51ec0e70fd8ce03244a863f0f4a0ecdcd036007c7b2191f",
      "bytes": 120274236,
      "count": 21294
    },
    {
      "path": "npc.json",
      "kind": "npc",
      "sha256": "7634cbc8613224de4d5a94483e4c6ffce31b542310f1aca942d32e9e2f49c076",
      "bytes": 98755121,
      "count": 13393
    },
    {
      "path": "object.json",
      "kind": "object",
      "sha256": "7350164e020b57f72299c2ce5de6a89752a6367db5e836ba4953f1df52440dbb",
      "bytes": 31590557,
      "count": 7035
    },
    {
      "path": "quest.json",
      "kind": "quest",
      "sha256": "1d25537111e487b1f4ac7bac3c89c41d6fc6b2db5c92b045e1c294aab460ee8a",
      "bytes": 44770569,
      "count": 5232
    },
    {
      "path": "source-references.json",
      "kind": "source-references",
      "sha256": "35dd00696a469091a09771d9236b32c9207d6a723a15875f82031970f0d86bc2",
      "bytes": 44437543,
      "count": 301487
    }
  ],
  "directory": "outputs/content/questiedb/a79f42eb71cbae38d3fcccadac7019bbba095c44aca020ce12ed3f7e403e8712",
  "limitations": [
    "Source database is incomplete; denominator stays null.",
    "No NPC health is converted into combat stats.",
    "Map-percent spawns are not world coordinates.",
    "DropTables/classicItemDrops.lua is a sample questdrop source, not full Forever loot.",
    "Dynamic output belongs to the specified faction/class persona.",
    "No gameplay availability or playable status inferred from a source record.",
    "Absent numeric fields stay missing evidence; upstream getter default zero is not imported as gameplay knowledge.",
    "Source references and prerequisite groups are retained with gaps, not translated into executable gameplay relationships."
  ]
}
```


## Review fix round 2 — require context for normalized Questie evidence

Base: `d493718`. The remaining bypass was real: optional `buildContext` allowed a caller
to omit the source graph entirely and still package normalized Questie evidence with zero
reported references. A narrow admission guard now requires source-evidence graph context
whenever normalized candidate/correction dependencies include `questiedb`. This checks
actual field provenance, including identity fields, before staging. Unrelated normalized
catalogs keep their context-optional path; a compatibility assertion covers that path.

The regression directly omits context from both `packageCatalog` and
`writeCatalogPackage`, requires rejection, and verifies the evidence pointer and output
directory remain unchanged. It also rejects an identity-only Questie entity without
context even though that entity has no outgoing references. Existing deterministic
package/checksum tests now preserve the actual parsed context and all 13 selected
entities rather than silently slicing entities and discarding their graph context.
The malformed-edge and partial-graph regressions from round1 remain intact.

### RED/GREEN evidence

Before the production guard, ran:

```sh
npm test -- tests/content/questiedb.test.ts -t 'validates every source reference'
```

Observed exit1, 1 failed / 9 skipped, 707ms. The direct omitted-context call to
`packageCatalog` did not throw. After the guard, ran:

```sh
npm test -- tests/content/questiedb.test.ts
npm run typecheck
```

Observed exit0 for both commands. Focused output:

```text
✓ tests/content/questiedb.test.ts (10 tests) 52246ms
Test Files  1 passed (1)
     Tests  10 passed (10)
  Duration  53.51s
```

Typecheck output: `tsc --noEmit`, exit0. The npm proxy warning remains environmental;
host configuration was not changed.

### Self-review, verification boundary and downstream contract

Reviewed the complete diff; `git diff --check` passes. Changed only
`tools/content/package.ts`, `tests/content/questiedb.test.ts`, and this report.
The production change is one provenance-based admission guard; source extraction,
reference derivation, graph comparison, vendor bytes and output serialization are
unchanged. The focused tests exercise valid admission with actual parsed contexts,
omitted-context rejection, pointer preservation and unrelated generic catalogs.
The controller agreed no extra full frozen run is needed in this round: round1 already
validated all 301,487 edges, and the new guard has no size-dependent graph behavior.
No repeated full suite was run.

Downstream T05 contract: normalized records carrying Questie dependencies require a
`buildContext` even when they contain only identity evidence. The packet builder must
preserve or provide that context honestly, scoped to its packaged entities and retaining
all outgoing references and explicit gaps. Dropping the context cannot be used to
activate a playable package or erase source-reference diagnostics. Authored Dynamic
fixtures from round1 remain unchanged and passed again. No known unaddressed review
finding remains in this round.
