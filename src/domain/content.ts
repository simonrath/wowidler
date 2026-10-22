import type { ClassCatalog } from '../game/classes/contracts';
import { z } from 'zod';
import { branchSchema, entityKeySchema, entityKindSchema, keyOfKind, positiveIntSchema, safeIntSchema, type EntityKey } from './ids';
import type { Result } from './result';
export const sourceReferenceSchema = z.object({ sourceId: z.string().min(1), version: z.string().min(1), locator: z.string().min(1) }).strict();
/** All combat magnitudes are integer points; chance and multiplier values use basis points (10000 = 100%). */
export const combatStatsSchema = z.object({ maxHealth: positiveIntSchema, maxResource: safeIntSchema, attackPower: safeIntSchema, armor: safeIntSchema, attackIntervalMs: positiveIntSchema, minDamage: safeIntSchema, maxDamage: safeIntSchema, critChanceBps: safeIntSchema.max(10000) }).strict().refine(s => s.minDamage <= s.maxDamage, 'Damage range is reversed');
export const entitySchema = z.object({
  key: entityKeySchema, kind: entityKindSchema, branch: branchSchema, originalId: safeIntSchema,
  name: z.object({ de: z.string().min(1), en: z.string().min(1), aliases: z.array(z.string()) }).strict(),
  version: z.string().min(1), sources: z.array(sourceReferenceSchema).min(1),
  availability: z.enum(['available', 'announced', 'unavailable', 'excluded']),
  dataMaturity: z.enum(['unknown', 'partial', 'verified']), implementation: z.enum(['unsupported', 'partial', 'playable']),
  usage: z.array(z.string().min(1)), relationships: z.array(entityKeySchema), prerequisites: z.array(entityKeySchema).optional(),
  npcRole: z.enum(['hostile', 'civilian']).optional(),
  combat: combatStatsSchema.optional(),
  position: z.object({ locationKey: keyOfKind('location'), x: z.number().finite(), y: z.number().finite(), z: z.number().finite() }).strict().optional(),
}).strict().superRefine((e, ctx) => {
  if (e.npcRole && e.kind !== 'npc') ctx.addIssue({ code: 'custom', path: ['npcRole'], message: 'NPC role is only valid on NPCs' });
  if (e.npcRole === 'civilian' && e.usage.includes('combat')) ctx.addIssue({ code: 'custom', path: ['npcRole'], message: 'Civilian cannot claim combat use' });
  if (e.implementation === 'playable' && e.usage.includes('combat') && !e.combat) ctx.addIssue({ code: 'custom', path: ['combat'], message: 'Combat use requires explicit combat values' });
  if (e.key !== `${e.branch}:${e.kind}:${e.originalId}`) ctx.addIssue({ code: 'custom', path: ['key'], message: 'Key must match branch, category and original ID' });
  if (e.implementation === 'playable' && (e.usage.length === 0 || e.dataMaturity !== 'verified')) ctx.addIssue({ code: 'custom', path: ['implementation'], message: 'Playable content needs verified data and a working use' });
});
export type Entity = z.infer<typeof entitySchema>;
/** Import candidates remain separate from a complete, schema-validated playable entity. */
export interface SourceSelection { sourceId: string; path: string; sha256: string; selector: string }
export interface FieldCorrection {
  before: unknown; after: unknown; reason: string; source: SourceSelection;
  /** Idle transformations must reference a separately locked adaptation file. */
  adaptationPath?: string;
}
export interface RawFieldCandidate {
  value?: unknown; source: SourceSelection; corrections: FieldCorrection[];
  status: 'verified' | 'derived' | 'missing';
}
export interface FieldEvidence {
  status: 'verified' | 'derived' | 'missing' | 'conflicting';
  candidates: RawFieldCandidate[]; value?: unknown;
}
export type ContentIdentity = Pick<Entity, 'key' | 'kind' | 'branch' | 'originalId'>;
export interface RawEntity extends ContentIdentity {
  identitySource: SourceSelection;
  fields: Record<string, RawFieldCandidate[]>;
}
export interface NormalizedEntity extends ContentIdentity {
  normalized: true; snapshotId: string; fingerprint: string;
  fields: Record<string, FieldEvidence>;
}
export type CatalogEntry = Entity | NormalizedEntity;
export interface ContentDependency { sourceId:string;path:string;sha256:string }
export interface SourceGraphReference { from:EntityKey;field:string;selector:string;target:string;originalId:number;resolution:'captured'|'missing-entity'|'external-domain' }
export interface CatalogBuildContext { purpose:'source-evidence'; annotations:{key:EntityKey;field:string;value:boolean;source:SourceSelection}[]; persona:{faction:'Alliance'|'Horde';playerClass:string}; dependencies:ContentDependency[]; referenceGraph:SourceGraphReference[] }
export interface Catalog { readonly classes?: ClassCatalog; readonly combat?: { readonly spells: readonly CombatSpell[] }; readonly packet?: ContentPacket; readonly buildContext?:CatalogBuildContext; readonly entities: readonly CatalogEntry[]; get(key: EntityKey): CatalogEntry | undefined; requirePlayable(key: EntityKey): Result<Entity> }
export interface TestEvidence {
  key: EntityKey; fingerprint: string; testFile: string; testFileSha256: string;
  testCase: string; runId: string; executedAt: string; status: 'passed' | 'failed';
}
export interface CategoryCoverage {
  kind: Entity['kind']; included: boolean; expectedCount: number | null;
  denominatorStatus: 'unknown' | 'independent-complete'; membershipKnown: boolean;
  captured: number; connected: number; playable: number; tested: number;
  percent: number | null; missingKeys: EntityKey[];
}
export interface CoverageReport {
  snapshotId: string; categories: Record<string, CategoryCoverage>;
  complete: boolean; percent: number | null;
  gaps: { id: string; category?: string; key?: EntityKey; reason: string }[];
}
export const snapshotSpecSchema = z.object({ id: z.string().min(1), branch: branchSchema, referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), sourceVersions: z.record(z.string().min(1)), categories: z.array(z.object({ kind: entityKindSchema, expectedCount: safeIntSchema.nullable() }).strict()) }).strict();
export type SnapshotSpec = z.infer<typeof snapshotSpecSchema>;
export const raceClassCombinationSchema = z.object({ key: keyOfKind('raceClass'), raceKey: keyOfKind('race'), classKey: keyOfKind('class'), factionKey: keyOfKind('faction'), startLocationKey: keyOfKind('location'), playable: z.boolean() }).strict().refine(c => [c.raceKey, c.classKey, c.factionKey, c.startLocationKey].every(key => key.split(':')[0] === c.key.split(':')[0]), 'Combination must use one branch');
export type RaceClassCombination = z.infer<typeof raceClassCombinationSchema>;
/** Resolve allowedCombinations from the authoritative catalog, never from client command data. */
export const characterCreationSchema = z.object({ name: z.string().trim().min(2).max(24), combinationKey: keyOfKind('raceClass'), raceKey: keyOfKind('race'), classKey: keyOfKind('class'), factionKey: keyOfKind('faction'), allowedCombinations: z.array(raceClassCombinationSchema) }).strict().refine(c => c.allowedCombinations.some(a => a.playable && a.key === c.combinationKey && a.raceKey === c.raceKey && a.classKey === c.classKey && a.factionKey === c.factionKey), 'Race, class and faction combination is not playable');

/** A closed gameplay slice. Catalog evidence remains separate; these typed sections provide execution parameters. */
const packetStackSchema = z.object({ itemKey: keyOfKind('item'), quantity: positiveIntSchema }).strict();
export const packetEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('next-melee'), originalEffectType: z.literal(17), bonusDamage: safeIntSchema, resourceCost: positiveIntSchema, threatMultiplierBps: positiveIntSchema }).strict(),
  z.object({ type: z.literal('create-item'), originalEffectType: z.literal(24), itemKey: keyOfKind('item'), quantity: positiveIntSchema }).strict(),
]);
export const packetEvidenceSchema = z.object({
  target: z.string().min(1), policy: z.enum(['captured-forever', 'adopted-original112', 'owned-idle']),
  sources: z.array(z.object({ sourceId: z.string().min(1), path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/), selector: z.string().min(1) }).strict()).min(1),
  reason: z.string().min(1),
}).strict();
export const contentPacketSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().min(1), snapshotId: z.string().min(1), authenticServerCombat: z.literal(false),
  dependencies: z.array(z.object({ sourceId: z.string().min(1), path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).min(1),
  clientContext: z.object({ build: z.string().min(1), definitionRevision: z.string().regex(/^[a-f0-9]{40}$/), locale: z.literal('unknown'), hotfix: z.literal('unknown') }).strict(),
  entities: z.array(entitySchema).min(1),
  quests: z.array(z.object({
    key: keyOfKind('quest'), giverKey: keyOfKind('npc'), turnInKey: keyOfKind('npc'), prerequisites: z.array(keyOfKind('quest')),
    objectives: z.array(z.object({ type: z.enum(['kill', 'talk']), targetKey: keyOfKind('npc'), quantity: positiveIntSchema }).strict()).min(1),
    rewards: z.object({ experience: safeIntSchema, moneyCopper: safeIntSchema, items: z.array(packetStackSchema), choices: z.array(packetStackSchema), reputation: z.array(z.object({ factionKey: keyOfKind('faction'), amount: safeIntSchema }).strict()) }).strict(),
  }).strict()).min(1),
  encounters: z.array(z.object({ npcKey: keyOfKind('npc'), experience: safeIntSchema, moneyCopper: safeIntSchema, loot: z.array(packetStackSchema.extend({ chanceBps: positiveIntSchema.max(10000) }).strict()) }).strict()).min(1),
  spells: z.array(z.object({ key: keyOfKind('spell'), minLevel: positiveIntSchema, cooldownMs: safeIntSchema, effects: z.array(packetEffectSchema).min(1) }).strict()).min(1),
  recipes: z.array(z.object({ spellKey: keyOfKind('spell'), professionKey: keyOfKind('profession'), minSkill: positiveIntSchema, durationMs: positiveIntSchema, reagents: z.array(packetStackSchema).min(1), outputs: z.array(packetStackSchema).min(1) }).strict()).min(1),
  trainers: z.array(z.object({ npcKey: keyOfKind('npc'), teaches: z.array(z.object({ spellKey: keyOfKind('spell'), moneyCopper: safeIntSchema, requiredLevel: positiveIntSchema, requiredSkill: safeIntSchema }).strict()).min(1) }).strict()).min(1),
  items: z.array(z.object({ key: keyOfKind('item'), stackLimit: positiveIntSchema, use: z.enum(['material', 'craft-output', 'collectible']) }).strict()).min(1),
  start: z.object({ level: positiveIntSchema, stats: combatStatsSchema, inventory: z.array(packetStackSchema), moneyCopper: safeIntSchema, knownSpells: z.array(keyOfKind('spell')), professions: z.array(z.object({ professionKey: keyOfKind('profession'), skill: positiveIntSchema }).strict()) }).strict(),
  evidence: z.array(packetEvidenceSchema).min(1), gaps: z.array(z.string().min(1)).min(1),
}).strict();
export type ContentPacket = z.infer<typeof contentPacketSchema>;
export interface CapabilitySet { effectTypes: readonly ContentPacket['spells'][number]['effects'][number]['type'][] }
export interface EffectInventory {
  snapshotId: string; build: string; scope: 'active-packet-only';
  active: { originalSpellId: number; requiredEffectTypes: number[]; handlers: string[]; sourceRows: SourceSelection[]; limits: string[] }[];
  unsupported: { effectType: number; capturedRows: number; reason: string }[];
  gaps: string[];
}

/** Explicit Idle execution contracts; no imported spell is enabled by a missing field. */
export const schoolSchema = z.enum(['physical', 'fire', 'frost', 'shadow', 'holy', 'nature', 'arcane']);
const auraBase = { auraId: z.string().min(1), durationMs: positiveIntSchema, exclusiveGroup: z.string().min(1).optional() };
export const combatEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('damage'), amount: safeIntSchema, school: schoolSchema, threatMultiplierBps: safeIntSchema.optional() }).strict(),
  z.object({ type: z.literal('summon-totem'), templateId: z.string().min(1) }).strict(),
  z.object({ type: z.literal('summon-pet'), templateId: z.string().min(1) }).strict(),
  z.object({ type: z.literal('threat'), amount: safeIntSchema }).strict(),
  z.object({ type: z.literal('heal'), amount: safeIntSchema }).strict(),
  z.object({ type: z.literal('periodic-heal'), ...auraBase, amount: safeIntSchema, finalAmount: safeIntSchema.optional(), intervalMs: positiveIntSchema }).strict(),
  z.object({ type: z.literal('marker'), ...auraBase }).strict(),
  z.object({ type: z.literal('resource'), amount: safeIntSchema }).strict(),
  z.object({ type: z.literal('periodic-resource'), ...auraBase, amount: safeIntSchema, finalAmount: safeIntSchema.optional(), intervalMs: positiveIntSchema }).strict(),
  z.object({ type: z.literal('interrupt') }).strict(),
  z.object({ type: z.literal('absorb'), ...auraBase, amount: safeIntSchema }).strict(),
  z.object({ type: z.literal('immunity'), ...auraBase, school: schoolSchema }).strict(),
  z.object({ type: z.literal('buff'), ...auraBase, armor: safeIntSchema, attackPower: safeIntSchema.optional(), holyThreatBps: safeIntSchema.optional(), meleeThreatBps: safeIntSchema.optional(), maxStacks: positiveIntSchema }).strict(),
  z.object({ type: z.literal('periodic'), ...auraBase, amount: safeIntSchema, finalAmount: safeIntSchema.optional(), school: schoolSchema, intervalMs: positiveIntSchema }).strict(),
  z.object({ type: z.literal('next-melee'), originalEffectType: z.literal(17), bonusDamage: safeIntSchema, resourceCost: positiveIntSchema, threatMultiplierBps: positiveIntSchema }).strict(),
  z.object({ type: z.literal('create-item'), originalEffectType: z.literal(24), itemKey: keyOfKind('item'), quantity: positiveIntSchema }).strict(),
]);
export type Effect = z.infer<typeof combatEffectSchema>;
export const combatSpellSchema = z.object({ blockedByTargetAura: z.string().min(1).optional(), combo: z.enum(['builder','spender']).optional(), requiredWeapon: z.literal('dagger').optional(), key: keyOfKind('spell'), minLevel: positiveIntSchema, cooldownMs: safeIntSchema, cooldownGroup: z.string().min(1).optional(), castMs: safeIntSchema, gcdMs: safeIntSchema, resourceCost: safeIntSchema, resourceCostBps: safeIntSchema.max(10000).optional(), meleeRange: z.boolean().optional(), rangedRange: z.boolean().optional(), canCrit: z.boolean().optional(), target: z.enum(['enemy', 'ally', 'self']), sector: z.enum(['front', 'flank', 'rear']).optional(), requiredStances: z.array(z.enum(['battle','defensive','berserker'])).optional(), healthCost: safeIntSchema.optional(), reagents: z.array(z.object({ itemKey: keyOfKind('item'), quantity: positiveIntSchema }).strict()).optional(), effects: z.array(combatEffectSchema).min(1) }).strict();
export type CombatSpell = z.infer<typeof combatSpellSchema>;
