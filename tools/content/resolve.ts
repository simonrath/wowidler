import { z } from 'zod';
import type { Catalog, NormalizedEntity } from '../../src/domain/content';
import { entityKeySchema, keyOfKind, type EntityKey } from '../../src/domain/ids';
import type { Issue, Result } from '../../src/domain/result';
import { deepFreeze, materialize, positionFields } from '../../src/content/provenance';
import { requirePlayable } from '../../src/content/capabilities';
import { contentFingerprint } from './normalize';

/** Reference faults reject resolution; honest missing scalar data stays captured but unplayable. */
export function resolveReferences(records: NormalizedEntity[]): Result<Catalog> {
  const map = new Map<EntityKey, NormalizedEntity>(); const issues: Issue[] = [];
  const add = (key: string, field: string, message: string) => issues.push({ path: [key, field], message });
  if (new Set(records.map(record => record.snapshotId)).size > 1) add('catalog', 'snapshotId', 'A catalog must use one reference snapshot');
  for (const record of records) {
    if (map.has(record.key)) add(record.key, 'key', 'Duplicate normalized key');
    const { fingerprint, ...payload } = record;
    if (fingerprint !== contentFingerprint(payload)) add(record.key, 'fingerprint', 'Normalized evidence changed after fingerprinting');
    map.set(record.key, deepFreeze(structuredClone(record)));
  }
  const prerequisites = new Map<EntityKey, EntityKey[]>();
  for (const record of map.values()) {
    const data = materialize(record);
    for (const field of ['relationships', 'prerequisites']) {
      if (data[field] === undefined) continue;
      const parsed = z.array(entityKeySchema).safeParse(data[field]);
      if (!parsed.success) { add(record.key, field, 'Invalid reference list'); continue; }
      for (const target of parsed.data) {
        if (!map.has(target)) add(record.key, field, `Missing reference: ${target}`);
        if (!target.startsWith(`${record.branch}:`)) add(record.key, field, `Cross-branch reference: ${target}`);
      }
      if (field === 'prerequisites') prerequisites.set(record.key, parsed.data);
    }
    if (positionFields.some(field => record.fields[field]?.candidates.length > 0)) {
      const parsed = z.object({ locationKey: keyOfKind('location'), x: z.number().finite(), y: z.number().finite(), z: z.number().finite() }).strict().safeParse(data.position);
      if (!parsed.success) add(record.key, 'position', 'Coordinates need an explicit location and three finite world coordinates');
      else if (!map.has(parsed.data.locationKey) || !parsed.data.locationKey.startsWith(`${record.branch}:`)) add(record.key, 'position', 'Missing or cross-branch coordinate location');
    }
  }
  // Iterative DFS avoids stack limits on real prerequisite chains.
  const state = new Map<EntityKey, 'visiting' | 'done'>();
  for (const key of map.keys()) {
    if (state.has(key)) continue;
    const stack: { key: EntityKey; exit: boolean }[] = [{ key, exit: false }];
    while (stack.length) {
      const node = stack.pop()!;
      if (node.exit) { state.set(node.key, 'done'); continue; }
      if (state.get(node.key) === 'visiting') { add(node.key, 'prerequisites', 'Prerequisite cycle'); continue; }
      if (state.get(node.key) === 'done') continue;
      state.set(node.key, 'visiting'); stack.push({ key: node.key, exit: true });
      for (const target of prerequisites.get(node.key) ?? []) stack.push({ key: target, exit: false });
    }
  }
  if (issues.length) return { ok: false, error: { code: 'invalid', message: 'Content reference resolution failed', issues } };
  const entities = Object.freeze([...map.values()]);
  return { ok: true, value: { entities, get: key => map.get(key), requirePlayable(key) {
    const entry = map.get(key);
    return entry ? requirePlayable(entry) : { ok: false, error: { code: 'missing-content', message: `Missing entity: ${key}` } };
  } } };
}
