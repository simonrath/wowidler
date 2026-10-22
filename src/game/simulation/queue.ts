import { scheduledEventSchema, type EventPhase, type GameEvent, type ScheduledEvent } from '../../domain/events';
import type { Checkpoint } from '../../domain/state';

export const PHASE_ORDER: Readonly<Record<EventPhase, number>> = {
  'aura-expiry': 0, 'scheduled-effects': 1, 'death-resolution': 2, 'triggered-effects': 3, decisions: 4,
};
const DEFAULT_PHASE: Record<GameEvent['type'], EventPhase> = {
  'totem-pulse': 'scheduled-effects', 'totem-expire': 'aura-expiry',
  'combat-decision': 'decisions', 'cast-complete': 'scheduled-effects', 'melee-impact': 'scheduled-effects', 'aura-expire': 'aura-expiry', 'aura-tick': 'scheduled-effects',
  tick: 'decisions', attack: 'decisions', damage: 'scheduled-effects', heal: 'scheduled-effects',
  death: 'death-resolution', arrival: 'scheduled-effects', loot: 'triggered-effects',
  objectiveProgress: 'triggered-effects', activityComplete: 'triggered-effects',
};
export type PhasedEvent = ScheduledEvent & { phase: EventPhase };
export function normalizeEvent(event: ScheduledEvent): PhasedEvent {
  return { ...event, phase: event.phase ?? DEFAULT_PHASE[event.event.type] };
}
export function compareEvents(a: ScheduledEvent, b: ScheduledEvent): number {
  return a.atMs - b.atMs || PHASE_ORDER[normalizeEvent(a).phase] - PHASE_ORDER[normalizeEvent(b).phase] || a.sequence - b.sequence;
}
/** Returns a new array. Sequence is the persisted stable tie breaker, never array position. */
export function sortQueue(queue: readonly ScheduledEvent[]): PhasedEvent[] {
  return queue.map(normalizeEvent).sort(compareEvents);
}
export interface ScheduleOptions { phase?: EventPhase; actionId?: string }
/** Mutates only a caller-owned transaction/checkpoint. The current-phase constraint is enforced by advance's context. */
export function scheduleEvent(checkpoint: Checkpoint, atMs: number, event: GameEvent, options: ScheduleOptions = {}): number {
  if (!Number.isSafeInteger(checkpoint.nextSequence) || checkpoint.nextSequence < 0 || checkpoint.nextSequence >= Number.MAX_SAFE_INTEGER) throw new Error('Event sequence exhausted');
  if (atMs < checkpoint.simMs) throw new Error('Cannot schedule an event in the past');
  const scheduled = normalizeEvent(scheduledEventSchema.parse({ atMs, sequence: checkpoint.nextSequence, event, ...options }));
  checkpoint.queue.push(scheduled);
  checkpoint.queue = sortQueue(checkpoint.queue);
  checkpoint.nextSequence++;
  return scheduled.sequence;
}
/** Cancels pending events owned by an action; already applied effects are not undone. */
export function cancelAction(checkpoint: Checkpoint, actionId: string): number {
  const before = checkpoint.queue.length;
  checkpoint.queue = checkpoint.queue.filter(event => event.actionId !== actionId);
  return before - checkpoint.queue.length;
}
