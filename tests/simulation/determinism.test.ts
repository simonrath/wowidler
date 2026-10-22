import { describe, expect, it, vi } from 'vitest';
import { makeCatalog, makeCheckpoint } from '../fixtures/factories';
import { advance, createAdvance, MAX_EVENTS_PER_TIMESTAMP, type EventDispatch } from '../../src/game/simulation/advance';
import { cancelAction, scheduleEvent, sortQueue } from '../../src/game/simulation/queue';
import { nextUint32, randomInt } from '../../src/game/simulation/random';
import { deserializeCheckpoint, hashCheckpoint, serializeCheckpoint } from '../../src/game/simulation/serialization';
import type { Checkpoint } from '../../src/domain/state';

const catalog = makeCatalog();
const budget = (maxEvents = 100_000) => ({ maxEvents, shouldYield: () => false });
const tick = { type: 'tick' as const, characterId: 'hero' };
const fixture = () => {
  const checkpoint = makeCheckpoint();
  scheduleEvent(checkpoint, 10, tick);
  return checkpoint;
};
// Synthetic state transitions exercise the scheduler without inventing combat rules.
const dispatch: EventDispatch = ({ checkpoint, scheduled, schedule, random }) => {
  checkpoint.state.profile.legacyPoints += random(0, 10);
  if (scheduled.atMs < 1000) schedule(scheduled.atMs + 10, tick);
};

describe('deterministic simulation', () => {
  it('matches one long run across different event budgets and serialization resumes', () => {
    const run = createAdvance(dispatch);
    const original = fixture();
    const before = hashCheckpoint(original);
    const whole = run(original, 1200, catalog, budget());
    for (const sizes of [[1], [2, 5, 1, 13], [37, 3]]) {
      let sliced = original;
      let index = 0;
      while (sliced.simMs < 1200) {
        const result = run(sliced, 1200, catalog, budget(sizes[index++ % sizes.length]));
        sliced = deserializeCheckpoint(serializeCheckpoint(result.checkpoint));
      }
      expect(hashCheckpoint(sliced)).toBe(hashCheckpoint(whole.checkpoint));
    }
    expect(whole.processedEvents).toBe(100);
    expect(whole.reachedTarget).toBe(true);
    expect(hashCheckpoint(original)).toBe(before);
  });

  it('orders equal timestamps by phase then sequence and commits a whole block beyond the soft budget', () => {
    const checkpoint = makeCheckpoint();
    scheduleEvent(checkpoint, 10, { type: 'death', actorId: 'a' });
    scheduleEvent(checkpoint, 10, { type: 'damage', actorId: 'a', targetId: 'b', amount: 1 });
    scheduleEvent(checkpoint, 10, { type: 'damage', actorId: 'b', targetId: 'a', amount: 1 });
    scheduleEvent(checkpoint, 10, tick, { phase: 'aura-expiry' });
    scheduleEvent(checkpoint, 10, tick, { phase: 'triggered-effects' });
    scheduleEvent(checkpoint, 10, tick);
    const seen: string[] = [];
    const run = createAdvance(({ scheduled }) => { seen.push(`${scheduled.phase}:${scheduled.event.type}`); });
    const result = run(checkpoint, 10, catalog, budget(1));
    expect(seen).toEqual(['aura-expiry:tick', 'scheduled-effects:damage', 'scheduled-effects:damage', 'death-resolution:death', 'triggered-effects:tick', 'decisions:tick']);
    expect(result.processedEvents).toBe(6);
    expect(result.reachedTarget).toBe(true);
    expect(sortQueue(checkpoint.queue).filter(e => e.event.type === 'damage').map(e => e.sequence)).toEqual([3, 4]);
  });

  it('applies both simultaneous lethal direct hits before any death resolution', () => {
    const checkpoint = makeCheckpoint();
    const stats = checkpoint.state.profile.characters[0].stats;
    checkpoint.state.encounter = { id: 'synthetic-duel', locationKey: 'forever:location:1', status: 'running', actors: ['a', 'b'].map(id => ({ kind: 'npc', id, npcKey: 'forever:npc:1', stats, health: 1, maxHealth: 1, resource: 0, maxResource: 0, nextAttackMs: 10 })) };
    scheduleEvent(checkpoint, 10, { type: 'death', actorId: 'a' });
    scheduleEvent(checkpoint, 10, { type: 'damage', actorId: 'a', targetId: 'b', amount: 1 });
    scheduleEvent(checkpoint, 10, { type: 'damage', actorId: 'b', targetId: 'a', amount: 1 });
    const run = createAdvance(({ checkpoint: draft, scheduled }) => {
      const actors = draft.state.encounter!.actors;
      if (scheduled.event.type === 'damage') {
        const { targetId } = scheduled.event;
        actors.find(actor => actor.id === targetId)!.health = 0;
      } else if (scheduled.event.type === 'death') {
        expect(actors.map(actor => actor.health)).toEqual([0, 0]);
        draft.state.encounter!.status = 'lost';
      }
    });
    const whole = run(checkpoint, 20, catalog, budget());
    const block = run(checkpoint, 20, catalog, budget(1));
    expect(block.diagnostic).toBeUndefined();
    expect(block.checkpoint.state.encounter?.status).toBe('lost');
    expect(hashCheckpoint(block.checkpoint)).toBe(hashCheckpoint(whole.checkpoint));
  });

  it('cancels only matching pending actions, without consuming RNG or reusing sequence numbers', () => {
    const checkpoint = makeCheckpoint();
    scheduleEvent(checkpoint, 10, tick, { actionId: 'cancel-me', phase: 'aura-expiry' });
    scheduleEvent(checkpoint, 10, tick, { actionId: 'keep' });
    scheduleEvent(checkpoint, 20, tick, { actionId: 'cancel-me' });
    expect(cancelAction(checkpoint, 'cancel-me')).toBe(2);
    expect(cancelAction(checkpoint, 'cancel-me')).toBe(0);
    expect(checkpoint.nextSequence).toBe(5);
    expect(checkpoint.rng).toEqual([1, 2, 3, 4]);
    const run = createAdvance(({ checkpoint: draft }) => { draft.state.profile.legacyPoints++; });
    expect(run(checkpoint, 20, catalog, budget()).processedEvents).toBe(1);
  });

  it('can cancel a pending action inside a timestamp transaction', () => {
    const checkpoint = makeCheckpoint();
    scheduleEvent(checkpoint, 10, tick, { phase: 'aura-expiry' });
    scheduleEvent(checkpoint, 10, tick, { actionId: 'cast' });
    const run = createAdvance(({ cancel }) => { cancel('cast'); });
    expect(run(checkpoint, 20, catalog, budget()).processedEvents).toBe(1);
  });

  it('rolls back the entire faulty zero-time block but retains prior committed timestamps', () => {
    const checkpoint = fixture();
    const run = createAdvance(({ checkpoint: draft, scheduled, schedule, random }) => {
      draft.state.profile.legacyPoints += random(1, 10);
      schedule(scheduled.atMs === 10 ? 20 : scheduled.atMs, tick);
    });
    const committed = run(checkpoint, 20, catalog, budget(1));
    const result = run(checkpoint, 30, catalog, budget());
    expect(result.diagnostic).toMatchObject({ code: 'zero-time-cycle', atMs: 20, attemptedEvents: MAX_EVENTS_PER_TIMESTAMP });
    expect(result.processedEvents).toBe(1);
    expect(result.reachedTarget).toBe(false);
    expect(hashCheckpoint(result.checkpoint)).toBe(hashCheckpoint(committed.checkpoint));
  });

  it('checks yield only between complete blocks and leaves zero-budget checkpoints untouched', () => {
    const checkpoint = fixture();
    const run = createAdvance(dispatch);
    const stopped = run(checkpoint, 100, catalog, budget(0));
    expect(hashCheckpoint(stopped.checkpoint)).toBe(hashCheckpoint(checkpoint));
    let calls = 0;
    const yielded = run(checkpoint, 100, catalog, { maxEvents: 100, shouldYield: () => ++calls > 1 });
    expect(yielded.processedEvents).toBe(1);
    expect(yielded.checkpoint.simMs).toBe(10);
    expect(yielded.pause).toBe('budget');
  });

  it('fails closed on unhandled events and rolls back handler errors and invalid phase scheduling', () => {
    const checkpoint = fixture();
    const result = advance(checkpoint, 100, catalog, budget());
    expect(result.diagnostic?.code).toBe('unhandled-event');
    expect(hashCheckpoint(result.checkpoint)).toBe(hashCheckpoint(checkpoint));
    const regresses = createAdvance(({ schedule, scheduled }) => { schedule(scheduled.atMs, tick, { phase: 'aura-expiry' }); });
    expect(regresses(checkpoint, 100, catalog, budget()).diagnostic?.code).toBe('invalid-schedule');
    const broken = createAdvance(({ checkpoint: draft, random }) => { draft.state.profile.legacyPoints++; random(0, 10); throw new Error('bad handler'); });
    expect(hashCheckpoint(broken(checkpoint, 100, catalog, budget()).checkpoint)).toBe(hashCheckpoint(checkpoint));
  });

  it('rejects invalid time, budgets, ranges, checkpoints and sequence overflow', () => {
    const checkpoint = fixture();
    for (const target of [-1, 0.5, NaN, Infinity, 86_400_001]) expect(() => advance(checkpoint, target, catalog, budget())).toThrow();
    expect(() => advance(checkpoint, 10, catalog, budget(-1))).toThrow();
    expect(() => scheduleEvent(checkpoint, 0.5, tick)).toThrow();
    expect(() => scheduleEvent({ ...checkpoint, nextSequence: Number.MAX_SAFE_INTEGER }, 10, tick)).toThrow();
    expect(() => randomInt([1, 2, 3, 4], 2, 1)).toThrow();
    expect(() => deserializeCheckpoint(new TextEncoder().encode('{"simMs":0}'))).toThrow();
    expect(() => advance({ ...checkpoint, rng: [0, 0, 0, 0] }, 10, catalog, budget())).toThrow();
  });

  it('uses reproducible four-word xoshiro128** state and excludes ambient random and clocks', () => {
    const first = nextUint32([1, 2, 3, 4]);
    expect(first).toEqual({ value: 11520, state: [7, 0, 1026, 12288] });
    expect(randomInt([1, 2, 3, 4], 5, 5).value).toBe(5);
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('ambient RNG'); });
    const now = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('ambient clock'); });
    try { expect(createAdvance(dispatch)(fixture(), 1000, catalog, budget()).reachedTarget).toBe(true); }
    finally { random.mockRestore(); now.mockRestore(); }
  });

  it('serializes canonical key/queue order, explicit phases and resumes without changing bytes', () => {
    const checkpoint = fixture();
    scheduleEvent(checkpoint, 10, tick, { phase: 'aura-expiry' });
    const shuffled: Checkpoint = { ...checkpoint, queue: [...checkpoint.queue].reverse() };
    shuffled.state = { encounter: checkpoint.state.encounter, profile: checkpoint.state.profile };
    expect(hashCheckpoint(shuffled)).toBe(hashCheckpoint(checkpoint));
    const legacy = makeCheckpoint({ queue: [{ atMs: 10, sequence: 1, event: tick }] });
    const explicit = makeCheckpoint({ queue: [{ atMs: 10, sequence: 1, event: tick, phase: 'decisions' }] });
    expect(hashCheckpoint(legacy)).toBe(hashCheckpoint(explicit));
    const bytes = serializeCheckpoint(checkpoint);
    expect(serializeCheckpoint(deserializeCheckpoint(bytes))).toEqual(bytes);
  });
});
