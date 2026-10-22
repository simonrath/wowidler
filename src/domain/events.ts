import { z } from 'zod';
import { entityKeySchema, idSchema, keyOfKind, positiveIntSchema, safeIntSchema } from './ids';
export const gameEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('totem-pulse'), actorId: idSchema }).strict(),
  z.object({ type: z.literal('totem-expire'), actorId: idSchema }).strict(),
  z.object({ type: z.literal('combat-decision'), actorId: idSchema }).strict(),
  z.object({ type: z.literal('cast-complete'), actorId: idSchema, actionId: idSchema }).strict(),
  z.object({ type: z.literal('melee-impact'), ranged: z.boolean().optional(), closeDistance: z.boolean().optional(), actorId: idSchema, targetId: idSchema, bonusDamage: safeIntSchema, threatMultiplierBps: safeIntSchema }).strict(),
  z.object({ type: z.literal('aura-expire'), targetId: idSchema, token: idSchema }).strict(),
  z.object({ type: z.literal('aura-tick'), targetId: idSchema, token: idSchema }).strict(),
  z.object({ type: z.literal('tick'), characterId: idSchema }).strict(),
  z.object({ type: z.literal('attack'), actorId: idSchema, targetId: idSchema }).strict(),
  z.object({ type: z.literal('damage'), actorId: idSchema, targetId: idSchema, amount: safeIntSchema }).strict(),
  z.object({ type: z.literal('heal'), actorId: idSchema, targetId: idSchema, amount: safeIntSchema }).strict(),
  z.object({ type: z.literal('death'), actorId: idSchema }).strict(),
  z.object({ type: z.literal('arrival'), characterId: idSchema, locationKey: keyOfKind('location') }).strict(),
  z.object({ type: z.literal('loot'), characterId: idSchema, itemKey: keyOfKind('item'), quantity: positiveIntSchema }).strict(),
  z.object({ type: z.literal('objectiveProgress'), characterId: idSchema, questKey: keyOfKind('quest'), objectiveKey: entityKeySchema, amount: positiveIntSchema }).strict(),
  z.object({ type: z.literal('activityComplete'), characterId: idSchema }).strict(),
]);
export type GameEvent = z.infer<typeof gameEventSchema>;
export const eventPhaseSchema = z.enum(['aura-expiry', 'scheduled-effects', 'death-resolution', 'triggered-effects', 'decisions']);
export type EventPhase = z.infer<typeof eventPhaseSchema>;
/** Missing phase is a legacy checkpoint: the simulation derives it from event.type. */
export const scheduledEventSchema = z.object({ atMs: safeIntSchema, sequence: safeIntSchema, event: gameEventSchema, phase: eventPhaseSchema.optional(), actionId: idSchema.optional() }).strict();
export type ScheduledEvent = z.infer<typeof scheduledEventSchema>;
export const pauseReasonSchema = z.enum(['death', 'consecutive-defeats', 'invalid-content', 'inventory-full', 'activity-complete', 'budget', 'manual', 'lease-lost']);
export type PauseReason = z.infer<typeof pauseReasonSchema>;
