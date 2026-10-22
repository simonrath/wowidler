# Task 1 implementation report

Status: domain foundation complete; product remains unplayed starter.

## Scope and implementation

- Shared domain modules define branch-qualified content keys, catalog contracts, source/version metadata, availability/data maturity/implementation as distinct fields, snapshot coverage denominators (including unknown `null`), explicit combat values, and catalog-driven race/class/faction/start-location combinations.
- Persistent character state includes inventory ownership/equipment, quests, rewards, spells/cooldowns/talents, professions/reputation, rules and activity plans. Only the profile active character may hold an activity; encounter character actors must reference it.
- Checkpoint parsing rejects nonfinite/fractional times, invalid RNG words, duplicate/past scheduled events and reused next sequence values. Snapshot owner must match profile owner; schema version is explicit.
- Discriminated commands/events and readonly display projections have runtime schemas. Normal rule/plan caps are12/10. No browser globals are needed.
- Test factories are intentionally synthetic, with no claimed original source data. The approved PDF and plan were already copied in baseline and remain unchanged. Added `docs/superpowers/progress.md`.
- Starter scripts preserved. Supported helper bootstrapped pnpm11.25.0, then installed Vitest/jsdom/Three.js/types. The initial helper attempt refused edited starter inputs before installation; restored exact starter manifest, completed bootstrap, regenerated lockfile inputs, then the helper completed successfully. Exactly one installer ran at a time. Added test/typecheck scripts and casing check. No hosting identity changes.

## RED evidence (before production modules existed)

Command: `npm run test -- tests/domain/contracts.test.ts`.
Expected missing domain export/module observed at13:57:13. The brief explicitly permits this initial missing-export RED. Output:

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> site-creator-vinext-starter@0.1.0 test
> vitest run tests/domain/contracts.test.ts


 RUN  v3.2.7 /workspace/sites/wow-forever-idle


⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |domain| tests/domain/contracts.test.ts [ tests/domain/contracts.test.ts ]
Error: Cannot find module '../../src/domain/ids' imported from '/workspace/sites/wow-forever-idle/tests/domain/contracts.test.ts'
 ❯ tests/domain/contracts.test.ts:2:1
      1| import { describe, expect, it } from 'vitest';
      2| import { entityKeySchema } from '../../src/domain/ids';
       | ^
      3| import { entitySchema, characterCreationSchema, snapshotSpecSchema } f…
      4| import { parseCheckpoint, parseProfileSnapshot, profileStateSchema } f…

Caused by: Error: Failed to load url ../../src/domain/ids (resolved id: ../../src/domain/ids) in /workspace/sites/wow-forever-idle/tests/domain/contracts.test.ts. Does the file exist?
 ❯ loadAndTransform node_modules/.pnpm/vite@7.3.7_@types+node@22.19.19_jiti@2.7.0_lightningcss@1.32.0_terser@5.47.1_tsx@4.22.1/node_modules/vite/dist/node/chunks/config.js:22907:33

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  no tests
   Start at  13:57:13
   Duration  448ms (transform 64ms, setup 0ms, collect 0ms, tests 0ms, environment 0ms, prepare 156ms)

```

## GREEN initial implementation

Implemented domain models, validators and neutral factories after RED. Focused suite passed6/6 and `npm run typecheck` exited0. Output:

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> site-creator-vinext-starter@0.1.0 test
> vitest run tests/domain/contracts.test.ts


 RUN  v3.2.7 /workspace/sites/wow-forever-idle

 ✓ |domain| tests/domain/contracts.test.ts (6 tests) 18ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  13:59:35
   Duration  556ms (transform 137ms, setup 0ms, collect 177ms, tests 18ms, environment 0ms, prepare 97ms)

```

## Self-review regression RED

Self-review added assertions that combat use cannot silently omit combat values and that view projections have a strict runtime schema. Both failed before those changes: one assertion returned true instead of false; gameViewSchema was absent. Output:

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> site-creator-vinext-starter@0.1.0 test
> vitest run tests/domain/contracts.test.ts


 RUN  v3.2.7 /workspace/sites/wow-forever-idle

 ❯ |domain| tests/domain/contracts.test.ts (7 tests | 2 failed) 22ms
   ✓ domain contracts > rejectsInvalidDomainStates 7ms
   ✓ domain contracts > separates branch namespaces and rejects malformed keys 1ms
   × domain contracts > requires sourced versioned playable catalog content 8ms
     → expected true to be false // Object.is equality
   ✓ domain contracts > validates exact race class faction relationships from content 1ms
   ✓ domain contracts > enforces profile ownership, active character membership and actor references 2ms
   × domain contracts > validates display projections without persistent writable state 1ms
     → Cannot read properties of undefined (reading 'safeParse')
   ✓ domain contracts > bounds commands and scheduled simulation payloads 2ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |domain| tests/domain/contracts.test.ts > domain contracts > requires sourced versioned playable catalog content
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ tests/domain/contracts.test.ts:39:78
     37|     expect(catalog.requirePlayable('forever:npc:999').ok).toBe(false);
     38|     expect(entitySchema.safeParse({ ...entity, sources: [] }).success)…
     39|     expect(entitySchema.safeParse({ ...entity, combat: undefined }).su…
       |                                                                              ^
     40|     expect(entitySchema.safeParse({ ...entity, branch: 'era' }).succes…
     41|     expect(() => makeCatalog([entity, entity])).toThrow(/duplicate/i);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  |domain| tests/domain/contracts.test.ts > domain contracts > validates display projections without persistent writable state
TypeError: Cannot read properties of undefined (reading 'safeParse')
 ❯ tests/domain/contracts.test.ts:61:27
     59|   it('validates display projections without persistent writable state'…
     60|     const view = { profileId: 'p', revision: 0, simMs: 0, activeCharac…
     61|     expect(gameViewSchema.safeParse(view).success).toBe(true);
       |                           ^
     62|     expect(gameViewSchema.safeParse({ ...view, revision: -1 }).success…
     63|     expect(gameViewSchema.safeParse({ ...view, state: makeState() }).s…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯


 Test Files  1 failed (1)
      Tests  2 failed | 5 passed (7)
   Start at  14:00:09
   Duration  612ms (transform 115ms, setup 0ms, collect 149ms, tests 22ms, environment 0ms, prepare 147ms)

```

## Final GREEN verification

After adding the explicit combat-use requirement and strict readonly view schemas, ran the full project suite (not only the focused file):

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> site-creator-vinext-starter@0.1.0 test
> vitest run


 RUN  v3.2.7 /workspace/sites/wow-forever-idle

 ✓ |domain| tests/domain/contracts.test.ts (7 tests) 25ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  14:00:40
   Duration  643ms (transform 146ms, setup 0ms, collect 202ms, tests 25ms, environment 0ms, prepare 170ms)

```

Typecheck completed with exit0:

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> site-creator-vinext-starter@0.1.0 typecheck
> tsc --noEmit

```

## Self-review and limits

Reviewed task brief, own diff, package inputs, lockfile, command/event forms, authoritative creation note and fixture source labeling. No `any` escape hatch, browser dependency, hidden combat fallback, duplicate frontend state model, or hosting change was introduced. Source and plan were already present in root baseline. Node test imports prove domain imports without browser access. npm emits an environment-level unknown http-proxy warning; no test/compiler failure. Existing installer emits harmless optional foreign-platform package notices.

Future tasks must add actual content adapters and corresponding field-specific schemas, simulation behavior, command authorization/lease enforcement, UI, build and browser verification. This task does not claim original content coverage or a playable product. No external blocker remains.
