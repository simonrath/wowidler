import { dispatchCombat } from '../combat/attack';
import type { Catalog } from '../../domain/content';
import type { GameEvent } from '../../domain/events';
import type { SimMs } from '../../domain/ids';
import { checkpointSchema, type AdvanceBudget, type AdvanceResult, type Checkpoint, type SimulationDiagnostic } from '../../domain/state';
import { cancelAction, compareEvents, normalizeEvent, scheduleEvent, sortQueue, type PhasedEvent, type ScheduleOptions } from './queue';
import { randomInt } from './random';

export const MAX_ADVANCE_MS = 86_400_000;
export const MAX_EVENTS_PER_TIMESTAMP = 10_000;
export interface DispatchContext {
  /** Transaction-local state: never retain it or mutate time/queue/RNG directly. */
  checkpoint: Checkpoint;
  scheduled: PhasedEvent;
  catalog: Catalog;
  schedule(atMs: SimMs, event: GameEvent, options?: ScheduleOptions): number;
  cancel(actionId: string): number;
  random(min: number, max: number): number;
}
/** A synchronous, deterministic reducer. No I/O, ambient clocks/randomness, logs, or rendering. */
export type EventDispatch = (context: DispatchContext) => void;
export class SimulationFault extends Error {
  constructor(public readonly code: SimulationDiagnostic['code'], message: string) { super(message); this.name = 'SimulationFault'; }
}

/** Composition boundary: later gameplay modules supply handlers without coupling the scheduler to UI/content tooling. */
export function createAdvance(dispatch: EventDispatch) {
  return function advance(checkpoint: Checkpoint, target: SimMs, catalog: Catalog, budget: AdvanceBudget): AdvanceResult {
    const parsed = checkpointSchema.parse(checkpoint);
    if (!Number.isSafeInteger(target) || target < checkpoint.simMs || target - checkpoint.simMs > MAX_ADVANCE_MS) throw new Error('Target must be integer simulation time within the next 24 hours');
    if (!Number.isSafeInteger(budget.maxEvents) || budget.maxEvents < 0) throw new Error('maxEvents must be a nonnegative safe integer');
    let committed: Checkpoint = { ...parsed, queue: sortQueue(parsed.queue) };
    let processedEvents = 0;
    while (committed.queue.length && committed.queue[0].atMs <= target) {
      if (processedEvents >= budget.maxEvents || budget.shouldYield()) return { checkpoint: committed, processedEvents, reachedTarget: false, pause: 'budget' };
      const draft = structuredClone(committed);
      const atMs = draft.queue[0].atMs;
      draft.simMs = atMs;
      let attemptedEvents = 0;
      let scheduled: PhasedEvent | undefined;
      try {
        while (draft.queue.length && draft.queue[0].atMs === atMs) {
          if (attemptedEvents >= MAX_EVENTS_PER_TIMESTAMP) throw new SimulationFault('zero-time-cycle', 'Timestamp event limit exceeded; entire timestamp rolled back');
          scheduled = normalizeEvent(draft.queue.shift()!);
          const current = scheduled;
          attemptedEvents++;
          const returned: unknown = dispatch({ checkpoint: draft, scheduled: current, catalog,
            schedule(time, event, options) {
              try {
                const candidate = normalizeEvent({ atMs: time, event, sequence: draft.nextSequence, ...options });
                if (compareEvents(candidate, current) <= 0) throw new Error('Cannot schedule before the current event/phase');
                return scheduleEvent(draft, time, event, options);
              } catch (error) { throw new SimulationFault('invalid-schedule', error instanceof Error ? error.message : String(error)); }
            },
            cancel: actionId => cancelAction(draft, actionId),
            random(min, max) { const draw = randomInt(draft.rng, min, max); draft.rng = draw.state; return draw.value; },
          });
          if (returned !== undefined) throw new SimulationFault('handler-error', 'Event dispatch must be synchronous and return void');
          draft.queue = sortQueue(draft.queue);
          if (draft.simMs !== atMs || (draft.queue[0] && compareEvents(draft.queue[0], current) <= 0)) throw new SimulationFault('invalid-schedule', 'Handler changed time or inserted an earlier event');
        }
        const valid = checkpointSchema.safeParse(draft);
        if (!valid.success) throw new SimulationFault('invalid-checkpoint', valid.error.message);
        committed = valid.data;
        processedEvents += attemptedEvents;
      } catch (error) {
        return { checkpoint: committed, processedEvents, reachedTarget: false, diagnostic: {
          code: error instanceof SimulationFault ? error.code : 'handler-error',
          message: error instanceof Error ? error.message : String(error), atMs,
          sequence: scheduled?.sequence, attemptedEvents,
        } };
      }
    }
    return { checkpoint: { ...committed, simMs: target }, processedEvents, reachedTarget: true };
  };
}

/** Production combat composition; unrelated gameplay events remain fail-closed. */
const advanceCombat = createAdvance(dispatchCombat);
export function advance(checkpoint: Checkpoint, target: SimMs, catalog: Catalog, budget: AdvanceBudget): AdvanceResult {
  const result = advanceCombat(checkpoint, target, catalog, budget);
  // Pure time jumps also become visible to the public state-only tactics interface.
  if (result.reachedTarget) result.checkpoint.state.combatTimeMs = result.checkpoint.simMs;
  return result;
}
