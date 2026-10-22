import { z } from 'zod';
import { combatStatsSchema, combatSpellSchema, raceClassCombinationSchema, packetEvidenceSchema } from '../../domain/content';
import { keyOfKind, positiveIntSchema as pos, safeIntSchema as nat } from '../../domain/ids';
import { ruleSchema } from '../../domain/commands';
export const stanceSchema = z.enum(['battle', 'defensive', 'berserker']);
export const classSnapshotSchema = z.object({ classKey: keyOfKind('class'), level: pos, stats: combatStatsSchema, talents: z.record(nat), knownSpells: z.array(keyOfKind('spell')), stance: stanceSchema }).strict();
const slot = z.object({ profileId: z.string().min(1), allocation: z.record(nat) }).strict();
export const classProgressSchema = z.object({ stance: stanceSchema, stanceReadyAtMs: nat, activeSpec: z.union([z.literal(0), z.literal(1)]), specs: z.tuple([slot, slot.nullable()]) }).strict();
export const talentSchema = z.object({ key: keyOfKind('talent'), classKey: keyOfKind('class'), treeId: pos, name: z.string(), row: nat, column: nat, status: z.enum(['new','changed','same']), max: pos, spells: z.array(pos), descriptions: z.array(z.string()), prerequisite: z.object({ key: keyOfKind('talent'), rank: pos }).strict().nullable(), handler: z.enum(['heroic-cost', 'rend-damage', 'stance-retention', 'critical-bleed', 'melee-crit', 'bloodrage-resource', 'divine-strength', 'healing-light', 'toughness', 'benediction', 'pet-endurance', 'hunter-crit', 'hunter-parry', 'rogue-crit', 'sinister-cost', 'eviscerate-damage', 'opportunity', 'twin-disciplines', 'improved-renew', 'shadow-focus', 'convection', 'thundering-strikes', 'improved-healing-wave']).nullable(), values: z.array(nat), gap: z.array(z.string()), sourceSelector: z.string() }).strict();
export const classCatalogSchema = z.object({
  version: z.literal('idle-classes-v1'), authenticServerCombat: z.literal(false),
  combinations: z.array(raceClassCombinationSchema),
  definitions: z.array(z.object({ key: keyOfKind('class'), slug: z.string(), name: z.string(), resource: z.string(), mechanics: z.enum(['playable', 'unsupported']), specs: z.array(z.object({ id: pos, slug: z.string(), name: z.string(), role: z.string() }).strict()), stats: combatStatsSchema, initialResource: nat }).strict()),
  racials: z.array(z.object({ raceKey: keyOfKind('race'), classKey: keyOfKind('class').nullable(), originalId: pos, name: z.string(), description: z.string(), passive: z.boolean(), implementation: z.literal('unsupported') }).strict()),
  abilityEvidence: z.array(z.object({ key: keyOfKind('spell'), name: z.string(), description: z.string(), level: pos, selector: z.string() }).strict()),
  talents: z.array(talentSchema),
  profiles: z.array(z.object({ id: z.string(), classKey: keyOfKind('class'), treeId: pos, role: z.enum(['melee','tank','healer','ranged']), stance: stanceSchema, rules: z.array(ruleSchema).max(12), allocation: z.record(nat) }).strict()),
  shaman: z.object({ starterMainHand: z.literal('owned-idle-shaman-weapon'), totemToolAccess: z.literal('owned-idle-encounter-tools'), totems: z.array(z.object({ id: z.string().min(1), sourceSpellKey: keyOfKind('spell'), element: z.enum(['earth','fire','water','air']), stats: combatStatsSchema, durationMs: pos, intervalMs: pos, pulse: combatSpellSchema.shape.effects.element.refine(effect=>['damage','heal','buff'].includes(effect.type),'Totem pulse must damage, heal or buff') }).strict()) }).strict(),
  priest: z.object({ shadowHitChanceBps: nat.max(10000) }).strict(),
  rogue: z.object({ energyPerTick: pos, energyIntervalMs: pos, energyCycleMs: pos, starterMainHand: z.literal('owned-idle-dagger'), weaponPowerDivisor: pos, eviscerateAttackPowerBpsPerPoint: nat, ruptureAttackPowerBpsPerPoint: nat, ruptureIntervalMs: pos, eviscerateBaseDamage: z.array(nat).length(5), ruptureBaseDamage: z.array(nat).length(5), ruptureDurationsMs: z.array(pos).length(5) }).strict(),
  hunterPet: z.object({ id: z.string().min(1), sourceSpellKey: keyOfKind('spell'), stats: combatStatsSchema, initialResource: nat, knownSpells: z.array(keyOfKind('spell')), rules: z.array(ruleSchema).max(12), focusPerTick: pos, focusIntervalMs: pos, focusDurationMs: pos }).strict(),
  spells: z.array(combatSpellSchema),
  training: z.array(z.object({ spellKey: keyOfKind('spell'), classKey: keyOfKind('class'), level: pos, cost: nat, previousRank: keyOfKind('spell').nullable(), questKey: keyOfKind('quest').nullable(), reagents: z.array(z.object({ itemKey: keyOfKind('item'), quantity: pos }).strict()) }).strict()),
  trainers: z.array(z.object({ id: z.string(), classKey: keyOfKind('class'), locations: z.array(keyOfKind('location')), majorCity: z.boolean() }).strict()),
  initialSpells: z.array(keyOfKind('spell')),
  rules: z.object({ talentsUnlockLevel: pos, milestones: z.array(pos), dualLevel: pos, maxLevel: pos, pointsPerLevel: pos, milestoneBonusPoints: nat, rowPoints: pos, resetCost: nat, dualCost: nat, switchCost: nat, stanceRetainedRage: nat, stanceCooldownMs: pos, hunterApproachMs: pos, deepWoundsTicks: pos, deepWoundsIntervalMs: pos, rageDamageDealtDivisor: pos, rageDamageTakenDivisor: pos, damageBps: z.record(nat), takenBps: z.record(nat), threatBps: z.record(nat), critBps: z.record(nat) }).strict(),
  evidence: z.array(packetEvidenceSchema), gaps: z.array(z.string()),
}).strict();
export type ClassCatalog = z.infer<typeof classCatalogSchema>;
export type ClassSnapshot = z.infer<typeof classSnapshotSchema>;
