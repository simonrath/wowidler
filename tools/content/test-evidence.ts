import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { NormalizedEntity, TestEvidence } from '../../src/domain/content';
import { deepFreeze } from '../../src/content/provenance';
import { contentFingerprint } from './normalize';

/** Private issuance registry: only this module's successful harness run can add an entry. */
const executedEvidence = new WeakMap<TestEvidence, () => boolean>();
export function isCurrentExecutedEvidence(evidence: TestEvidence): boolean {
  const revalidate = executedEvidence.get(evidence);
  if (!revalidate) return false;
  try { return revalidate(); } catch { return false; }
}

/**
 * Build-time harness: only successful execution emits live evidence. Report artifacts
 * are snapshots, not live certificates; persisted/copied evidence needs fresh execution.
 */
export async function executeContentTest(
  record: NormalizedEntity,
  test: { testFile: string; testCase: string },
  check: (entity: NormalizedEntity) => void | Promise<void>,
): Promise<TestEvidence> {
  const testRoot = realpathSync(resolve('tests'));
  const file = realpathSync(resolve(test.testFile));
  const local = relative(testRoot, file);
  if (local.startsWith('..') || !/\.[cm]?[jt]sx?$/.test(local) || !test.testCase.trim()) throw new Error('Existing test file and named case required');
  const snapshot = deepFreeze(structuredClone(record));
  const { fingerprint, ...payload } = snapshot;
  if (contentFingerprint(payload) !== fingerprint) throw new Error('Content fingerprint mismatch');
  const testFileSha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
  await check(snapshot);
  const evidence: TestEvidence = deepFreeze({ key: snapshot.key, fingerprint, testFile: `tests/${local.replaceAll('\\', '/')}`, testFileSha256,
    testCase: test.testCase, runId: randomUUID(), executedAt: new Date().toISOString(), status: 'passed' });
  const revalidate = () => realpathSync(file) === file && createHash('sha256').update(readFileSync(file)).digest('hex') === testFileSha256;
  if (!revalidate()) throw new Error('Test file changed during content-check execution');
  executedEvidence.set(evidence, revalidate);
  return evidence;
}
