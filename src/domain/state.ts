import { classSnapshotSchema, classProgressSchema } from '../game/classes/contracts';
import { z } from 'zod';
import { combatStatsSchema, combatEffectSchema } from './content';
import { activityPlanStepSchema, ruleSchema } from './commands';
import { pauseReasonSchema, scheduledEventSchema, type PauseReason } from './events';
import { entityKeySchema, idSchema, keyOfKind, positiveIntSchema, safeIntSchema, type RngState } from './ids';
import { parseDomain } from './result';
export const inventoryStackSchema = z.object({ instanceId: idSchema, itemKey: keyOfKind('item'), quantity: positiveIntSchema }).strict();
export const questProgressSchema = z.object({ questKey: keyOfKind('quest'), status: z.enum(['active', 'complete', 'rewarded', 'failed']), objectives: z.array(z.object({ objectiveKey: entityKeySchema, count: safeIntSchema }).strict()) }).strict();
export const rewardSchema = z.object({ id: idSchema, sourceKey: entityKeySchema, moneyCopper: safeIntSchema, experience: safeIntSchema, items: z.array(inventoryStackSchema) }).strict();
export const activityStateSchema = z.object({ step: activityPlanStepSchema, startedAtMs: safeIntSchema, progress: safeIntSchema, consecutiveDefeats: safeIntSchema.max(2), pause: pauseReasonSchema.optional() }).strict();
export const characterStateSchema = z.object({
  classProgress: classProgressSchema.optional(),
  id: idSchema, name: z.string().min(2).max(24), combinationKey: keyOfKind('raceClass'), raceKey: keyOfKind('race'), classKey: keyOfKind('class'), factionKey: keyOfKind('faction'),
  level: positiveIntSchema, experience: safeIntSchema, moneyCopper: safeIntSchema, locationKey: keyOfKind('location'),
  stats: combatStatsSchema, health: safeIntSchema, resource: safeIntSchema, dead: z.boolean(),
  inventory: z.array(inventoryStackSchema), equipment: z.record(idSchema), quests: z.array(questProgressSchema), pendingRewards: z.array(rewardSchema),
  knownSpells: z.array(keyOfKind('spell')), cooldowns: z.record(safeIntSchema), talents: z.record(safeIntSchema),
  professions: z.array(z.object({ professionKey: keyOfKind('profession'), skill: safeIntSchema }).strict()), reputation: z.record(z.number().int().min(-42000).max(42000)),
  rules: z.array(ruleSchema).max(12), activityPlan: z.array(activityPlanStepSchema).max(10), activity: activityStateSchema.nullable(),
}).strict().superRefine((c, ctx) => {
  if (c.health > c.stats.maxHealth || c.resource > c.stats.maxResource) ctx.addIssue({ code: 'custom', path: ['health'], message: 'Current vital values exceed maximum' });
  if (c.dead !== (c.health === 0)) ctx.addIssue({ code: 'custom', path: ['dead'], message: 'Death status must match zero health' });
  const ids = c.inventory.map(i => i.instanceId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['inventory'], message: 'Duplicate item instance ID' });
  if (Object.values(c.equipment).some(id => !ids.includes(id))) ctx.addIssue({ code: 'custom', path: ['equipment'], message: 'Equipped item must belong to character' });
  if (c.classProgress && JSON.stringify(c.classProgress.specs[c.classProgress.activeSpec]?.allocation) !== JSON.stringify(c.talents)) ctx.addIssue({ code: 'custom', path: ['talents'], message: 'Active specialization must own current talents' });
  const branch = c.combinationKey.split(':')[0];
  if ([c.raceKey, c.classKey, c.factionKey, c.locationKey].some(k => k.split(':')[0] !== branch)) ctx.addIssue({ code: 'custom', path: ['combinationKey'], message: 'Character identity must use one branch' });
});
export type CharacterState = z.infer<typeof characterStateSchema>;
export const profileStateSchema = z.object({ id: idSchema, ownerId: idSchema, characters: z.array(characterStateSchema), activeCharacterId: idSchema.nullable(), unlocks: z.array(entityKeySchema), legacyPoints: safeIntSchema }).strict().superRefine((p, ctx) => {
  const ids = p.characters.map(c => c.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['characters'], message: 'Duplicate character ID' });
  if (p.activeCharacterId !== null && !ids.includes(p.activeCharacterId)) ctx.addIssue({ code: 'custom', path: ['activeCharacterId'], message: 'Active character must belong to profile' });
  if (p.characters.some(c => c.activity !== null && c.id !== p.activeCharacterId)) ctx.addIssue({ code: 'custom', path: ['characters'], message: 'Only the active character may have an activity' });
});
export type ProfileState = z.infer<typeof profileStateSchema>;
export const combatAuraSchema = z.object({ id: idSchema, sourceId: idSchema, expiresAtMs: safeIntSchema, token: idSchema, stacks: positiveIntSchema, effect: combatEffectSchema, remaining: safeIntSchema.optional() }).strict();
const actorVitals = {
  lastShadowApplicationResult: z.object({ spellKey: keyOfKind('spell'), targetId: idSchema, atMs: safeIntSchema, outcome: z.enum(['hit','miss']) }).strict().optional(),
  combo: z.object({ targetId: idSchema, points: positiveIntSchema.max(5) }).strict().optional(),
  classState: classSnapshotSchema.optional(),
  auras: z.array(combatAuraSchema).optional(), threat: z.record(safeIntSchema).optional(),
  position: z.object({ sector: z.enum(['front', 'flank', 'rear']), range: z.enum(['melee', 'ranged']) }).strict().optional(),
  defeatedAtMs: safeIntSchema.optional(), gcdUntilMs: safeIntSchema.optional(), cooldowns: z.record(safeIntSchema).optional(),
  casting: z.object({ actionId: idSchema, spellKey: keyOfKind('spell'), targetId: idSchema, endsAtMs: safeIntSchema }).strict().optional(),
  pendingMelee: z.object({ actionId: idSchema, targetId: idSchema, bonusDamage: safeIntSchema, threatMultiplierBps: safeIntSchema }).strict().optional(),
 id: idSchema, health: safeIntSchema, maxHealth: positiveIntSchema, resource: safeIntSchema, maxResource: safeIntSchema, nextAttackMs: safeIntSchema };
export const actorStateSchema = z.discriminatedUnion('kind', [
  z.object({ ...actorVitals, kind: z.literal('character'), characterId: idSchema }).strict(),
  z.object({ ...actorVitals, kind: z.literal('totem'), ownerActorId: idSchema, partySlotsConsumed: z.literal(0), templateId: z.string().min(1), sourceSpellKey: keyOfKind('spell'), element: z.enum(['earth','fire','water','air']), stats: combatStatsSchema, summonedAtMs: safeIntSchema, expiresAtMs: safeIntSchema, nextPulseMs: safeIntSchema }).strict(),
  z.object({ ...actorVitals, kind: z.literal('pet'), ownerActorId: idSchema, partySlotsConsumed: z.literal(0), templateId: z.string().min(1), sourceSpellKey: keyOfKind('spell'), stats: combatStatsSchema, knownSpells: z.array(keyOfKind('spell')), rules: z.array(ruleSchema).max(12) }).strict(),
  z.object({ ...actorVitals, kind: z.literal('npc'), allegiance: z.literal('ally').optional(), npcKey: keyOfKind('npc'), stats: combatStatsSchema }).strict(),
]).superRefine((a, ctx) => {
  if (a.combo && (a.kind !== 'character' || a.classState?.classKey !== 'forever:class:4')) ctx.addIssue({code:'custom',message:'Combo points require Rogue owner'});
  if (a.kind !== 'character' && a.classState) ctx.addIssue({ code: 'custom', message: 'NPC cannot carry a character class snapshot' });
  if (a.health > a.maxHealth || a.resource > a.maxResource) ctx.addIssue({ code: 'custom', message: 'Actor vital values exceed maximum' });
});
export type ActorState = z.infer<typeof actorStateSchema>;
export const gameStateSchema = z.object({ combatTimeMs: safeIntSchema.optional(), profile: profileStateSchema, encounter: z.object({ id: idSchema, locationKey: keyOfKind('location'), actors: z.array(actorStateSchema).min(1), status: z.enum(['running', 'won', 'lost', 'fled']) }).strict().nullable() }).strict().superRefine((s, ctx) => {
  const actors = s.encounter?.actors ?? [];
  if (new Set(actors.map(a => a.id)).size !== actors.length) ctx.addIssue({ code: 'custom', path: ['encounter', 'actors'], message: 'Duplicate actor ID' });
  const totems=actors.filter(a=>a.kind==='totem');
  const living=totems.filter(a=>a.health>0);
  if(new Set(living.map(a=>`${a.ownerActorId}:${a.element}`)).size!==living.length) ctx.addIssue({code:'custom',message:'At most one living totem per owner and element'});
  for(const totem of totems) {
    const owner=actors.find(a=>a.id===totem.ownerActorId);
    const c=owner?.kind==='character'?s.profile.characters.find(c=>c.id===owner.characterId):undefined;
    if(!c?.classProgress || c.classKey!=='forever:class:7' || c.id!==s.profile.activeCharacterId) ctx.addIssue({code:'custom',message:'Totem requires active persistent Shaman owner'});
    if(totem.casting || totem.pendingMelee || totem.expiresAtMs<=totem.summonedAtMs || totem.nextPulseMs<=totem.summonedAtMs)ctx.addIssue({code:'custom',message:'Invalid totem lifecycle'});
  }
  const pets = actors.filter(a=>a.kind==='pet');
  if(new Set(pets.map(a=>a.ownerActorId)).size!==pets.length) ctx.addIssue({code:'custom',path:['encounter','actors'],message:'At most one retained pet per owner per encounter'});
  for(const pet of pets) {
    const owner=actors.find(a=>a.id===pet.ownerActorId);
    const character=owner?.kind==='character'?s.profile.characters.find(c=>c.id===owner.characterId):undefined;
    if(!character?.classProgress || character.classKey!=='forever:class:3' || character.id!==s.profile.activeCharacterId) ctx.addIssue({code:'custom',path:['encounter','actors'],message:'Hunter pet requires active persistent Hunter owner'});
  }
  for (const actor of actors) {
    if(actor.combo && !actors.some(a=>a.id===actor.combo!.targetId && a.id!==actor.id && a.kind==='npc' && a.allegiance!=='ally')) ctx.addIssue({code:'custom',message:'Combo points require an opposing encounter target'});
    if (actor.kind === 'character') {
      const c = s.profile.characters.find(c => c.id === actor.characterId);
      if (actor.classState && !c?.classProgress) ctx.addIssue({ code: 'custom', path: ['encounter','actors'], message: 'Class snapshot requires persistent class progress' });
      if (c?.classProgress) {
        const expected = { classKey: c.classKey, level: c.level, stats: c.stats, talents: c.talents, knownSpells: c.knownSpells, stance: c.classProgress.stance };
        if (JSON.stringify(actor.classState) !== JSON.stringify(expected)) ctx.addIssue({ code: 'custom', path: ['encounter','actors'], message: 'Class snapshot must match persistent character' });
      }
    }
  }
  for (const actor of actors) if (actor.kind === 'character' && (!s.profile.characters.some(c => c.id === actor.characterId) || actor.characterId !== s.profile.activeCharacterId)) ctx.addIssue({ code: 'custom', path: ['encounter', 'actors'], message: 'Character actor must reference active persistent character' });
});
export type GameState = z.infer<typeof gameStateSchema>;
const uint32 = safeIntSchema.max(0xffffffff);
export const rngStateSchema = z.tuple([uint32, uint32, uint32, uint32]).refine(words => words.some(w => w !== 0), 'RNG state must not be all zero');
export const checkpointSchema = z.object({ state: gameStateSchema, simMs: safeIntSchema, queue: z.array(scheduledEventSchema), rng: rngStateSchema, nextSequence: safeIntSchema, snapshotId: idSchema, simulationVersion: idSchema }).strict().superRefine((c, ctx) => {
  if (c.queue.some(e => e.atMs < c.simMs)) ctx.addIssue({ code: 'custom', path: ['queue'], message: 'Events cannot precede checkpoint time' });
  if (c.queue.some(e => e.sequence >= c.nextSequence)) ctx.addIssue({ code: 'custom', path: ['nextSequence'], message: 'Next sequence must exceed every queued sequence' });
  if (new Set(c.queue.map(e => e.sequence)).size !== c.queue.length) ctx.addIssue({ code: 'custom', path: ['queue'], message: 'Duplicate event sequence' });
});
export type Checkpoint = Omit<z.infer<typeof checkpointSchema>, 'rng'> & { rng: RngState };
export const parseCheckpoint = (input: unknown) => parseDomain<Checkpoint>(checkpointSchema, input);
export const profileSnapshotSchema = z.object({ ownerId: idSchema, revision: safeIntSchema, profile: profileStateSchema, schemaVersion: z.literal(1), snapshotId: idSchema, simulationVersion: idSchema }).strict().refine(s => s.ownerId === s.profile.ownerId, 'Snapshot owner must match profile owner');
export type ProfileSnapshot = z.infer<typeof profileSnapshotSchema>;
export const parseProfileSnapshot = (input: unknown) => parseDomain(profileSnapshotSchema, input);
/** maxEvents is a soft limit: a started timestamp block always finishes atomically. */
export interface AdvanceBudget { maxEvents: number; shouldYield(): boolean }
export interface SimulationDiagnostic {
  code: 'zero-time-cycle' | 'unhandled-event' | 'invalid-schedule' | 'handler-error' | 'invalid-checkpoint';
  message: string; atMs: number; sequence?: number; attemptedEvents: number;
}
export interface AdvanceResult { checkpoint: Checkpoint; processedEvents: number; reachedTarget: boolean; pause?: PauseReason; diagnostic?: SimulationDiagnostic }
export type { PauseReason } from './events';
