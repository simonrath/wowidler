# T06 — Deterministic simulation core

Status: DONE. Scope is the simulation foundation; combat remains T07. The existing UI and starter integration were preserved.

## Implementation

- Added browser-safe integer-time scheduling ordered by timestamp, persisted/derived phase, then monotonically increasing sequence. Legacy events without a phase normalize by an explicit exhaustive event-type mapping.
- Added action ownership via optional `actionId`; cancellation removes matching pending events without consuming randomness or reusing sequences.
- Implemented xoshiro128** with persisted four-word state and unbiased inclusive integer sampling.
- Implemented `createAdvance(dispatch)` as the explicit synchronous gameplay extension boundary. The requested exported `advance` fails closed with `unhandled-event` until T07 composes actual handlers. Empty time advances are functional. No invented combat formulas or gameplay claims were added.
- Timestamp blocks commit atomically. Yield callbacks run only before blocks, `maxEvents` is a soft boundary, and zero-time blocks are limited to 10,000 processed events. A failing block rolls back all state/RNG/queue/sequence changes; earlier valid timestamps remain committed.
- Added structured diagnostics for zero-time exhaustion, unknown handlers, invalid scheduling/checkpoints, and reducer errors. Invalid invocation inputs fail before processing. Advance duration is capped at 86,400,000 ms.
- Added validated canonical UTF-8 JSON serialization/deserialization and FNV-1a-64 comparison fingerprints. This hash is explicitly not a security/authenticity primitive.
- Added a German rulebook describing phase order, simultaneous hits, migration, cancellation, budgets, diagnostics, random draw rules, and future handler integration.

## Architecture ruling

Raised focused alternatives with the controller before implementation. Controller approved atomic timestamp blocks and soft event budgets over persisted open-block transaction state, plus pure dependency-injected dispatch with a fail-closed exported default. The fixed guard bounds event count, not wall-clock duration. Hard latency guarantees require later performance evidence and potentially a versioned open-block continuation design.

Phase ordering is monotonic within a timestamp. Decisions cannot schedule earlier-phase effects at that same time. T07 should represent already scheduled direct hits as effects and schedule new earlier-phase effects at a later timestamp. Controller acknowledged this integration constraint.

## TDD evidence and verification

1. **RED**, before implementation:
   - Command: `npm run test -- tests/simulation/determinism.test.ts`
   - Exit 1: `Cannot find module '../../src/game/simulation/advance'`.
   - One suite failed with no collected tests, as expected because the required simulation modules did not exist.
2. **GREEN**, after initial implementation:
   - Same command: 10/10 tests passed.
3. Added a synthetic simultaneous-lethal-hit state transition test (both actors reach zero health before death resolution): focused suite 11/11 passed.
4. Full suite, run once: `npm run test` — **7/7 files, 87/87 tests passed**, duration 60.67 s. Existing slow content-import tests completed successfully.
5. `npm run typecheck` initially caught a test-only discriminated-union narrowing issue inside an array callback. Captured `targetId` before the callback; no runtime implementation change was necessary.
6. Final verification: `npm run typecheck && npm run test -- tests/simulation/determinism.test.ts` — exit 0, TypeScript clean, 11/11 focused tests passed.
7. `git diff --cached --check` — clean.

Coverage includes long vs sliced execution across varied budgets with serialization resumes, input immutability, all five same-time phases and sequence ties, actual synthetic simultaneous lethal effects before death resolution, cancellation both outside/inside transactions, zero-time rollback preserving prior committed timestamps, yield boundaries, unsupported handlers, exceptions, phase regression, integer time/budget/range validation, sequence overflow, RNG reference vector, forbidden ambient random/clock use, canonical object/queue ordering, legacy phase normalization, and roundtrip byte stability.

## Files

- `src/domain/events.ts`
- `src/domain/state.ts`
- `src/game/simulation/queue.ts`
- `src/game/simulation/random.ts`
- `src/game/simulation/advance.ts`
- `src/game/simulation/serialization.ts`
- `tests/simulation/determinism.test.ts`
- `docs/rulebook/time-and-random.md`
- This report.

## Self-review

Read the staged implementation diff and checked all scope requirements. No Node-only catalog/coverage modules, global handler registries, wall-clock reads, ambient RNG, UI modifications, or external retrieval were introduced. Phase migration is backward compatible with existing domain fixtures. Timestamp rollback includes RNG and scheduling changes. The full suite confirms existing content/domain/UI behavior remains intact. Fixed the test-only TypeScript narrowing finding before completion.

The dispatcher contract requires trusted synchronous handlers to mutate only transaction state and use context scheduling/random APIs; this is a composition boundary, not a sandbox for untrusted code. Catalog snapshot/version binding remains the caller's responsibility and is documented.

## Environment and remaining integration

All npm commands print the pre-existing `Unknown env config "http-proxy"` warning. No host or npm configuration changes were made. Test output is otherwise clean.

No unresolved correctness concerns. Approved integration limitations: default event handling remains fail-closed until T07; maxEvents is soft within a timestamp; the 24-hour performance promise is deferred to the planned load test; fingerprints are non-cryptographic. These are documented design decisions, not incomplete T06 gameplay work.
