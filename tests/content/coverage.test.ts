import { readFileSync, mkdtempSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalize } from '../../tools/content/normalize';
import { resolveReferences } from '../../tools/content/resolve';
import { buildCoverage, validateExclusionChange } from '../../src/content/coverage';
import { requirePlayable } from '../../src/content/capabilities';
import * as provenance from '../../src/content/provenance';
import * as evidenceHarness from '../../tools/content/test-evidence';
import { executeContentTest } from '../../tools/content/test-evidence';
import { writeCoverageArtifacts } from '../../tools/content/report';
import { referenceInventorySchema, type SourceLock } from '../../tools/content/schema';
import type { RawEntity, RawFieldCandidate } from '../../src/domain/content';
import { makeEntity } from '../fixtures/factories';

const inventory = () => referenceInventorySchema.parse(JSON.parse(readFileSync('content/snapshots/FOR-IDLE-2026-10-21-PUBLIC/reference-inventory.json', 'utf8')));
const hash = 'a'.repeat(64);
const source = { sourceId: 'fixture', path: 'https://example.com/fixture', sha256: hash, selector: '$.entities[1]' };
const lock: SourceLock = { version: 1, snapshotId: 'FOR-IDLE-2026-10-21-PUBLIC', sources: [{ id: 'fixture', repository: null, commit: null, branches: ['forever', 'era'], role: 'synthetic', status: 'retrieved', build: null, languages: ['de', 'en'], limitations: ['Fixture only'] }], files: [{ sourceId: source.sourceId, path: source.path, sha256: source.sha256, kind: 'primary-extract', commit: null, blobSha: null, localPath: 'fixture.json', bytes: 1, branches: ['forever', 'era'], coveredFields: ['fixture'], build: null, languages: ['de', 'en'], retrievedVia: 'fixture', primaryUrl: source.path, limitations: ['Fixture only'] }] };
const candidate = (value: unknown): RawFieldCandidate => ({ value, source, corrections: [], status: 'verified' });
function raw(id = 1): RawEntity {
  const e = makeEntity({ key: `forever:npc:${id}`, originalId: id });
  const fields: RawEntity['fields'] = {};
  for (const [key, value] of Object.entries(e)) {
    if (['key', 'kind', 'branch', 'originalId'].includes(key)) continue;
    if (key === 'name' || key === 'combat') for (const [sub, v] of Object.entries(value)) fields[`${key}.${sub}`] = [candidate(v)];
    else fields[key] = [candidate(value)];
  }
  fields.prerequisites = [candidate([])];
  return { key: e.key, kind: e.kind, branch: e.branch, originalId: id, identitySource: source, fields };
}
function catalog(records: RawEntity[]) {
  const result = resolveReferences(normalize(records, lock));
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}
function knownInventory() {
  const inv = inventory();
  inv.categories.npcs = { ...inv.categories.npcs, expectedCount: 2, denominatorStatus: 'independent-complete', evidence: ['independent-fixture-list'], requiredKeys: ['forever:npc:1', 'forever:npc:2'] };
  return inv;
}

describe('field provenance and independent coverage', () => {
  it('keepsBranchesAndFieldEvidenceSeparate', () => {
    const forever = raw(); const era = { ...raw(), key: 'era:npc:1' as const, branch: 'era' as const };
    forever.fields['name.de'].push(candidate('Widerspruch'));
    const records = normalize([forever, era], lock);
    expect(records).toHaveLength(2);
    expect(records[0].fields['name.de'].status).toBe('conflicting');
    expect(records[0].fields['name.de'].candidates.map(c => c.value)).toEqual(['Testgegner', 'Widerspruch']);
    expect(records[0].fields['name.en'].candidates[0].source).toEqual(source);
    expect(records[1].fields['name.de'].status).toBe('verified');
  });
  it('missingRequiredFieldBlocksPlay', () => {
    const npc = raw(); delete npc.fields['combat.maxHealth'];
    const records = normalize([npc], lock);
    expect(records[0].fields['combat.maxHealth']).toEqual({ status: 'missing', candidates: [] });
    expect(requirePlayable(records[0]).ok).toBe(false);
    expect(catalog([npc]).requirePlayable(npc.key).ok).toBe(false);
    expect(catalog([raw()]).requirePlayable(npc.key).ok).toBe(true);
  });
  it('guards combat NPCs even if raw usage suppresses combat', () => {
    const npc = raw(); npc.fields.usage = [candidate(['talk'])];
    delete npc.fields['combat.maxHealth'];
    expect(requirePlayable(normalize([npc], lock)[0]).ok).toBe(false);
  });
  it('removedRequiredIdReducesCoverage', () => {
    const inv = knownInventory();
    expect(buildCoverage(inv, catalog([raw(), raw(2)]), []).categories.npcs.percent).toBe(100);
    const report = buildCoverage(inv, catalog([raw(), raw(999)]), []);
    expect(report.categories.npcs).toMatchObject({ captured: 1, connected: 1, playable: 1, tested: 0, percent: 50, missingKeys: ['forever:npc:2'] });
    expect(report.complete).toBe(false);
  });
  it('unknownDenominatorHasNoPercent', () => {
    const report = buildCoverage(inventory(), catalog([raw()]), []);
    expect(report.categories.items.percent).toBeNull();
    expect(report.categories.races.percent).toBeNull(); // counts without independent key bindings do not establish membership
    expect(report.complete).toBe(false);
    expect(report.percent).toBeNull();
  });
  it('retains missing candidates, correction chains and rejects unpinned evidence', () => {
    const npc = raw();
    npc.fields['name.de'] = [{ ...candidate(undefined), status: 'missing' }];
    const record = normalize([npc], lock)[0];
    expect(record.fields['name.de'].status).toBe('missing');
    expect(record.fields['name.de'].candidates).toHaveLength(1);
    npc.fields['name.de'] = [{ ...candidate('Testgegner'), corrections: [{ before: 'Testgegner', after: 'Korrigiert', reason: 'Fixture correction', source: { ...source, selector: '$.fixes[1]' } }] }];
    expect(normalize([npc], lock)[0].fields['name.de']).toMatchObject({ value: 'Korrigiert', status: 'verified', candidates: [{ corrections: [{ reason: 'Fixture correction' }] }] });
    npc.fields['name.de'][0].source = { ...source, sha256: 'b'.repeat(64) };
    expect(() => normalize([npc], lock)).toThrow(/source|hash/i);
  });
  it('rejects broken references, branch leaks, prerequisite cycles and invalid coordinates', () => {
    const a = raw(); a.fields.relationships = [candidate(['forever:npc:999'])];
    expect(resolveReferences(normalize([a], lock)).ok).toBe(false);
    a.fields.relationships = [candidate(['era:npc:1'])];
    expect(resolveReferences(normalize([a, { ...raw(), key: 'era:npc:1', branch: 'era' }], lock)).ok).toBe(false);
    const b = raw(2); a.fields.relationships = [candidate([])];
    a.fields.prerequisites = [candidate([b.key])]; b.fields.prerequisites = [candidate([a.key])];
    expect(resolveReferences(normalize([a, b], lock)).ok).toBe(false);
    const location = { ...raw(4), kind: 'location' as const, key: 'forever:location:4' as const };
    const positioned = raw();
    positioned.fields['position.locationKey'] = [candidate(location.key)];
    positioned.fields['position.x'] = [candidate(Infinity)];
    positioned.fields['position.y'] = [candidate(0)]; positioned.fields['position.z'] = [candidate(0)];
    expect(() => normalize([positioned], lock)).toThrow(/finite|JSON/i);
    positioned.fields['position.x'] = [candidate(1)];
    expect(resolveReferences(normalize([positioned, location], lock)).ok).toBe(true);
  });
  it('requires successful execution bound to content fingerprint and a named test case', async () => {
    const c = catalog([raw(), raw(2)]); const record = normalize([raw()], lock)[0];
    const evidence = await executeContentTest(record, { testFile: 'tests/content/coverage.test.ts', testCase: 'playable synthetic NPC' }, entity => {
      expect(requirePlayable(entity).ok).toBe(true);
    });
    expect(buildCoverage(knownInventory(), c, [evidence]).categories.npcs.tested).toBe(1);
    expect(buildCoverage(knownInventory(), c, [{ ...evidence, fingerprint: 'stale' }]).categories.npcs.tested).toBe(0);
    expect(buildCoverage(knownInventory(), c, [{ ...evidence, status: 'failed' }]).categories.npcs.tested).toBe(0);
    await expect(executeContentTest(record, { testFile: 'tests/content/coverage.test.ts', testCase: 'fails' }, () => { throw new Error('failed'); })).rejects.toThrow('failed');
    await expect(executeContentTest(record, { testFile: 'tests/missing.test.ts', testCase: 'missing' }, () => {})).rejects.toThrow();
  });
  it('rejects exclusions and scope reductions without a new reason', () => {
    const before = inventory(); const after = inventory(); after.exclusions.push({ id: 'new', reason: ' ' });
    expect(validateExclusionChange(before, after).ok).toBe(false);
    after.exclusions.pop(); after.categories.npcs.included = false;
    expect(validateExclusionChange(before, after).ok).toBe(false);
    after.categories.npcs.reason = 'Explicit approved fixture-only scope change';
    expect(validateExclusionChange(before, after).ok).toBe(true);
  });
  it('requires a fresh reason when a known denominator is made unknown without bound keys', () => {
    const before = inventory(); const after = inventory();
    expect(before.categories.races.expectedCount).toBe(9);
    expect(before.categories.races.requiredKeys).toBeUndefined();
    after.categories.races.denominatorStatus = 'unknown';
    after.categories.races.expectedCount = null;
    after.categories.races.betaExpectedCount = null;
    after.categories.races.announcedExpectedCount = null;
    expect(referenceInventorySchema.safeParse(after).success).toBe(true);
    expect(validateExclusionChange(before, after).ok).toBe(false);
    expect(validateExclusionChange(before, after, '  ').ok).toBe(false);
    expect(validateExclusionChange(before, after, before.categories.races.reason).ok).toBe(false);
    expect(validateExclusionChange(before, after, 'Independent list withdrawn by its publisher').ok).toBe(true);
    after.categories.races.reason = 'Reopening denominator pending an independently corrected list';
    expect(validateExclusionChange(before, after).ok).toBe(true);
  });
  it('rejects copied evidence and revalidates the actual test file before counting tested', async () => {
    const dir = mkdtempSync(join('tests', 'execution-evidence-'));
    const file = join(dir, 'check.ts');
    const contents = readFileSync('tests/content/coverage.test.ts', 'utf8');
    const c = catalog([raw()]); const record = normalize([raw()], lock)[0];
    const tested = (evidence: Parameters<typeof buildCoverage>[2]) => buildCoverage(knownInventory(), c, evidence).categories.npcs.tested;
    try {
      writeFileSync(file, contents);
      const evidence = await executeContentTest(record, { testFile: file, testCase: 'playable synthetic NPC' }, entity => {
        const playable = requirePlayable(entity);
        expect(playable.ok).toBe(true);
        if (playable.ok) expect(playable.value.combat?.maxHealth).toBe(100);
      });
      expect(tested([evidence])).toBe(1);
      expect(tested([JSON.parse(JSON.stringify(evidence))])).toBe(0);
      expect(tested([{ ...evidence, runId: 'fabricated-run' }])).toBe(0);
      writeFileSync(file, contents + '\n// changed after successful execution\n');
      expect(tested([evidence])).toBe(0);
      rmSync(file);
      expect(tested([evidence])).toBe(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('does not expose a registration bypass for fabricated passing metadata', async () => {
    const c = catalog([raw()]); const record = normalize([raw()], lock)[0];
    const issued = await executeContentTest(record, { testFile: 'tests/content/coverage.test.ts', testCase: 'playable synthetic NPC' }, entity => {
      expect(requirePlayable(entity).ok).toBe(true);
    });
    const fabricated = Object.freeze({ ...issued, runId: 'never-executed' });
    const unsafeRegister = Reflect.get(provenance, 'registerExecutedEvidence');
    if (typeof unsafeRegister === 'function') unsafeRegister(fabricated, () => true);
    expect(buildCoverage(knownInventory(), c, [fabricated]).categories.npcs.tested).toBe(0);
    expect(provenance).not.toHaveProperty('registerExecutedEvidence');
    expect(Object.keys(evidenceHarness).sort()).toEqual(['executeContentTest', 'isCurrentExecutedEvidence']);
  });
  it('keeps duplicate-key candidates, invalid reference states and snapshot membership honest', () => {
    const first = raw(); const second = raw(); second.fields['name.en'] = [candidate('Other')];
    const merged = normalize([first, second], lock);
    expect(merged).toHaveLength(1);
    expect(requirePlayable(merged[0]).ok).toBe(false);
    const missing = raw(); delete missing.fields.relationships;
    expect(buildCoverage(knownInventory(), catalog([missing]), []).categories.npcs).toMatchObject({ captured: 1, connected: 0, playable: 0 });
    const conflicting = raw(); conflicting.fields.prerequisites.push(candidate(['forever:npc:2']));
    expect(buildCoverage(knownInventory(), catalog([conflicting, raw(2)]), []).categories.npcs.connected).toBe(1);
    const stale = resolveReferences(normalize([raw()], { ...lock, snapshotId: 'different-snapshot' }));
    if (!stale.ok) throw new Error('unexpected fixture failure');
    expect(buildCoverage(knownInventory(), stale.value, []).categories.npcs.captured).toBe(0);
    const inv = knownInventory(); inv.categories.npcs.requiredKeys = ['forever:npc:1', 'forever:npc:1'];
    expect(referenceInventorySchema.safeParse(inv).success).toBe(false);
  });
  it('requires locked adaptation files and preserves derived status', () => {
    const npc = raw();
    const adaptation = { sourceId: 'adaptation', path: 'https://example.com/adaptation', sha256: hash, selector: '$.rule' };
    const adaptationLock: SourceLock = { ...lock, sources: [...lock.sources, { ...lock.sources[0], id: 'adaptation' }], files: [...lock.files, { ...lock.files[0], sourceId: adaptation.sourceId, path: adaptation.path, primaryUrl: adaptation.path, localPath: 'content/adaptations/fixture.json' }] };
    npc.fields['combat.maxHealth'] = [{ ...candidate(100), status: 'derived', corrections: [{ before: 100, after: 120, reason: 'Synthetic explicit Idle scaling', source: adaptation, adaptationPath: 'content/adaptations/fixture.json' }] }];
    expect(() => normalize([npc], lock)).toThrow(/source/);
    const normalized = normalize([npc], adaptationLock)[0];
    expect(normalized.fields['combat.maxHealth']).toMatchObject({ status: 'derived', value: 120 });
    expect(requirePlayable(normalized).ok).toBe(true);
    npc.fields['combat.maxHealth'][0].corrections[0].before = 99;
    expect(() => normalize([npc], adaptationLock)).toThrow(/chain/);
    npc.fields['combat.maxHealth'][0].corrections = [];
    expect(() => normalize([npc], adaptationLock)).toThrow(/adaptation/);
  });
  it('writes all four artifacts and preserves source gaps', () => {
    const dir = mkdtempSync(join(tmpdir(), 'coverage-'));
    const c = catalog([raw()]); const report = buildCoverage(inventory(), c, []);
    writeCoverageArtifacts(dir, report, c, [{ id: 'upstream-gap', reason: 'Keep source evidence' }]);
    expect(readdirSync(dir).sort()).toEqual(['coverage.html', 'coverage.json', 'gaps.json', 'provenance-audit.json']);
    expect(JSON.parse(readFileSync(join(dir, 'gaps.json'), 'utf8')).gaps.some((g: { id: string }) => g.id === 'upstream-gap')).toBe(true);
    expect(readFileSync(join(dir, 'coverage.html'), 'utf8')).toContain('Nenner unbekannt');
    expect(JSON.parse(readFileSync(join(dir, 'provenance-audit.json'), 'utf8')).entities[0].fields['name.de'].candidates[0].source.sha256).toBe(hash);
  });
});
