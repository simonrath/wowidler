import { describe, expect, it } from 'vitest';
import { contentPacketSchema, type Catalog, type CombatSpell } from '../../src/domain/content';
import { checkpointSchema, type Checkpoint } from '../../src/domain/state';
import { makeCatalog, makeCharacter, makeCheckpoint, makeEntity } from '../fixtures/factories';
import { applyEffects } from '../../src/game/combat/effects';
import { createCombatCatalog, resolveAction } from '../../src/game/combat/attack';
import { chooseAction } from '../../src/game/combat/tactics';
import { advance } from '../../src/game/simulation/advance';
import { scheduleEvent } from '../../src/game/simulation/queue';
import { serializeCheckpoint, deserializeCheckpoint, hashCheckpoint } from '../../src/game/simulation/serialization';
import packetJson from '../../content/authoring/start-packet.json';

const budget = { maxEvents: 1000, shouldYield: () => false };
const spellKey = 'forever:spell:78' as const;
function fixture(): Checkpoint {
  const c = makeCheckpoint(); const hero = c.state.profile.characters[0];
  hero.stats = { ...hero.stats, maxResource: 100, attackPower: 0, minDamage: 10, maxDamage: 10, critChanceBps: 0 }; hero.resource = 100; hero.knownSpells = [spellKey];
  c.state.encounter = { id: 'fight', locationKey: hero.locationKey, status: 'running', actors: [
    { kind: 'character', id: 'hero', characterId: 'hero', health: 100, maxHealth: 100, resource: 100, maxResource: 100, nextAttackMs: 100 },
    { kind: 'npc', id: 'enemy', npcKey: 'forever:npc:1', stats: { ...hero.stats, armor: 0 }, health: 100, maxHealth: 100, resource: 100, maxResource: 100, nextAttackMs: 100 },
  ] }; return c;
}
const actor = (c: Checkpoint, id = 'enemy') => c.state.encounter!.actors.find(a => a.id === id)!;
function catalog(spell: Partial<CombatSpell> = {}): Catalog {
  return { ...makeCatalog([makeEntity()]), combat: { spells: [{ key: spellKey, minLevel: 1, cooldownMs: 1000, castMs: 500, gcdMs: 1000, resourceCost: 20, target: 'ally', effects: [{ type: 'heal', amount: 40 }], ...spell }] } };
}
const cast = { type: 'cast' as const, actorId: 'hero', targetId: 'hero', spellKey };

describe('combat resolution', () => {
  it('charges once at cast start, waits for cast time, enforces GCD and does not mutate input', () => {
    const c = fixture(); actor(c, 'hero').health = 40; c.state.profile.characters[0].health = 40;
    const before = hashCheckpoint(c); const start = resolveAction(c, cast, catalog());
    expect(start.ok).toBe(true); expect(actor(start.checkpoint, 'hero').resource).toBe(80); expect(hashCheckpoint(c)).toBe(before);
    expect(resolveAction(start.checkpoint, cast, catalog()).reason).toBe('already-casting');
    const done = advance(start.checkpoint, 500, catalog(), budget); expect(done.diagnostic).toBeUndefined(); expect(actor(done.checkpoint, 'hero').health).toBe(80);
    expect(resolveAction(done.checkpoint, cast, catalog()).reason).toBe('global-cooldown');
    expect(resolveAction(fixture(), cast, catalog({ resourceCost: 101 })).reason).toBe('insufficient-resource');
  });
  it('an interrupted healing spell heals zero and retains its spent cost', () => {
    const c = fixture(); actor(c, 'hero').health = 20; c.state.profile.characters[0].health = 20;
    const start = resolveAction(c, cast, catalog());
    const interrupted = applyEffects(start.checkpoint, [{ type: 'interrupt' }], { actorId: 'enemy', targetId: 'hero' });
    const end = advance(interrupted.checkpoint, 500, catalog(), budget);
    expect(actor(end.checkpoint, 'hero').health).toBe(20); expect(actor(end.checkpoint, 'hero').resource).toBe(80);
  });
  it('applies immunity, armor then absorption and counts only actual damage as threat', () => {
    let c = applyEffects(fixture(), [{ type: 'absorb', amount: 20, auraId: 'shield', durationMs: 1000 }], { actorId: 'enemy', targetId: 'enemy' }).checkpoint;
    const hit = applyEffects(c, [{ type: 'damage', amount: 100, school: 'physical' }], { actorId: 'hero', targetId: 'enemy' });
    expect(hit.outcomes[0].amount).toBe(80); expect(actor(hit.checkpoint).health).toBe(20); expect(actor(hit.checkpoint).threat?.hero).toBe(80);
    c = fixture(); const armored = actor(c); if (armored.kind === 'npc') armored.stats = { ...makeCharacter().stats, armor: 100 };
    expect(applyEffects(c, [{ type: 'damage', amount: 100, school: 'physical' }], { actorId: 'hero', targetId: 'enemy' }).outcomes[0].amount).toBe(50);
    c = applyEffects(c, [{ type: 'immunity', school: 'physical', auraId: 'immune', durationMs: 1000 }], { actorId: 'enemy', targetId: 'enemy' }).checkpoint;
    expect(applyEffects(c, [{ type: 'damage', amount: 100, school: 'physical' }], { actorId: 'hero', targetId: 'enemy' }).outcomes[0].amount).toBe(0);
  });
  it('caps aura stacks and refreshes expiry without an old expiration deleting the refresh', () => {
    let c = fixture();
    for (let i = 0; i < 3; i++) c = applyEffects(c, [{ type: 'buff', auraId: 'armor', armor: 10, maxStacks: 2, durationMs: 100 }], { actorId: 'hero', targetId: 'hero' }).checkpoint;
    expect(actor(c, 'hero').auras?.[0].stacks).toBe(2);
    expect(applyEffects(c, [{ type: 'damage', amount: 100, school: 'physical' }], { actorId: 'enemy', targetId: 'hero' }).outcomes[0].amount).toBe(83);
    c = advance(c, 50, catalog(), budget).checkpoint;
    c = applyEffects(c, [{ type: 'buff', auraId: 'armor', armor: 10, maxStacks: 2, durationMs: 100 }], { actorId: 'hero', targetId: 'hero' }).checkpoint;
    expect(actor(advance(c, 100, catalog(), budget).checkpoint, 'hero').auras).toHaveLength(1);
    expect(actor(advance(c, 150, catalog(), budget).checkpoint, 'hero').auras).toHaveLength(0);
  });
  it('resolves expiry, zone change, DoT and simultaneous lethal hits in one atomic timestamp', () => {
    let c = fixture(); actor(c, 'hero').health = 10; c.state.profile.characters[0].health = 10; actor(c).health = 10;
    c = applyEffects(c, [{ type: 'absorb', auraId: 'shield', amount: 100, durationMs: 100 }, { type: 'periodic', auraId: 'dot', amount: 10, school: 'shadow', intervalMs: 100, durationMs: 200 }], { actorId: 'enemy', targetId: 'hero' }).checkpoint;
    scheduleEvent(c, 100, { type: 'arrival', characterId: 'hero', locationKey: 'forever:location:2' });
    scheduleEvent(c, 100, { type: 'damage', actorId: 'hero', targetId: 'enemy', amount: 10 });
    const whole = advance(c, 100, catalog(), budget); const sliced = advance(c, 100, catalog(), { ...budget, maxEvents: 1 });
    expect(whole.diagnostic).toBeUndefined(); expect(hashCheckpoint(whole.checkpoint)).toBe(hashCheckpoint(sliced.checkpoint));
    expect(whole.checkpoint.state.encounter?.status).toBe('lost'); expect(whole.checkpoint.state.encounter?.actors.map(a => a.health)).toEqual([0, 0]);
    expect(whole.checkpoint.state.profile.characters[0]).toMatchObject({ dead: true, locationKey: 'forever:location:2', pendingRewards: [] });
  });
  it('executes the actual next-melee packet effect at swing time, preserving RNG determinism', () => {
    const packet = contentPacketSchema.parse(packetJson), cat = createCombatCatalog(packet); const c = fixture();
    const start = resolveAction(c, { ...cast, targetId: 'enemy' }, cat);
    expect(start.ok).toBe(true); expect(actor(start.checkpoint).health).toBe(100); expect(actor(start.checkpoint, 'hero').resource).toBe(85);
    const end = advance(start.checkpoint, 100, cat, budget); expect(end.diagnostic).toBeUndefined(); expect(actor(end.checkpoint).health).toBe(79); expect(actor(end.checkpoint).threat?.hero).toBe(31);
    expect(end.checkpoint.rng).not.toEqual(c.rng); expect(hashCheckpoint(advance(deserializeCheckpoint(serializeCheckpoint(start.checkpoint)), 100, cat, budget).checkpoint)).toBe(hashCheckpoint(end.checkpoint));
  });
  it('executes packet create-item only after recipe duration with materials, and returns pending output', () => {
    const packet = contentPacketSchema.parse(packetJson), cat = createCombatCatalog(packet), c = fixture(), hero = c.state.profile.characters[0];
    hero.knownSpells.push('forever:spell:3275'); hero.professions = packet.start.professions; hero.inventory = [{ instanceId: 'linen', itemKey: 'forever:item:2589', quantity: 1 }];
    const start = resolveAction(c, { ...cast, spellKey: 'forever:spell:3275' }, cat); expect(start.ok).toBe(true); expect(start.checkpoint.state.profile.characters[0].inventory).toHaveLength(0);
    const end = advance(start.checkpoint, 3000, cat, budget); expect(end.diagnostic).toBeUndefined(); expect(end.checkpoint.state.profile.characters[0].pendingRewards[0].items[0]).toMatchObject({ itemKey: 'forever:item:1251', quantity: 1 });
    expect(end.checkpoint.state.profile.characters[0].inventory).toHaveLength(0);
  });
  it('rejects thirteen rules, explains failed priorities, and chooses the first executable target', () => {
    const c = fixture(), hero = c.state.profile.characters[0];
    hero.rules = [{ id: 'item', enabled: true, conditions: [], action: { type: 'useItem', itemKey: 'forever:item:1251' } }, { id: 'hit', enabled: true, conditions: [], action: { type: 'attack' } }];
    actor(c, 'hero').nextAttackMs = 0;
    const choice = chooseAction(actor(c, 'hero'), c.state, catalog()); expect(choice.action).toMatchObject({ type: 'attack', targetId: 'enemy' }); expect(choice.rejected[0].reason).toBe('unsupported-item');
    hero.rules = Array.from({ length: 13 }, (_, i) => ({ ...hero.rules[0], id: String(i) }));
    expect(() => chooseAction(actor(c, 'hero'), c.state, catalog())).toThrow(/12/); expect(checkpointSchema.safeParse(c).success).toBe(false);
  });
  it('blocks unsupported effects atomically and enforces sectors and hostile targets', () => {
    const c = fixture(); const invalid = catalog({ effects: [{ type: 'mystery' } as never] });
    expect(resolveAction(c, cast, invalid).reason).toBe('unsupported-effect');
    expect(resolveAction(c, { type: 'attack', actorId: 'hero', targetId: 'hero' }, catalog()).reason).toBe('invalid-target');
    actor(c, 'hero').position = { sector: 'front', range: 'ranged' };
    expect(resolveAction(c, { type: 'attack', actorId: 'hero', targetId: 'enemy' }, catalog()).reason).toBe('out-of-range');
  });
});

// Regression cases exercise the composed production dispatcher, not replacement test handlers.
describe('combat scheduling and capability evidence', () => {
  it('exposes the advanced clock to tactics even when there were no queued events', () => {
    const end = advance(fixture(), 100, catalog(), budget);
    expect(chooseAction(actor(end.checkpoint, 'hero'), end.checkpoint.state, catalog()).action?.type).toBe('attack');
  });

  it('preserves allocation sequence when a cast schedules a tick before its earlier-allocated expiry', () => {
    const cat = catalog({ target: 'enemy', effects: [{ type: 'periodic', auraId: 'dot', amount: 5, school: 'shadow', intervalMs: 100, durationMs: 300 }] });
    const start = resolveAction(fixture(), { ...cast, targetId: 'enemy' }, cat);
    const end = advance(start.checkpoint, 500, cat, budget);
    const expiry = end.checkpoint.queue.find(e => e.event.type === 'aura-expire')!;
    const tick = end.checkpoint.queue.find(e => e.event.type === 'aura-tick')!;
    expect(end.diagnostic).toBeUndefined(); expect(expiry.sequence).toBeLessThan(tick.sequence);
  });

  it('counts one defeat once even when a duplicate death notification is queued', () => {
    const c = fixture(); c.state.profile.characters[0].activity = { step: { activity: 'grind', repeat: true }, startedAtMs: 0, progress: 0, consecutiveDefeats: 0 };
    scheduleEvent(c, 10, { type: 'damage', actorId: 'enemy', targetId: 'hero', amount: 100 });
    scheduleEvent(c, 10, { type: 'death', actorId: 'hero' });
    const end = advance(c, 10, catalog(), budget);
    expect(end.diagnostic).toBeUndefined(); expect(end.checkpoint.state.profile.characters[0].activity?.consecutiveDefeats).toBe(1);
  });

  it('returns to ordered decisions after a completed cast instead of stalling combat', () => {
    const c = fixture(); actor(c, 'hero').health = 40; c.state.profile.characters[0].health = 40;
    c.state.profile.characters[0].rules = [
      { id: 'heal', enabled: true, conditions: [{ subject: 'selfHealth', operator: 'below', thresholdBps: 5000 }], action: { type: 'cast', spellKey } },
      { id: 'attack', enabled: true, conditions: [], action: { type: 'attack' } },
    ];
    const start = resolveAction(c, cast, catalog());
    const end = advance(start.checkpoint, 501, catalog(), budget);
    expect(end.diagnostic).toBeUndefined(); expect(actor(end.checkpoint).health).toBe(90);
  });

  it('replaces an already established swing with next-melee instead of adding a second hit', () => {
    const c = fixture(), cat = createCombatCatalog(contentPacketSchema.parse(packetJson)); actor(c, 'hero').nextAttackMs = 0;
    const swing = resolveAction(c, { type: 'attack', actorId: 'hero', targetId: 'enemy' }, cat);
    const upgraded = resolveAction(swing.checkpoint, { ...cast, targetId: 'enemy' }, cat);
    expect(upgraded.ok).toBe(true); expect(upgraded.checkpoint.queue.filter(e => e.event.type === 'melee-impact')).toHaveLength(1);
    const end = advance(upgraded.checkpoint, 1, cat, budget); expect(end.diagnostic).toBeUndefined(); expect(actor(end.checkpoint).health).toBe(79);
  });
  it('continues real combat deterministically across budgets and serialized checkpoints', () => {
    const c = fixture(); actor(c, 'hero').nextAttackMs = 0; actor(c).nextAttackMs = 0;
    for (const id of ['hero', 'enemy']) scheduleEvent(c, 0, { type: 'combat-decision', actorId: id });
    const whole = advance(c, 25000, catalog(), budget);
    expect(whole.diagnostic).toBeUndefined(); expect(whole.checkpoint.state.encounter?.status).toBe('lost');
    let sliced = c, reached = false;
    for (let i = 0; i < 100 && !reached; i++) { const result = advance(sliced, 25000, catalog(), { ...budget, maxEvents: 1 }); expect(result.diagnostic).toBeUndefined(); sliced = deserializeCheckpoint(serializeCheckpoint(result.checkpoint)); reached = result.reachedTarget; }
    expect(reached).toBe(true); expect(hashCheckpoint(sliced)).toBe(hashCheckpoint(whole.checkpoint));
  });
  it('enforces cooldown separately from GCD and rejects an unlearned spell without spending anything', () => {
    const cat = catalog({ gcdMs: 100 });
    const start = resolveAction(fixture(), cast, cat);
    const done = advance(start.checkpoint, 500, cat, budget);
    expect(resolveAction(done.checkpoint, cast, cat).reason).toBe('spell-cooldown');
    const c = fixture(); c.state.profile.characters[0].knownSpells = [];
    expect(resolveAction(c, cast, cat)).toMatchObject({ ok: false, reason: 'unknown-spell', checkpoint: c, scheduled: [] });
  });
  it('uses per-enemy threat, healing only effective health, and deterministic ties', () => {
    let c = fixture(); const enemy = actor(c); enemy.threat = { hero: 5 };
    c.state.encounter!.actors.push({ kind: 'npc', id: 'other', npcKey: 'forever:npc:1', stats: makeCharacter().stats, health: 100, maxHealth: 100, resource: 0, maxResource: 0, nextAttackMs: 0 });
    actor(c, 'hero').health = 90; c.state.profile.characters[0].health = 90;
    c = applyEffects(c, [{ type: 'heal', amount: 40 }], { actorId: 'hero', targetId: 'hero' }).checkpoint;
    expect(actor(c).threat?.hero).toBe(10); expect(actor(c, 'other').threat).toBeUndefined();
    expect(chooseAction(actor(c), c.state, catalog()).rejected[0].reason).toBe('attack-not-ready');
  });
  it('requires an explicitly matching sector and blocks departure from the encounter zone', () => {
    const c = fixture(); const cat = catalog({ sector: 'rear' });
    expect(resolveAction(c, cast, cat).reason).toBe('wrong-sector');
    actor(c, 'hero').position = { sector: 'rear', range: 'melee' };
    expect(resolveAction(c, cast, cat).ok).toBe(true);
    c.state.profile.characters[0].locationKey = 'forever:location:2';
    expect(resolveAction(c, cast, cat).reason).toBe('different-zone');
  });
  it('does not interpret unknown item use or unknown compound melee effects as working gameplay', () => {
    const c = fixture(); const cat = catalog({ target: 'enemy', effects: [{ type: 'next-melee', originalEffectType: 17, bonusDamage: 11, resourceCost: 15, threatMultiplierBps: 15000 }, { type: 'heal', amount: 1 }] });
    expect(resolveAction(c, { ...cast, targetId: 'enemy' }, cat).reason).toBe('unsupported-effect-combination');
  });
});

describe('review regressions: action continuation and terminal encounters', () => {
  function addEnemy(c: Checkpoint, id = 'other') {
    const enemy = actor(c);
    if (enemy.kind !== 'npc') throw new Error('Expected NPC fixture');
    c.state.encounter!.actors.push({ ...structuredClone(enemy), id });
  }
  it('resumes decisions after interruption without waiting for the cancelled completion', () => {
    const c = fixture(); actor(c, 'hero').health = 40; c.state.profile.characters[0].health = 40;
    const start = resolveAction(c, cast, catalog());
    const interrupted = applyEffects(start.checkpoint, [{ type: 'interrupt' }], { actorId: 'enemy', targetId: 'hero' });
    expect(interrupted.checkpoint.queue.some(e => e.event.type === 'cast-complete')).toBe(false);
    const end = advance(interrupted.checkpoint, 101, catalog(), budget);
    expect(end.diagnostic).toBeUndefined(); expect(actor(end.checkpoint).health).toBe(90);
    expect(actor(end.checkpoint, 'hero')).toMatchObject({ health: 40, resource: 80 });
  });
  it('resumes decisions after a cast target dies and attacks the surviving enemy', () => {
    const c = fixture(); addEnemy(c);
    const cat = catalog({ target: 'enemy', effects: [{ type: 'damage', amount: 30, school: 'fire' }] });
    const start = resolveAction(c, { ...cast, targetId: 'enemy' }, cat);
    scheduleEvent(start.checkpoint, 250, { type: 'damage', actorId: 'hero', targetId: 'enemy', amount: 100 });
    const end = advance(start.checkpoint, 502, cat, budget);
    expect(end.diagnostic).toBeUndefined(); expect(end.checkpoint.state.encounter?.status).toBe('running');
    expect(actor(end.checkpoint, 'other').health).toBe(90); expect(actor(end.checkpoint, 'hero').casting).toBeUndefined();
  });
  it('resumes after an established melee target leaves range and selects a legal surviving target', () => {
    const c = fixture(); addEnemy(c);
    const cat = createCombatCatalog(contentPacketSchema.parse(packetJson));
    const start = resolveAction(c, { ...cast, targetId: 'enemy' }, cat);
    actor(start.checkpoint).position = { range: 'ranged', sector: 'front' };
    const end = advance(start.checkpoint, 2101, cat, budget);
    expect(end.diagnostic).toBeUndefined(); expect(actor(end.checkpoint, 'hero').pendingMelee).toBeUndefined();
    expect(actor(end.checkpoint).health).toBe(100); expect(actor(end.checkpoint, 'other').health).toBe(90);
  });
  it('retargeting retains side and encounter membership checks', () => {
    const c = fixture(); addEnemy(c); const enemy = actor(c); enemy.nextAttackMs = 0;
    enemy.threat = { other: 100, outsider: 200, hero: 1 };
    expect(chooseAction(enemy, c.state, catalog()).action).toMatchObject({ type: 'attack', targetId: 'hero' });
    expect(resolveAction(c, { type: 'attack', actorId: 'hero', targetId: 'outsider' }, catalog()).reason).toBe('missing-actor');
  });
  it.each(['won', 'lost', 'fled'] as const)('rejects flee from a %s encounter without changing its result', status => {
    const c = fixture(); c.state.encounter!.status = status; const before = hashCheckpoint(c);
    const result = resolveAction(c, { type: 'flee', actorId: 'hero', targetId: 'hero' }, catalog());
    expect(result).toMatchObject({ ok: false, reason: 'encounter-not-running' });
    expect(hashCheckpoint(result.checkpoint)).toBe(before); expect(hashCheckpoint(c)).toBe(before);
  });
  it('allows a living present character to flee, but rejects dead or absent actors', () => {
    const c = fixture(), flee = { type: 'flee' as const, actorId: 'hero', targetId: 'hero' };
    expect(resolveAction(c, flee, catalog()).checkpoint.state.encounter?.status).toBe('fled');
    c.state.profile.characters[0].locationKey = 'forever:location:2';
    expect(resolveAction(c, flee, catalog()).reason).toBe('different-zone');
    actor(c, 'hero').health = 0;
    expect(resolveAction(c, flee, catalog()).reason).toBe('actor-dead');
  });
});
