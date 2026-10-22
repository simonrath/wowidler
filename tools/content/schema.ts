import { z } from 'zod';
import { branchSchema, entityKeySchema, entityKinds, entityKindSchema, safeIntSchema } from '../../src/domain/ids';
const text = z.string().trim().min(1);
const sha1 = z.string().regex(/^[0-9a-f]{40}$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const relativePath = text.refine(p => !p.startsWith('/') && !p.includes('\\') && p.split('/').every(part => part !== '..' && part !== '.' && part.length > 0), 'Expected safe relative path');
export const sourceSchema = z.object({
  id: text, repository: text.nullable(), commit: sha1.nullable(), branches: z.array(branchSchema).min(1), role: text,
  status: z.enum(['retrieved', 'pinned-unretrieved']), build: text.nullable(), languages: z.array(text), limitations: z.array(text).min(1),
}).strict().superRefine((s, ctx) => {
  if (s.repository !== null && s.commit === null) ctx.addIssue({ code: 'custom', path: ['commit'], message: 'Repository requires immutable commit' });
});
export const sourceFileSchema = z.object({
  sourceId: text, kind: z.enum(['github-file', 'primary-extract', 'authored-file']), commit: sha1.nullable(), blobSha: sha1.nullable(),
  path: text, localPath: relativePath, sha256, bytes: safeIntSchema, branches: z.array(branchSchema).min(1), coveredFields: z.array(text).min(1),
  build: text.nullable(), languages: z.array(text), retrievedVia: text, primaryUrl: z.string().url().nullable(), limitations: z.array(text).min(1),
}).strict().superRefine((f, ctx) => {
  if (f.kind === 'github-file' && (f.commit === null || f.blobSha === null || !relativePath.safeParse(f.path).success)) ctx.addIssue({ code: 'custom', message: 'GitHub file requires exact commit, blob and safe repository path' });
  if (f.kind === 'primary-extract' && (f.primaryUrl === null || f.primaryUrl !== f.path || f.commit !== null || f.blobSha !== null)) ctx.addIssue({ code: 'custom', message: 'Primary extract requires its exact source URL and content hash, without invented Git revision' });
  if (f.kind === 'authored-file' && (f.commit !== null || f.blobSha !== null || f.primaryUrl !== null || f.path !== f.localPath || !relativePath.safeParse(f.path).success || !f.path.startsWith('content/adaptations/'))) ctx.addIssue({ code: 'custom', message: 'Authored rule requires a content-addressed local adaptation file, without invented upstream identity' });
});
export const sourceRegistrySchema = z.object({ version: z.literal(1), snapshotId: text, sources: z.array(sourceSchema).min(1) }).strict();
export const sourceLockSchema = sourceRegistrySchema.extend({ files: z.array(sourceFileSchema).min(1) }).superRefine((lock, ctx) => {
  const sources = new Map(lock.sources.map(s => [s.id, s]));
  if (sources.size !== lock.sources.length) ctx.addIssue({ code: 'custom', path: ['sources'], message: 'Duplicate source ID' });
  const seen = new Set<string>(); const localPaths = new Set<string>();
  lock.files.forEach((f, i) => {
    const s = sources.get(f.sourceId); const key = `${f.sourceId}:${f.path}`;
    if (!s || s.status !== 'retrieved' || s.commit !== f.commit || f.branches.some(b => !s.branches.includes(b))) ctx.addIssue({ code: 'custom', path: ['files', i], message: 'File must match a retrieved source, revision and branch' });
    if (seen.has(key) || localPaths.has(f.localPath)) ctx.addIssue({ code: 'custom', path: ['files', i], message: 'Duplicate source file or local destination' });
    seen.add(key); localPaths.add(f.localPath);
  });
  for (const s of lock.sources) if (s.status === 'retrieved' && !lock.files.some(f => f.sourceId === s.id)) ctx.addIssue({ code: 'custom', path: ['sources'], message: 'Retrieved source requires captured file evidence' });
});
const state = { availability: z.enum(['beta', 'announced', 'unavailable', 'excluded']), dataMaturity: z.enum(['unknown', 'partial', 'verified']), implementation: z.enum(['unsupported', 'partial', 'playable']) };
const categorySchema = z.object({
  kind: entityKindSchema, included: z.boolean(), expectedCount: safeIntSchema.nullable(), denominatorStatus: z.enum(['unknown', 'independent-complete']),
  evidence: z.array(text), requiredKeys: z.array(entityKeySchema).optional(), betaExpectedCount: safeIntSchema.nullable(), announcedExpectedCount: safeIntSchema.nullable(),
  dataMaturity: state.dataMaturity, implementation: state.implementation, reason: text, gapIds: z.array(text),
}).strict().superRefine((c, ctx) => {
  if (c.requiredKeys && (c.denominatorStatus !== 'independent-complete' || c.requiredKeys.length !== c.expectedCount || new Set(c.requiredKeys).size !== c.requiredKeys.length || c.requiredKeys.some(key => key.split(':')[1] !== c.kind))) ctx.addIssue({ code: 'custom', path: ['requiredKeys'], message: 'Independent keys must uniquely enumerate the expected category' });
  if (c.denominatorStatus === 'unknown' && (c.expectedCount !== null || c.betaExpectedCount !== null || c.announcedExpectedCount !== null)) ctx.addIssue({ code: 'custom', message: 'Unknown denominator must remain null' });
  if (c.denominatorStatus === 'independent-complete' && (c.expectedCount === null || c.evidence.length === 0)) ctx.addIssue({ code: 'custom', message: 'Known denominator requires independent evidence' });
});
const combination = z.object({ race: text, faction: z.enum(['Alliance', 'Horde']), class: text, ...state }).strict();
const dungeon = z.object({ name: text, minLevel: safeIntSchema, maxLevel: safeIntSchema, region: text, ...state }).strict().refine(d => d.minLevel <= d.maxLevel, 'Reversed dungeon level range');
const raid = z.object({ name: text, unlockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), raidSize: safeIntSchema.nullable(), bossCount: safeIntSchema.nullable(), ...state }).strict();
const subset = <T extends z.ZodTypeAny>(entry: T) => z.object({ expectedCount: safeIntSchema, evidence: z.array(text).min(1), entries: z.array(entry) }).strict().superRefine((s, ctx) => { if (s.entries.length !== s.expectedCount) ctx.addIssue({ code: 'custom', message: 'Subset count must match independently enumerated entries' }); });
export const referenceInventorySchema = z.object({
  version: z.literal(1), snapshotId: text, branch: z.literal('forever'), referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), denominatorBasis: text,
  categories: z.record(categorySchema), verifiedSubsets: z.object({ raceClassCombinations: subset(combination), newDungeons: subset(dungeon), firstRaids: subset(raid) }).strict(),
  exclusions: z.array(z.object({ id: text, reason: text }).strict()),
}).strict().superRefine((inventory, ctx) => {
  const kinds = Object.values(inventory.categories).map(c => c.kind);
  if (kinds.length !== entityKinds.length || new Set(kinds).size !== entityKinds.length || entityKinds.some(k => !kinds.includes(k))) ctx.addIssue({ code: 'custom', path: ['categories'], message: 'Every content category must appear exactly once' });
  if (Object.values(inventory.categories).some(c => c.requiredKeys?.some(key => !key.startsWith(`${inventory.branch}:`)))) ctx.addIssue({ code: 'custom', path: ['categories'], message: 'Reference keys must belong to snapshot branch' });
  if (new Set(inventory.exclusions.map(e => e.id)).size !== inventory.exclusions.length) ctx.addIssue({ code: 'custom', path: ['exclusions'], message: 'Duplicate exclusion' });
  const combos = inventory.verifiedSubsets.raceClassCombinations.entries;
  if (new Set(combos.map(c => `${c.faction}/${c.race}/${c.class}`)).size !== combos.length) ctx.addIssue({ code: 'custom', path: ['verifiedSubsets'], message: 'Duplicate race/class/faction combination' });
});
export type SourceFile = z.infer<typeof sourceFileSchema>;
export type SourceLock = z.infer<typeof sourceLockSchema>;
export type ReferenceInventory = z.infer<typeof referenceInventorySchema>;
