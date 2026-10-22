import { describe, expect, it } from 'vitest';
import { entityKeySchema } from '../../src/domain/ids';
import { entitySchema, characterCreationSchema, snapshotSpecSchema } from '../../src/domain/content';
import { parseCheckpoint, parseProfileSnapshot, profileStateSchema } from '../../src/domain/state';
import { gameCommandSchema } from '../../src/domain/commands';
import { gameEventSchema } from '../../src/domain/events';
import { gameViewSchema } from '../../src/domain/views';
import { makeCatalog, makeCheckpoint, makeEntity, makeState } from '../fixtures/factories';

describe('domain contracts', () => {
  it('rejectsInvalidDomainStates', () => {
    const valid = makeCheckpoint();
    expect(parseCheckpoint(valid).ok).toBe(true);
    expect(parseCheckpoint({ ...valid, simMs: NaN }).ok).toBe(false);
    expect(parseCheckpoint({ ...valid, simMs: Infinity }).ok).toBe(false);
    expect(parseCheckpoint({ ...valid, simMs: 0.5 }).ok).toBe(false);
    const state = makeState();
    state.profile.characters[0].moneyCopper = -1;
    expect(parseCheckpoint({ ...valid, state }).ok).toBe(false);
    const inventory = makeState();
    inventory.profile.characters[0].inventory.push({ instanceId: 'i1', itemKey: 'forever:item:1', quantity: -1 });
    expect(parseCheckpoint({ ...valid, state: inventory }).ok).toBe(false);
    expect(characterCreationSchema.safeParse({ name: 'Test', combinationKey: 'forever:raceClass:1', raceKey: 'forever:race:1', classKey: 'forever:class:1', factionKey: 'forever:faction:1', allowedCombinations: [] }).success).toBe(false);
  });
  it('separates branch namespaces and rejects malformed keys', () => {
    expect(entityKeySchema.parse('forever:npc:1')).not.toBe(entityKeySchema.parse('era:npc:1'));
    expect(entityKeySchema.safeParse('forever:npc:-1').success).toBe(false);
    expect(entityKeySchema.safeParse('forever:unknown:1').success).toBe(false);
  });
  it('requires sourced versioned playable catalog content', () => {
    const entity = makeEntity();
    expect(entitySchema.safeParse(entity).success).toBe(true);
    const catalog = makeCatalog([entity, makeEntity({ key: 'era:npc:1', branch: 'era', availability: 'unavailable' })]);
    expect(catalog.get('forever:npc:1')?.key).toBe('forever:npc:1');
    expect(catalog.requirePlayable('forever:npc:1').ok).toBe(true);
    expect(catalog.requirePlayable('era:npc:1').ok).toBe(false);
    expect(catalog.requirePlayable('forever:npc:999').ok).toBe(false);
    expect(entitySchema.safeParse({ ...entity, sources: [] }).success).toBe(false);
    expect(entitySchema.safeParse({ ...entity, combat: undefined }).success).toBe(false);
    expect(entitySchema.safeParse({ ...entity, branch: 'era' }).success).toBe(false);
    expect(() => makeCatalog([entity, entity])).toThrow(/duplicate/i);
    expect(snapshotSpecSchema.safeParse({ id: 'test', branch: 'forever', referenceDate: '2026-10-21', sourceVersions: {}, categories: [{ kind: 'npc', expectedCount: null }] }).success).toBe(true);
  });
  it('validates exact race class faction relationships from content', () => {
    const combination = { key: 'forever:raceClass:1', raceKey: 'forever:race:1', classKey: 'forever:class:1', factionKey: 'forever:faction:1', startLocationKey: 'forever:location:1', playable: true };
    const input = { name: 'Test', combinationKey: combination.key, raceKey: combination.raceKey, classKey: combination.classKey, factionKey: combination.factionKey, allowedCombinations: [combination] };
    expect(characterCreationSchema.safeParse(input).success).toBe(true);
    expect(characterCreationSchema.safeParse({ ...input, classKey: 'forever:class:2' }).success).toBe(false);
  });
  it('enforces profile ownership, active character membership and actor references', () => {
    const checkpoint = makeCheckpoint();
    const snapshot = { ownerId: checkpoint.state.profile.ownerId, revision: 0, profile: checkpoint.state.profile, schemaVersion: 1, snapshotId: checkpoint.snapshotId, simulationVersion: checkpoint.simulationVersion };
    expect(parseProfileSnapshot(snapshot).ok).toBe(true);
    expect(parseProfileSnapshot({ ...snapshot, ownerId: 'other' }).ok).toBe(false);
    expect(profileStateSchema.safeParse({ ...snapshot.profile, activeCharacterId: 'missing' }).success).toBe(false);
    checkpoint.state.encounter = { id: 'encounter', locationKey: 'forever:location:1', actors: [{ id: 'actor', kind: 'character', characterId: 'missing', health: 10, maxHealth: 10, resource: 0, maxResource: 0, nextAttackMs: 0 }], status: 'running' };
    expect(parseCheckpoint(checkpoint).ok).toBe(false);
  });
  it('validates display projections without persistent writable state', () => {
    const view = { profileId: 'p', revision: 0, simMs: 0, activeCharacterId: null, characters: [], activeCharacter: null, windows: [], scene: null };
    expect(gameViewSchema.safeParse(view).success).toBe(true);
    expect(gameViewSchema.safeParse({ ...view, revision: -1 }).success).toBe(false);
    expect(gameViewSchema.safeParse({ ...view, state: makeState() }).success).toBe(false);
  });
  it('bounds commands and scheduled simulation payloads', () => {
    expect(gameCommandSchema.safeParse({ type: 'selectCharacter', characterId: 'hero' }).success).toBe(true);
    expect(gameCommandSchema.safeParse({ type: 'setRules', characterId: 'hero', rules: Array.from({ length: 13 }, () => ({ id: 'r', enabled: true, action: { type: 'attack' }, conditions: [] })) }).success).toBe(false);
    expect(gameEventSchema.safeParse({ type: 'damage', actorId: 'a', targetId: 'b', amount: -1 }).success).toBe(false);
    const checkpoint = makeCheckpoint();
    checkpoint.queue.push({ atMs: 0, sequence: 1, event: { type: 'tick', characterId: 'hero' } });
    expect(parseCheckpoint(checkpoint).ok).toBe(true);
    expect(parseCheckpoint({ ...checkpoint, nextSequence: 1 }).ok).toBe(false);
  });
});
