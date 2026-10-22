/** Node-only build-time coverage computation. UI consumes the serialized CoverageReport. */
import { z } from 'zod';
import type { Catalog, CatalogEntry, CategoryCoverage, CoverageReport, TestEvidence } from '../domain/content';
import { entityKeySchema } from '../domain/ids';
import type { Validation } from '../domain/result';
import { referenceInventorySchema, type ReferenceInventory } from '../../tools/content/schema';
import { isNormalized, materialize } from './provenance';
import { isCurrentExecutedEvidence } from '../../tools/content/test-evidence';
import { requirePlayable } from './capabilities';
export type { CoverageReport, TestEvidence } from '../domain/content';

function connected(entry: CatalogEntry, catalog: Catalog): boolean {
  if (isNormalized(entry) && ['relationships', 'prerequisites', 'position.locationKey', 'position.x', 'position.y', 'position.z'].some(field => entry.fields[field]?.status === 'conflicting' || (entry.fields[field]?.status === 'missing' && entry.fields[field].candidates.length > 0))) return false;
  const data = isNormalized(entry) ? materialize(entry) : entry;
  const refs = z.array(entityKeySchema).safeParse(data.relationships);
  const prerequisites = z.array(entityKeySchema).safeParse(data.prerequisites ?? []);
  if (!refs.success || !prerequisites.success) return false;
  const position = data.position as { locationKey?: unknown } | undefined;
  const location = position ? entityKeySchema.safeParse(position.locationKey) : undefined;
  if (location && !location.success) return false;
  return [...refs.data, ...prerequisites.data, ...(location?.success ? [location.data] : [])].every(key => key.startsWith(`${entry.branch}:`) && catalog.get(key) !== undefined);
}
function executed(entry: CatalogEntry, evidence: TestEvidence[]): boolean {
  return isNormalized(entry) && evidence.some(e => e.key === entry.key && e.fingerprint === entry.fingerprint && e.status === 'passed'
    && /^tests\/.+\.[cm]?[jt]sx?$/.test(e.testFile) && /^[a-f0-9]{64}$/.test(e.testFileSha256)
    && !!e.testCase.trim() && !!e.runId.trim() && Number.isFinite(Date.parse(e.executedAt)) && isCurrentExecutedEvidence(e));
}
/** Numerators are intersections with independently enumerated keys, never substitute row counts. */
export function buildCoverage(input: ReferenceInventory, catalog: Catalog, evidence: TestEvidence[]): CoverageReport {
  const inventory = referenceInventorySchema.parse(input);
  const eligible = catalog.entities.filter(entry => !isNormalized(entry) || entry.snapshotId === inventory.snapshotId);
  const byKey = new Map(eligible.map(entry => [entry.key, entry]));
  const scopedCatalog: Catalog = { ...catalog, entities: eligible, get: key => byKey.get(key) };
  const categories: Record<string, CategoryCoverage> = {}; const gaps: CoverageReport['gaps'] = [];
  for (const [name, spec] of Object.entries(inventory.categories)) {
    const keys = spec.requiredKeys; const membershipKnown = spec.denominatorStatus === 'independent-complete' && keys !== undefined;
    const entries = membershipKnown ? keys.map(key => byKey.get(key)).filter((e): e is CatalogEntry => !!e)
      : eligible.filter(e => e.branch === inventory.branch && e.kind === spec.kind);
    const missingKeys = keys?.filter(key => !byKey.has(key)) ?? [];
    const linked = entries.filter(e => connected(e, scopedCatalog));
    const playable = linked.filter(e => requirePlayable(e).ok);
    categories[name] = { kind: spec.kind, included: spec.included, expectedCount: spec.expectedCount, denominatorStatus: spec.denominatorStatus,
      membershipKnown, captured: entries.length, connected: linked.length, playable: playable.length, tested: playable.filter(e => executed(e, evidence)).length,
      percent: membershipKnown ? (keys.length ? entries.length / keys.length * 100 : 100) : null, missingKeys };
    if (spec.included && !membershipKnown) gaps.push({ id: `coverage-denominator-${name}`, category: spec.kind, reason: spec.expectedCount === null ? 'Independent reference denominator unknown.' : 'Independent count is known; authoritative original-ID bindings are missing.' });
    for (const key of missingKeys) gaps.push({ id: `coverage-missing-${key}`, category: spec.kind, key, reason: 'Required reference entity is not captured.' });
    for (const entry of entries) {
      if (!linked.includes(entry)) gaps.push({ id: `coverage-unconnected-${entry.key}`, category: spec.kind, key: entry.key, reason: 'Reference fields are incomplete or unresolved.' });
      else if (!playable.includes(entry)) gaps.push({ id: `coverage-unplayable-${entry.key}`, category: spec.kind, key: entry.key, reason: 'Entity lacks verified required data, availability or implementation.' });
      else if (!executed(entry, evidence)) gaps.push({ id: `coverage-untested-${entry.key}`, category: spec.kind, key: entry.key, reason: 'No successful named content check for this fingerprint.' });
    }
  }
  const required = Object.values(categories).filter(c => c.included);
  const known = required.length > 0 && required.every(c => c.membershipKnown);
  const expected = required.reduce((sum, c) => sum + (c.expectedCount ?? 0), 0);
  return { snapshotId: inventory.snapshotId, categories, complete: known && required.every(c => c.tested === c.expectedCount),
    percent: known ? (expected ? required.reduce((sum, c) => sum + c.captured, 0) / expected * 100 : 100) : null, gaps };
}
/** Exclusion removals or changed boundaries require an explicit change-level rationale. */
export function validateExclusionChange(before: ReferenceInventory, after: ReferenceInventory, changeReason?: string): Validation {
  const parsed = referenceInventorySchema.safeParse(after);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map(({ path, message }) => ({ path, message })) };
  const issues: { path: string[]; message: string }[] = [];
  for (const [name, old] of Object.entries(before.categories)) {
    const next = after.categories[name];
    const reduced = next && ((old.included && !next.included)
      || (old.denominatorStatus === 'independent-complete' && next.denominatorStatus !== old.denominatorStatus)
      || (old.expectedCount !== null && (next.expectedCount === null || next.expectedCount < old.expectedCount))
      || old.requiredKeys?.some(key => !next.requiredKeys?.includes(key)));
    const freshReason = next && (next.reason.trim() !== old.reason.trim() || (!!changeReason?.trim() && changeReason.trim() !== old.reason.trim()));
    if (reduced && !freshReason) issues.push({ path: ['categories', name], message: 'Scope exclusion change requires a new reason' });
  }
  if (before.exclusions.some(old => !after.exclusions.some(next => next.id === old.id)) && !changeReason?.trim()) issues.push({ path: ['exclusions'], message: 'Removing an exclusion requires a change reason' });
  return issues.length ? { ok: false, issues } : { ok: true };
}
