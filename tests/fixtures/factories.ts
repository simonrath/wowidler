import { entitySchema, type Catalog, type Entity } from '../../src/domain/content';
import type { EntityKey } from '../../src/domain/ids';
import type { CharacterState, Checkpoint, GameState } from '../../src/domain/state';
/** Deliberately synthetic neutral fixtures. No value here claims original game accuracy. */
export function makeCharacter(overrides: Partial<CharacterState> = {}): CharacterState {
  return { id: 'hero', name: 'Testheld', combinationKey: 'forever:raceClass:1', raceKey: 'forever:race:1', classKey: 'forever:class:1', factionKey: 'forever:faction:1', level: 1, experience: 0, moneyCopper: 0, locationKey: 'forever:location:1', stats: { maxHealth: 100, maxResource: 0, attackPower: 10, armor: 0, attackIntervalMs: 2000, minDamage: 5, maxDamage: 8, critChanceBps: 500 }, health: 100, resource: 0, dead: false, inventory: [], equipment: {}, quests: [], pendingRewards: [], knownSpells: [], cooldowns: {}, talents: {}, professions: [], reputation: {}, rules: [], activityPlan: [], activity: null, ...overrides };
}
export function makeState(overrides: Partial<GameState> = {}): GameState {
  return { profile: { id: 'profile-test', ownerId: 'owner-test', characters: [makeCharacter()], activeCharacterId: 'hero', unlocks: [], legacyPoints: 0 }, encounter: null, ...overrides };
}
export function makeCheckpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return { state: makeState(), simMs: 0, queue: [], rng: [1, 2, 3, 4], nextSequence: 2, snapshotId: 'fixture-only', simulationVersion: 'test-1', ...overrides };
}
export function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return { key: 'forever:npc:1', kind: 'npc', branch: 'forever', originalId: 1, name: { de: 'Testgegner', en: 'Fixture enemy', aliases: [] }, version: 'fixture-1', sources: [{ sourceId: 'synthetic-test', version: '1', locator: 'tests/fixtures/factories.ts' }], availability: 'available', dataMaturity: 'verified', implementation: 'playable', usage: ['combat'], relationships: [], combat: makeCharacter().stats, ...overrides };
}
export function makeCatalog(entities: readonly Entity[] = []): Catalog {
  const map = new Map<EntityKey, Entity>();
  for (const input of entities) {
    const entity = entitySchema.parse(input);
    if (map.has(entity.key)) throw new Error(`Duplicate entity key: ${entity.key}`);
    map.set(entity.key, entity);
  }
  return { entities: [...map.values()], get: key => map.get(key), requirePlayable(key) {
    const value = map.get(key);
    if (!value) return { ok: false, error: { code: 'missing-content', message: `Missing entity: ${key}` } };
    if (value.availability !== 'available' || value.dataMaturity !== 'verified' || value.implementation !== 'playable') return { ok: false, error: { code: 'unplayable-content', message: `Entity is not playable: ${key}` } };
    return { ok: true, value };
  } };
}
