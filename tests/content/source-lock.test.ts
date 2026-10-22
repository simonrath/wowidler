import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadSourceLock, loadReferenceInventory, verifySourceFile } from '../../tools/content/lock';
import { entityKinds } from '../../src/domain/ids';

const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const lockPath = 'content/sources/lock.json';
const inventoryPath = 'content/snapshots/FOR-IDLE-2026-10-21-PUBLIC/reference-inventory.json';

describe('immutable content evidence', () => {
  it('rejectsMutableOrChangedSource', () => {
    const lock = json(lockPath);
    expect(loadSourceLock(lock).ok).toBe(true);
    const mutable = structuredClone(lock);
    mutable.files[0].commit = 'main';
    expect(loadSourceLock(mutable).ok).toBe(false);
    const record = lock.files[0];
    const bytes = readFileSync(record.localPath);
    expect(verifySourceFile(bytes, record).ok).toBe(true);
    const changed = new Uint8Array(bytes);
    changed[0] ^= 1;
    expect(verifySourceFile(changed, record).ok).toBe(false);
    expect(verifySourceFile(bytes, { ...record, sha256: '0'.repeat(64) }).ok).toBe(false);
  });
  it('verifies every captured source and rejects orphan or duplicate records', () => {
    const lock = json(lockPath);
    for (const file of lock.files) expect(verifySourceFile(readFileSync(file.localPath), file), file.path).toEqual({ ok: true });
    expect(loadSourceLock({ ...lock, files: [...lock.files, lock.files[0]] }).ok).toBe(false);
    const orphan = structuredClone(lock);
    orphan.files[0].sourceId = 'missing';
    expect(loadSourceLock(orphan).ok).toBe(false);
    const invalid = structuredClone(lock);
    invalid.files[0].path = '../escape';
    expect(loadSourceLock(invalid).ok).toBe(false);
  });
  it('unknownDenominatorRemainsNull', () => {
    const inventory = json(inventoryPath);
    expect(loadReferenceInventory(inventory).ok).toBe(true);
    expect(inventory.categories.items.expectedCount).toBeNull();
    const invented = structuredClone(inventory);
    invented.categories.items.expectedCount = 123;
    expect(loadReferenceInventory(invented).ok).toBe(false);
    expect(Object.values(inventory.categories).map((v: any) => v.kind).sort()).toEqual([...entityKinds].sort());
    const missing = structuredClone(inventory);
    delete missing.categories.items;
    expect(loadReferenceInventory(missing).ok).toBe(false);
  });
  it('keeps independently enumerated scope separate from total catalog and implementation', () => {
    const inventory = json(inventoryPath);
    const facts = inventory.verifiedSubsets;
    expect(facts.raceClassCombinations.entries).toHaveLength(56);
    expect(new Set(facts.raceClassCombinations.entries.map((v: any) => `${v.faction}/${v.race}/${v.class}`)).size).toBe(56);
    expect(facts.newDungeons.entries).toHaveLength(9);
    expect(facts.firstRaids.entries).toHaveLength(3);
    expect(facts.firstRaids.entries.every((v: any) => v.availability === 'announced')).toBe(true);
    expect(inventory.categories.dungeons.expectedCount).toBeNull();
    expect(inventory.categories.raids.expectedCount).toBeNull();
    expect(facts.raceClassCombinations.entries.some((v: any) => v.race === 'Skyborne' && v.faction === 'Alliance' && v.class === 'Mage')).toBe(true);
    expect(facts.raceClassCombinations.entries.some((v: any) => v.race === 'Skyborne' && v.faction === 'Horde' && v.class === 'Shaman')).toBe(true);
    const invalid = structuredClone(inventory);
    invalid.verifiedSubsets.raceClassCombinations.entries.pop();
    expect(loadReferenceInventory(invalid).ok).toBe(false);
  });
  it('preserves source branch and build boundaries for additional evidence', () => {
    const lock = json(lockPath);
    const grimoireTalents = lock.files.find((f: any) => f.sourceId === 'grimoire' && f.path === 'data/talents.json');
    expect(grimoireTalents?.build).toBe('1.60.1.70425');
    expect(grimoireTalents?.branches).toEqual(['forever']);
    const classicLoot = lock.files.find((f: any) => f.sourceId === 'grimoire' && f.path === 'data/npc-loot.json');
    expect(classicLoot?.branches).toEqual(['original112']);
    const clientEffects = lock.files.find((f: any) => f.sourceId === 'wow-database' && f.path === 'data/forever/client-extract/SpellEffect.jsonl.gz');
    expect(clientEffects?.build).toBe('70338');
    expect(clientEffects?.branches).toEqual(['forever']);
    expect(json('content/sources/registry.json').sources).toEqual(lock.sources);
    const wrongBranch = structuredClone(lock);
    wrongBranch.files[0].branches = ['era'];
    expect(loadSourceLock(wrongBranch).ok).toBe(false);
    const wrongBlob = { ...lock.files[0], blobSha: '0'.repeat(40) };
    expect(verifySourceFile(readFileSync(wrongBlob.localPath), wrongBlob).ok).toBe(false);
  });
  it('retains Forever LibQuestDB zones inside mixed Classic NPC and object captures', () => {
    const lock = json(lockPath);
    for (const path of ['data/npcs.json', 'data/objects.json']) {
      const file = lock.files.find((f: any) => f.sourceId === 'grimoire' && f.path === path);
      expect(file.branches).toEqual(['original112', 'forever']);
      expect(file.build).toBeNull();
      expect(file.coveredFields).toContain('original112.identity-and-template-fields');
      expect(file.coveredFields).toContain('forever.zone-association');
      expect(file.limitations.join(' ')).toContain('1.60.1.69913');
      expect(file.limitations.join(' ')).toContain('LibQuestDB');
    }
    const source = lock.sources.find((s: any) => s.id === 'grimoire');
    expect(source.limitations.join(' ')).toContain('1.60.1.69913');
    const gaps = json('reports/content/FOR-IDLE-2026-10-21-PUBLIC/gaps.json');
    expect(gaps.gaps.find((g: any) => g.id === 'FOR-GAP-BUILD-CONFLICT').reason).toContain('1.60.1.69913');
  });
  it('does not infer an exhaustive Onyxia boss count from one named encounter', () => {
    const inventory = json(inventoryPath);
    const onyxia = inventory.verifiedSubsets.firstRaids.entries.find((r: any) => r.name === "Onyxia's Lair");
    expect(onyxia.bossCount).toBeNull();
  });
});
