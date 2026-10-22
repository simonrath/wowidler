/** Node-only build tooling. Do not import crypto or source bytes into the game runtime. */
import { createHash } from 'node:crypto';
import { parseDomain, type Result, type Validation } from '../../src/domain/result';
import { referenceInventorySchema, sourceFileSchema, sourceLockSchema, type SourceFile, type SourceLock, type ReferenceInventory } from './schema';
export type { SourceFile, SourceLock, ReferenceInventory } from './schema';
export function loadSourceLock(input: unknown): Result<SourceLock> { return parseDomain(sourceLockSchema, input); }
export function loadReferenceInventory(input: unknown): Result<ReferenceInventory> { return parseDomain(referenceInventorySchema, input); }
/** Synchronous verification over the exact captured bytes, including compressed files. */
export function verifySourceFile(bytes: Uint8Array, record: SourceFile): Validation {
  const parsed = sourceFileSchema.safeParse(record);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map(({ path, message }) => ({ path, message })) };
  const issues: { path: string[]; message: string }[] = [];
  if (bytes.byteLength !== record.bytes) issues.push({ path: ['bytes'], message: 'Captured byte length differs from source lock' });
  if (createHash('sha256').update(bytes).digest('hex') !== record.sha256) issues.push({ path: ['sha256'], message: 'Captured SHA-256 differs from source lock' });
  if (record.blobSha !== null && createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex') !== record.blobSha) issues.push({ path: ['blobSha'], message: 'Captured Git blob SHA differs from source lock' });
  return issues.length ? { ok: false, issues } : { ok: true };
}
