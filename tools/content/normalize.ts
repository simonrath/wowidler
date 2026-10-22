import { createHash } from 'node:crypto';
import { branchSchema, entityKeySchema, entityKindSchema, safeIntSchema } from '../../src/domain/ids';
import type { FieldEvidence, NormalizedEntity, RawEntity, RawFieldCandidate, SourceSelection } from '../../src/domain/content';
import { canonical, contentFields, deepFreeze, identityFields } from '../../src/content/provenance';
import { sourceLockSchema, type SourceLock } from './schema';
export type { RawEntity, NormalizedEntity } from '../../src/domain/content';

export function contentFingerprint(record: Omit<NormalizedEntity, 'fingerprint'>): string {
  return createHash('sha256').update(canonical(record)).digest('hex');
}
export function normalize(records: RawEntity[], inputLock: SourceLock): NormalizedEntity[] {
  const lock = sourceLockSchema.parse(inputLock);
  const lockedFiles = new Map(lock.files.map(file => [`${file.sourceId}:${file.path}`,file]));
  function validateSource(source: SourceSelection, branch: RawEntity['branch']) {
    const file = lockedFiles.get(`${source.sourceId}:${source.path}`);
    if (!file || file.sha256 !== source.sha256 || !file.branches.includes(branch) || !source.selector?.trim()) throw new Error('Field source, hash, branch or selector does not match lock');
    return file;
  }
  const groups = new Map<string, RawEntity[]>();
  for (const record of records) {
    entityKeySchema.parse(record.key); branchSchema.parse(record.branch); entityKindSchema.parse(record.kind); safeIntSchema.parse(record.originalId);
    if (record.key !== `${record.branch}:${record.kind}:${record.originalId}`) throw new Error('Raw identity mismatch');
    validateSource(record.identitySource, record.branch);
    if (Object.keys(record.fields).some(field => !(contentFields as readonly string[]).includes(field))) throw new Error('Unknown content field');
    const group = groups.get(record.key) ?? []; group.push(record); groups.set(record.key, group);
  }
  return [...groups.values()].map(group => {
    const { key, kind, branch, originalId } = group[0];
    const fields: Record<string, FieldEvidence> = {};
    for (const field of [...identityFields, ...contentFields.filter(f => !f.startsWith('questie.') || group.some(r => r.fields[f]))]) {
      const candidates: RawFieldCandidate[] = group.flatMap(r => (identityFields as readonly string[]).includes(field)
        ? [{ value: r[field as keyof typeof r], source: r.identitySource, corrections: [], status: 'verified' as const }]
        : r.fields[field] ?? []).map(c => structuredClone(c));
      const values = new Map<string, unknown>(); let derived = false;
      for (const candidate of candidates) {
        validateSource(candidate.source, branch);
        if (!['verified', 'derived', 'missing'].includes(candidate.status)) throw new Error('Invalid candidate state');
        if (candidate.status === 'missing') {
          if (candidate.value !== undefined || candidate.corrections.length) throw new Error('Missing evidence cannot assert or correct a value');
          continue;
        }
        if (candidate.value === undefined) throw new Error('Verified/derived evidence needs an explicit value');
        let value: unknown = candidate.value;
        canonical(value);
        for (const correction of candidate.corrections) {
          const file = validateSource(correction.source, branch);
          if (!correction.reason.trim() || canonical(correction.before) !== canonical(value)) throw new Error('Broken correction chain');
          canonical(correction.after);
          if (correction.adaptationPath && (!correction.adaptationPath.startsWith('content/adaptations/') || correction.adaptationPath !== file.localPath)) throw new Error('Idle adaptation requires a separately locked content/adaptations file');
          value = correction.after;
        }
        if (candidate.status === 'derived' && !candidate.corrections.some(c => c.adaptationPath)) throw new Error('Derived values require explicit Idle adaptation evidence');
        derived ||= candidate.status === 'derived' || candidate.corrections.some(c => c.adaptationPath);
        values.set(canonical(value), value);
      }
      const status = values.size > 1 ? 'conflicting' : values.size === 0 ? 'missing' : derived ? 'derived' : 'verified';
      fields[field] = { status, candidates, ...(values.size === 1 ? { value: [...values.values()][0] } : {}) };
    }
    const record = { key, kind, branch, originalId, normalized: true as const, snapshotId: lock.snapshotId, fields };
    return deepFreeze({ ...record, fingerprint: contentFingerprint(record) });
  });
}
