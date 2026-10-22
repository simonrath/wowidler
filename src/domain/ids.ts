import { z } from 'zod';
export const branchSchema = z.enum(['original112', 'era', 'forever']);
export type Branch = z.infer<typeof branchSchema>;
export const entityKinds = ['race', 'faction', 'raceClass', 'class', 'talent', 'zone', 'subzone', 'location', 'npc', 'object', 'gatheringNode', 'quest', 'questObjective', 'dungeon', 'encounter', 'boss', 'raid', 'worldBoss', 'item', 'lootTable', 'spell', 'spellRank', 'profession', 'recipe', 'vendor', 'vendorItem', 'trainer', 'trainerSpell', 'reputation', 'travelRoute', 'pvp', 'battleground', 'camping', 'legacy', 'collection', 'event', 'guild', 'trade', 'mail', 'auction'] as const;
export const entityKindSchema = z.enum(entityKinds);
export type EntityKind = z.infer<typeof entityKindSchema>;
export type EntityKey = `${Branch}:${EntityKind}:${number}`;
export const safeIntSchema = z.number().finite().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const positiveIntSchema = safeIntSchema.min(1);
export const idSchema = z.string().trim().min(1).max(128);
export const entityKeySchema = z.string().superRefine((value, ctx) => {
  const parts = value.split(':');
  if (parts.length !== 3 || !branchSchema.safeParse(parts[0]).success || !entityKindSchema.safeParse(parts[1]).success || !/^(0|[1-9]\d*)$/.test(parts[2]) || !safeIntSchema.safeParse(Number(parts[2])).success) ctx.addIssue({ code: 'custom', message: 'Invalid namespaced entity key' });
}).transform(value => value as EntityKey);
export const keyOfKind = (kind: EntityKind) => entityKeySchema.refine(key => key.split(':')[1] === kind, `Expected ${kind} key`);
export type EpochMs = number;
export type SimMs = number;
export type Revision = number;
export type RngState = readonly [number, number, number, number];
