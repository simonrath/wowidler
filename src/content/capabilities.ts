import { combatStatsSchema, entitySchema, type CatalogEntry, type Entity, contentPacketSchema, type ContentPacket, type CapabilitySet } from '../domain/content';
import type { Result, Validation, Issue } from '../domain/result';
import type { EntityKey } from '../domain/ids';
import { baseFields, combatFields, isNormalized, materialize } from './provenance';

/** Hostile templates cannot evade required combat values through an imported usage/playable flag. */
export const combatKinds = new Set(['npc', 'boss', 'worldBoss', 'encounter']);
export function requirePlayable(entry: CatalogEntry): Result<Entity> {
  const fail = (message: string): Result<Entity> => ({ ok: false, error: { code: 'unplayable-content', message } });
  const data = isNormalized(entry) ? materialize(entry) : entry;
  const combatRequired = (combatKinds.has(entry.kind) && !(entry.kind === 'npc' && data.npcRole === 'civilian')) || (Array.isArray(data.usage) && data.usage.includes('combat'));
  if (isNormalized(entry)) {
    const required: readonly string[] = combatRequired ? [...baseFields, ...combatFields] : baseFields;
    if (required.some(field => !['verified', 'derived'].includes(entry.fields[field]?.status))) return fail(`Required evidence missing or conflicting: ${entry.key}`);
    if (Object.values(entry.fields).some(f => f.status === 'conflicting' || (f.status === 'missing' && f.candidates.length > 0))) return fail(`Unresolved candidate evidence: ${entry.key}`);
  }
  if (combatRequired && !combatStatsSchema.safeParse(data.combat).success) return fail(`Explicit complete combat values required: ${entry.key}`);
  const parsed = entitySchema.safeParse(data);
  if (!parsed.success) return fail(`Incomplete or invalid entity: ${entry.key}`);
  if (parsed.data.availability !== 'available' || parsed.data.implementation !== 'playable' || parsed.data.dataMaturity !== 'verified') return fail(`Entity is not playable: ${entry.key}`);
  return { ok: true, value: parsed.data };
}

/** Executed by T07 and proven in tests/combat/resolution.test.ts; not a claim of live-server fidelity. */
export const starterCapabilities: CapabilitySet = { effectTypes: ['next-melee', 'create-item'] };
/** Engine primitives do not admit additional sourced spells: packet admission stays independently gated. */
export const combatCapabilityEvidence = {
  damage: 'applies immunity, armor then absorption and counts only actual damage as threat',
  heal: 'charges once at cast start, waits for cast time, enforces GCD and does not mutate input',
  interrupt: 'an interrupted healing spell heals zero and retains its spent cost',
  immunity: 'applies immunity, armor then absorption and counts only actual damage as threat',
  absorb: 'applies immunity, armor then absorption and counts only actual damage as threat',
  buff: 'caps aura stacks and refreshes expiry without an old expiration deleting the refresh',
  'periodic-heal': 'Priest Renew executes effective healing and engaged-enemy threat on ordered ticks; invalid living/side/zone/encounter targets stop',
  marker: 'Priest Weakened Soul blocks shield application from every caster until exact target-owned expiry',
  periodic: 'resolves expiry, zone change, DoT and simultaneous lethal hits in one atomic timestamp',
  'next-melee': 'executes the actual next-melee packet effect at swing time, preserving RNG determinism',
  'create-item': 'executes packet create-item only after recipe duration with materials, and returns pending output',
} as const;
export function validatePlayablePacket(input: ContentPacket, capabilities: CapabilitySet): Validation {
  const parsed = contentPacketSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map(({ path, message }) => ({ path, message })) };
  const packet = parsed.data, issues: Issue[] = [];
  const fail = (message: string) => issues.push({ path: [], message });
  const evidenceTargets = new Set(packet.evidence.map(e => e.target));
  const dependencyKeys = new Set(packet.dependencies.map(d => `${d.sourceId}:${d.path}:${d.sha256}`));
  if (dependencyKeys.size !== packet.dependencies.length) fail('Duplicate source dependency');
  const supportedTarget = (pointer: string) => {
    if (!pointer.startsWith('/')) return false;
    let value: unknown = packet;
    for (const part of pointer.slice(1).split('/')) {
      if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, part)) return false;
      value = (value as Record<string, unknown>)[part];
    }
    return true;
  };
  for (const evidence of packet.evidence) {
    if (!supportedTarget(evidence.target)) fail(`Evidence target absent ${evidence.target}`);
    if (evidence.sources.some(s => !dependencyKeys.has(`${s.sourceId}:${s.path}:${s.sha256}`))) fail('Evidence is not bound to a packet dependency');
    if (evidence.policy !== 'captured-forever' && !evidence.sources.some(s => s.path.startsWith('content/adaptations/'))) fail('Adopted or owned rule needs explicit adaptation provenance');
  }
  for (const section of ['entities', 'quests', 'encounters', 'spells', 'recipes', 'trainers', 'items'] as const) {
    packet[section].forEach((_, i) => { if (!evidenceTargets.has(`/${section}/${i}`)) fail(`Missing section provenance /${section}/${i}`); });
  }
  if (!evidenceTargets.has('/start')) fail('Missing starting rule provenance');
  const entities = new Map(packet.entities.map(e => [e.key, e]));
  if (entities.size !== packet.entities.length) fail('Duplicate entity key');
  const has = (key: string) => { if (!entities.has(key as EntityKey)) fail(`Missing dependency ${key}`); };
  for (const e of packet.entities) {
    if (!requirePlayable(e).ok) fail(`Unplayable entity ${e.key}`);
    if (e.npcRole === 'hostile' && !evidenceTargets.has(`/entities/${packet.entities.indexOf(e)}/combat`)) fail('Missing explicit combat provenance');
    if (e.branch !== 'forever') fail(`Packet branch differs: ${e.key}`);
    e.relationships.forEach(has); e.prerequisites?.forEach(has);
  }
  const sections = [packet.quests.map(q => q.key), packet.encounters.map(e => e.npcKey), packet.spells.map(s => s.key), packet.recipes.map(r => r.spellKey), packet.trainers.map(t => t.npcKey), packet.items.map(i => i.key)];
  for (const section of sections) if (new Set(section).size !== section.length) fail('Duplicate executable definition');
  const questKeys = new Set(packet.quests.map(q => q.key)), spellKeys = new Set(packet.spells.map(s => s.key));
  const encounterKeys = new Set(packet.encounters.map(e => e.npcKey));
  const itemKeys = new Set(packet.items.map(i => i.key));
  const item = (key: EntityKey) => { has(key); if (!itemKeys.has(key)) fail(`Missing item definition ${key}`); };
  const spell = (key: EntityKey) => { has(key); if (!spellKeys.has(key)) fail(`Missing spell definition ${key}`); };
  const trainable = new Set(packet.trainers.flatMap(t => t.teaches.map(s => s.spellKey)));
  for (const q of packet.quests) {
    has(q.key); has(q.giverKey); has(q.turnInKey);
    for (const p of q.prerequisites) { has(p); if (!questKeys.has(p)) fail(`Missing prerequisite quest ${p}`); }
    for (const o of q.objectives) { has(o.targetKey); if (o.type === 'kill' && !encounterKeys.has(o.targetKey)) fail(`Objective has no encounter ${o.targetKey}`); }
    [...q.rewards.items, ...q.rewards.choices].forEach(s => item(s.itemKey)); q.rewards.reputation.forEach(r => has(r.factionKey));
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (key: string) => {
    if (visiting.has(key)) { fail('Quest prerequisite cycle'); return; }
    if (visited.has(key)) return;
    visiting.add(key); packet.quests.find(q => q.key === key)?.prerequisites.forEach(visit); visiting.delete(key); visited.add(key);
  };
  packet.quests.forEach(q => visit(q.key));
  for (const e of packet.encounters) {
    has(e.npcKey); const npc = entities.get(e.npcKey);
    if (npc?.npcRole !== 'hostile' || !npc.combat || npc.combat.maxHealth <= 1 || npc.combat.minDamage < 1) fail(`Placeholder or incomplete enemy combat ${e.npcKey}`);
    e.loot.forEach(s => item(s.itemKey));
  }
  for (const s of packet.spells) {
    has(s.key); if (!trainable.has(s.key) && !packet.start.knownSpells.includes(s.key)) fail(`Spell not obtainable ${s.key}`);
    for (const effect of s.effects) {
      if (!capabilities.effectTypes.includes(effect.type)) fail(`Unsupported effect ${effect.type}`);
      if (effect.type === 'create-item') item(effect.itemKey);
    }
  }
  for (const r of packet.recipes) {
    spell(r.spellKey); has(r.professionKey); [...r.reagents, ...r.outputs].forEach(s => item(s.itemKey));
    if (!packet.start.professions.some(p => p.professionKey === r.professionKey && p.skill >= r.minSkill)) fail('Recipe profession is unavailable');
    const effects = packet.spells.find(s => s.key === r.spellKey)?.effects.filter(e => e.type === 'create-item') ?? [];
    if (effects.length !== r.outputs.length || !r.outputs.every(o => effects.some(e => e.itemKey === o.itemKey && e.quantity === o.quantity))) fail('Recipe output differs from executable effect');
    for (const reagent of r.reagents) if (!packet.encounters.some(e => e.loot.some(l => l.itemKey === reagent.itemKey))) fail(`Recipe material has no renewable acquisition ${reagent.itemKey}`);
  }
  // No XP-to-level or skill-gain rules exist in this packet. Only explicit starting
  // values prove reachability; later progression contracts can extend this bound.
  const reachableLevel = packet.start.level;
  for (const t of packet.trainers) {
    has(t.npcKey);
    for (const s of t.teaches) {
      spell(s.spellKey);
      const taughtSpell = packet.spells.find(candidate => candidate.key === s.spellKey);
      if (s.requiredLevel > reachableLevel || (taughtSpell && taughtSpell.minLevel > reachableLevel)) fail('Trainer level requirement unreachable');
      if (s.requiredSkill > 0) {
        const recipe = packet.recipes.find(candidate => candidate.spellKey === s.spellKey);
        const profession = recipe && packet.start.professions.find(candidate => candidate.professionKey === recipe.professionKey);
        if (!profession || profession.skill < s.requiredSkill) fail('Trainer skill requirement unreachable or unbound');
      }
      if (s.moneyCopper > packet.start.moneyCopper + packet.quests.reduce((n, q) => n + q.rewards.moneyCopper, 0)) fail('Trainer cost unreachable');
    }
  }
  packet.items.forEach(i => has(i.key)); packet.start.inventory.forEach(s => item(s.itemKey)); packet.start.knownSpells.forEach(spell); packet.start.professions.forEach(p => has(p.professionKey));
  return issues.length ? { ok: false, issues } : { ok: true };
}
