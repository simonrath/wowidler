import { z } from 'zod';
import { entityKeySchema, idSchema, positiveIntSchema, safeIntSchema } from './ids';
import { pauseReasonSchema } from './events';
/** Views contain display data only. Commands remain the only client mutation contract. */
export const sceneActorViewSchema = z.object({ id: idSchema, entityKey: entityKeySchema.optional(), name: z.string().min(1), health: safeIntSchema, maxHealth: positiveIntSchema, action: z.enum(['idle', 'attack', 'cast', 'dead', 'travel']), position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).readonly() }).strict().readonly();
export const sceneViewSchema = z.object({ locationKey: entityKeySchema, actors: z.array(sceneActorViewSchema).readonly() }).strict().readonly();
export type SceneView = z.infer<typeof sceneViewSchema>;
export const gameViewSchema = z.object({
  profileId: idSchema, revision: safeIntSchema, simMs: safeIntSchema, activeCharacterId: idSchema.nullable(),
  characters: z.array(z.object({ id: idSchema, name: z.string().min(1), level: positiveIntSchema, classKey: entityKeySchema, locationKey: entityKeySchema, dead: z.boolean() }).strict().readonly()).readonly(),
  activeCharacter: z.object({ id: idSchema, name: z.string().min(1), level: positiveIntSchema, health: safeIntSchema, maxHealth: positiveIntSchema, resource: safeIntSchema, maxResource: safeIntSchema, moneyCopper: safeIntSchema, experience: safeIntSchema, activity: z.string().nullable() }).strict().readonly().nullable(),
  windows: z.array(z.object({ id: idSchema, available: z.boolean(), reason: z.string().optional() }).strict().readonly()).readonly(),
  pause: pauseReasonSchema.optional(), scene: sceneViewSchema.nullable(),
}).strict().readonly();
export type GameView = z.infer<typeof gameViewSchema>;
