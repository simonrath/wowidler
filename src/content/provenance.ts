import type { CatalogEntry, NormalizedEntity } from '../domain/content';
export type { FieldEvidence, RawEntity, NormalizedEntity, TestEvidence } from '../domain/content';

export const baseFields = ['name.de', 'name.en', 'name.aliases', 'version', 'sources', 'availability', 'dataMaturity', 'implementation', 'usage', 'relationships'] as const;
export const combatFields = ['combat.maxHealth', 'combat.maxResource', 'combat.attackPower', 'combat.armor', 'combat.attackIntervalMs', 'combat.minDamage', 'combat.maxDamage', 'combat.critChanceBps'] as const;
export const positionFields = ['position.locationKey', 'position.x', 'position.y', 'position.z'] as const;
/** Questie fields retain source semantics, including map percentages and placeholder health. */
export const questieFields = ['questie.deObjectivesText', 'questie.deSubName', 'questie.itemObjectiveFirst', 'questie.killCreditObjectiveFirst', 'questie.ammoType', 'questie.availableStartingWith', 'questie.availableUntilCompleted', 'questie.breadcrumbForQuestId', 'questie.breadcrumbs', 'questie.childQuests', 'questie.class', 'questie.disabledByQuest', 'questie.exclusiveTo', 'questie.extraObjectives', 'questie.factionID', 'questie.finishedBy', 'questie.flags', 'questie.foodType', 'questie.friendlyToFaction', 'questie.inGroupWith', 'questie.itemDrops', 'questie.itemLevel', 'questie.maxLevel', 'questie.maxLevelHealth', 'questie.minLevel', 'questie.minLevelHealth', 'questie.name', 'questie.nextQuestInChain', 'questie.npcDrops', 'questie.npcFlags', 'questie.objectDrops', 'questie.objectives', 'questie.objectivesText', 'questie.parentQuest', 'questie.preQuestGroup', 'questie.preQuestSingle', 'questie.questEnds', 'questie.questFlags', 'questie.questLevel', 'questie.questRewards', 'questie.questStarts', 'questie.rank', 'questie.relatedQuests', 'questie.reputationReward', 'questie.requiredClasses', 'questie.requiredLevel', 'questie.requiredMaxLevel', 'questie.requiredMaxRep', 'questie.requiredMinRep', 'questie.requiredRaces', 'questie.requiredRanks', 'questie.requiredSkill', 'questie.requiredSourceItems', 'questie.requiredSpecialization', 'questie.requiredSpell', 'questie.sourceItemId', 'questie.spawns', 'questie.specialFlags', 'questie.startQuest', 'questie.startedBy', 'questie.subClass', 'questie.subName', 'questie.teachesSpell', 'questie.triggerEnd', 'questie.vendors', 'questie.waypoints', 'questie.zoneID', 'questie.zoneOrSort'] as const;
export const contentFields = [...baseFields, ...combatFields, ...positionFields, 'prerequisites', 'npcRole', ...questieFields] as const;
export const identityFields = ['key', 'kind', 'branch', 'originalId'] as const;
export const isNormalized = (entry: CatalogEntry): entry is NormalizedEntity => 'normalized' in entry && entry.normalized === true;
/** Stable JSON also rejects values that JSON.stringify would silently drop or turn into null. */
export function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().filter(k => (value as Record<string, unknown>)[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  throw new Error('Evidence requires finite JSON values');
}
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); }
  return value;
}
/** Only resolved field values are materialized. Missing/conflicting fields never receive defaults. */
export function materialize(entry: NormalizedEntity): Record<string, unknown> {
  const result: Record<string, unknown> = { key: entry.key, kind: entry.kind, branch: entry.branch, originalId: entry.originalId };
  for (const field of contentFields) {
    // Source evidence remains available for explicit adapters, not automatic gameplay materialization.
    if (field.startsWith('questie.')) continue;
    const evidence = entry.fields[field];
    if (!evidence || !['verified', 'derived'].includes(evidence.status) || evidence.value === undefined) continue;
    const [parent, child] = field.split('.');
    if (child) { result[parent] ??= {}; (result[parent] as Record<string, unknown>)[child] = evidence.value; }
    else result[parent] = evidence.value;
  }
  return result;
}
