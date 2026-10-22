import { z } from 'zod';
import { entityKeySchema, idSchema, keyOfKind, safeIntSchema } from './ids';
export const ruleConditionSchema = z.object({ subject: z.enum(['selfHealth', 'selfResource', 'targetHealth', 'allyHealth', 'comboPoints']), operator: z.enum(['below', 'above']), thresholdBps: safeIntSchema.max(10000) }).strict();
export const ruleActionSchema = z.discriminatedUnion('type', [z.object({ type: z.literal('attack') }).strict(), z.object({ type: z.literal('cast'), spellKey: keyOfKind('spell') }).strict(), z.object({ type: z.literal('useItem'), itemKey: keyOfKind('item') }).strict(), z.object({ type: z.literal('flee') }).strict()]);
export const ruleSchema = z.object({ id: idSchema, enabled: z.boolean(), conditions: z.array(ruleConditionSchema).max(8), avoidActiveAura: idSchema.optional(), action: ruleActionSchema }).strict();
export type PriorityRule = z.infer<typeof ruleSchema>;
export const activityPlanStepSchema = z.object({ activity: z.enum(['quest', 'grind', 'travel', 'gather', 'craft', 'rest', 'camp', 'dungeon']), targetKey: entityKeySchema.optional(), repeat: z.boolean() }).strict();
export const gameCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('createCharacter'), name: z.string().trim().min(2).max(24), combinationKey: keyOfKind('raceClass') }).strict(),
  z.object({ type: z.literal('selectCharacter'), characterId: idSchema }).strict(),
  z.object({ type: z.literal('startActivity'), characterId: idSchema, step: activityPlanStepSchema }).strict(),
  z.object({ type: z.literal('stopActivity'), characterId: idSchema }).strict(),
  z.object({ type: z.literal('setRules'), characterId: idSchema, rules: z.array(ruleSchema).max(12) }).strict(),
  z.object({ type: z.literal('setActivityPlan'), characterId: idSchema, steps: z.array(activityPlanStepSchema).max(10) }).strict(),
  z.object({ type: z.literal('acceptQuest'), characterId: idSchema, questKey: keyOfKind('quest') }).strict(),
  z.object({ type: z.literal('turnInQuest'), characterId: idSchema, questKey: keyOfKind('quest'), rewardKey: keyOfKind('item').optional() }).strict(),
  z.object({ type: z.literal('equipItem'), characterId: idSchema, instanceId: idSchema, slot: idSchema }).strict(),
  z.object({ type: z.literal('claimReward'), characterId: idSchema, rewardId: idSchema }).strict(),
]);
export type GameCommand = z.infer<typeof gameCommandSchema>;
export const commandEnvelopeSchema = z.object({ commandId: idSchema, expectedRevision: safeIntSchema, leaseToken: idSchema, command: gameCommandSchema }).strict();
export type CommandEnvelope = z.infer<typeof commandEnvelopeSchema>;
