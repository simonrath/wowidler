/** Frozen, small packet compiler. No networking and no source evaluation. */
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { contentPacketSchema, type ContentPacket, type EffectInventory, type Entity, type SourceSelection } from '../../src/domain/content';
import type { EntityKey, EntityKind } from '../../src/domain/ids';
import { starterCapabilities, validatePlayablePacket } from '../../src/content/capabilities';
import { sourceLockSchema, type SourceLock } from './schema';
import { importBuildTables, tableRowSource, verifyCaptured, type BuildTableInput, type CapturedBytes } from './client-tables';

const clientNames = ['SpellEffect', 'SpellReagents', 'SkillLineAbility', 'SpellName', 'SkillLine', 'SpellMisc', 'SpellCastTimes', 'SpellPower'];
const sourcePaths = ['data/quests.json', 'data/npcs.json', 'data/minor-items.json', 'data/npc-loot.json', 'data/factions.json', 'data/abilities.json', 'data/forever/compiled/zones/elwynn-forest.json', 'content/adaptations/northshire-idle-v1.json'];
export interface StartPacketInputs { lock: SourceLock; client: BuildTableInput; sources: Record<string, CapturedBytes> }
export function readStartPacketInputs(): StartPacketInputs {
  const lock = sourceLockSchema.parse(JSON.parse(readFileSync('content/sources/lock.json', 'utf8')));
  const capture = (sourceId: string, path: string): CapturedBytes => {
    const file = lock.files.find(f => f.sourceId === sourceId && f.path === path);
    if (!file) throw Error(`Required source not locked ${path}`);
    return { file, bytes: readFileSync(file.localPath) };
  };
  const client: BuildTableInput = {
    lock, actualBuild: '1.60.1.70338', locale: { status: 'unknown', reason: 'Neither table headers nor captured extraction manifest declare locale.' },
    hotfix: { status: 'unknown', reason: 'Neither table headers nor captured extraction manifest declare applied hotfix state.' },
    manifest: capture('wow-database', 'data/forever/client-extract/manifest.json'),
    tables: clientNames.map(name => { const def = capture('wowdbdefs-70338', `definitions/${name}.dbd`); return { ...capture('wow-database', `data/forever/client-extract/${name}.jsonl.gz`), name, definition: def.file, definitionBytes: def.bytes }; }),
  };
  const sources = Object.fromEntries(sourcePaths.map(path => [path, capture(path.startsWith('content/') ? 'idle-northshire-v1' : path.startsWith('data/forever/') ? 'wow-database' : 'grimoire', path)]));
  return { lock, client, sources };
}
const integer = (value: unknown) => z.number().int().nonnegative().safe().parse(value);
const positive = (value: unknown) => z.number().int().positive().safe().parse(value);
const text = (value: unknown) => z.string().min(1).parse(value);
const key = (kind: EntityKind, id: number): EntityKey => `forever:${kind}:${positive(id)}`;
const only = <T>(values: T[], context: string): T => { if (values.length !== 1) throw Error(`Expected exactly one ${context}`); return values[0]; };
export function buildStartPacket(input: StartPacketInputs): { packet: ContentPacket; effectInventory: EffectInventory } {
  const lock = sourceLockSchema.parse(input.lock);
  if (JSON.stringify(lock) !== JSON.stringify(input.client.lock)) throw Error('Packet/client locks differ');
  const data: Record<string, any> = {};
  for (const path of sourcePaths) {
    const capture = input.sources[path]; if (!capture) throw Error(`Missing ${path}`);
    verifyCaptured(capture, lock); data[path] = JSON.parse(Buffer.from(capture.bytes).toString('utf8'));
  }
  const client = importBuildTables(input.client);
  const rulesPath = 'content/adaptations/northshire-idle-v1.json', rules = data[rulesPath];
  if (rules.snapshotId !== lock.snapshotId || rules.authenticServerCombat !== false) throw Error('Idle policy snapshot mismatch');
  const selection = (path: string, selector: string): SourceSelection => { const file = input.sources[path].file; return { sourceId: file.sourceId, path, sha256: file.sha256, selector }; };
  const own = (selector: string) => selection(rulesPath, selector);
  const evidence: ContentPacket['evidence'] = [];
  const cite = (target: string, policy: ContentPacket['evidence'][number]['policy'], sources: SourceSelection[], reason: string) => evidence.push({ target, policy, sources, reason });
  const entities: Entity[] = [];
  const entity = (kind: EntityKind, id: number, en: string, source: SourceSelection, policy: ContentPacket['evidence'][number]['policy'], usage: string[], extra: Partial<Entity> = {}) => {
    const k = key(kind, id), nameKey = `${kind}:${id}`;
    const i = entities.length;
    entities.push({ key: k, kind, branch: 'forever', originalId: id, name: { en: text(en), de: text(rules.namesDe[nameKey]), aliases: [] },
      version: rules.id, availability: 'available', dataMaturity: 'verified', implementation: 'playable', usage, relationships: [],
      sources: [source, own('/policy')].map(s => ({ sourceId: s.sourceId, version: lock.sources.find(l => l.id === s.sourceId)!.commit ?? rules.id, locator: `${s.path}#${s.selector}` })), ...extra });
    cite(`/entities/${i}`, policy, [source, own(`/namesDe/${nameKey}`), own('/policy')], 'Original identity and English name from selected record; German name and availability/use are explicit Idle authoring.');
    return k;
  };
  for (const id of z.array(z.number().int().positive()).parse(rules.npcIds)) {
    const row = z.array(z.unknown()).parse(data['data/npcs.json'][id]);
    const hostile = ['6', '257', '94'].includes(String(id));
    entity('npc', id, text(row[0]), selection('data/npcs.json', `/${id}`), 'adopted-original112', [hostile ? 'combat' : 'interaction'], { npcRole: hostile ? 'hostile' : 'civilian', ...(hostile ? { combat: rules.npcCombat[id] } : {}) });
    if (hostile) cite(`/entities/${entities.length - 1}/combat`, 'owned-idle', [own(`/npcCombat/${id}`)], rules.policy.combat);
  }
  for (const id of z.array(z.number().int().positive()).parse(rules.itemIds)) entity('item', id, text(data['data/minor-items.json'][id][0]), selection('data/minor-items.json', `/${id}`), 'adopted-original112', [id === 2589 ? 'craft-material' : 'craft-output']);
  entity('faction', 72, text(data['data/factions.json']['72'].n), selection('data/factions.json', '/72'), 'adopted-original112', ['reputation']);
  const row = (table: string, id: number) => only(client.tables[table].rows.filter(r => r.id === id), `${table}#${id}`);
  const spellRows = (table: string, id: number) => client.tables[table].rows.filter(r => r.fields.SpellID === id);
  entity('profession', 129, text(row('SkillLine', 129).fields.DisplayName_lang), tableRowSource(client, 'SkillLine', 129), 'captured-forever', ['craft']);
  for (const id of [78, 3275]) entity('spell', id, text(row('SpellName', id).fields.Name_lang), tableRowSource(client, 'SpellName', id), 'captured-forever', [id === 78 ? 'next-melee' : 'craft']);
  const quests: ContentPacket['quests'] = [];
  for (const id of z.array(z.number().int().positive()).parse(rules.questIds)) {
    const original = data['data/quests.json'] as any[];
    const record = only(original.filter(q => q.i === id), `quest${id}`), index = original.indexOf(record);
    const originalSource = selection('data/quests.json', `/${index}`);
    if (record.ch !== 'c') throw Error('Expected explicitly adopted baseline quest');
    const compiled = data['data/forever/compiled/zones/elwynn-forest.json'].quests[id];
    const rewards = compiled.index.list;
    if (rewards.id !== id || rewards.name !== record.n || compiled.detail.questId !== id) throw Error('Quest identity disagreement');
    const rewardSource = selection('data/forever/compiled/zones/elwynn-forest.json', `/quests/${id}/index/list`);
    // Empty arrays are present in this capture; absent arrays are rejected, never replaced by zero rewards.
    if (!Array.isArray(rewards.itemrewards) || !Array.isArray(rewards.itemchoices) || rewards.itemrewards.length || rewards.itemchoices.length) throw Error('Starter reward item scope changed');
    const giver = only(record.st, 'quest giver') as any[], turnIn = only(record.en, 'quest turn-in') as any[];
    if (giver[0] !== 'n' || turnIn[0] !== 'n') throw Error('Non-NPC quest interaction unsupported');
    if (id === 783 && (rules.introObjective.type !== 'talk' || rules.introObjective.targetNpcId !== turnIn[1] || record.o !== 'Speak with Marshal McBride.')) throw Error('Intro objective interpretation changed');
    const objectives: ContentPacket['quests'][number]['objectives'] = id === 783 ? [{ type: 'talk', targetKey: key('npc', positive(turnIn[1])), quantity: positive(rules.introObjective.quantity) }] : record.rq.map((o: unknown[]) => {
      if (o[0] !== 'n') throw Error('Unsupported original objective'); return { type: 'kill', targetKey: key('npc', positive(o[1])), quantity: positive(o[3]) };
    });
    const q = { key: key('quest', id), giverKey: key('npc', positive(giver[1])), turnInKey: key('npc', positive(turnIn[1])), prerequisites: record.pv === undefined ? [] : [key('quest', positive(record.pv))], objectives,
      rewards: { experience: integer(rewards.xp), moneyCopper: integer(rewards.money), items: [], choices: [], reputation: z.array(z.tuple([z.number().int().positive(), z.number().int().nonnegative()])).parse(rewards.reprewards).map(([factionId, amount]) => ({ factionKey: key('faction', factionId), amount })) } };
    const i = quests.length; quests.push(q);
    entity('quest', id, record.n, rewardSource, 'captured-forever', ['quest'], { relationships: [q.giverKey, q.turnInKey, ...objectives.map(o => o.targetKey), ...q.rewards.reputation.map(r => r.factionKey)], prerequisites: q.prerequisites });
    cite(`/quests/${i}`, 'adopted-original112', [originalSource, own('/policy/baseline'), own('/policy/scope'), ...(id === 783 ? [own('/introObjective')] : [])], 'Baseline structured objectives, givers and prerequisites explicitly adopted; source quest15 next21 is outside packet scope.');
    cite(`/quests/${i}/rewards`, 'captured-forever', [rewardSource], `Forever Wowhead snapshot ${text(compiled.detail.fetchedAt)}; explicit reward fields, not current server proof.`);
  }
  const encounters: ContentPacket['encounters'] = [6, 257, 94].map((id, index) => {
    const loot: ContentPacket['encounters'][number]['loot'] = [];
    if (id === 94) {
      const rows = data['data/npc-loot.json']['94'] as unknown[][];
      const linen = only(rows.filter(r => r[0] === 2589), 'NPC94 linen drop');
      const chanceBps = z.number().int().positive().max(10000).parse(Number(linen[1]) * 100);
      if (linen[2] !== 0) throw Error('Quest-only linen cannot supply recipe');
      if (rules.selectedLoot['94'].itemId !== 2589 || rules.selectedLoot['94'].roll !== 'independent') throw Error('Unsupported selected loot rule');
      loot.push({ itemKey: key('item', 2589), quantity: positive(rules.selectedLoot['94'].quantity), chanceBps });
      cite(`/encounters/${index}/loot`, 'adopted-original112', [selection('data/npc-loot.json', `/94/${rows.indexOf(linen)}`), own('/policy/baseline'), own('/policy/scope'), own('/selectedLoot/94')], 'Select one baseline linen drop; quantity one and independent roll are owned Idle rules. Other original drops remain outside scope.');
    }
    cite(`/encounters/${index}`, 'owned-idle', [own(`/encounterRewards/${id}`), own('/policy/scope')], 'Owned kill rewards and explicitly bounded loot selection; no invented authentic server values.');
    return { npcKey: key('npc', id), experience: integer(rules.encounterRewards[id].experience), moneyCopper: integer(rules.encounterRewards[id].moneyCopper), loot };
  });
  const heroic = only((data['data/abilities.json'].warrior as any[]).filter(s => s.id === 78), 'current Heroic Strike');
  const abilityIndex = data['data/abilities.json'].warrior.indexOf(heroic);
  const description = /^([0-9]+) Rage\. Next melee\nA strong attack that increases melee damage by ([0-9]+) and causes a high amount of threat\.$/.exec(heroic.desc);
  if (!description) throw Error('Heroic Strike description changed; explicit interpretation required');
  const strikeEffect = only(spellRows('SpellEffect', 78), 'Heroic Strike effect');
  const strikePower = only(spellRows('SpellPower', 78), 'Heroic Strike power');
  if (strikeEffect.fields.Effect !== 17 || strikeEffect.fields.EffectBasePointsF !== Number(description[2]) || strikePower.fields.PowerType !== 1 || strikePower.fields.ManaCost !== Number(description[1]) * 10) throw Error('Cross-build Heroic Strike values disagree');
  const create = only(spellRows('SpellEffect', 3275), 'bandage effect');
  if (create.fields.Effect !== 24 || create.fields.EffectItemType !== 1251 || create.fields.EffectBasePointsF !== 1) throw Error('Bandage output changed');
  const spells: ContentPacket['spells'] = [
    { key: key('spell', 78), minLevel: positive(heroic.level), cooldownMs: integer(rules.heroicStrike.cooldownMs), effects: [{ type: 'next-melee', originalEffectType: 17, bonusDamage: positive(Number(description[2])), resourceCost: positive(Number(description[1])), threatMultiplierBps: positive(rules.heroicStrike.threatMultiplierBps) }] },
    { key: key('spell', 3275), minLevel: positive(rules.recipeSpell.minLevel), cooldownMs: integer(rules.recipeSpell.cooldownMs), effects: [{ type: 'create-item', originalEffectType: 24, itemKey: key('item', positive(create.fields.EffectItemType)), quantity: positive(create.fields.EffectBasePointsF) }] },
  ];
  cite('/spells/0', 'owned-idle', [selection('data/abilities.json', `/warrior/${abilityIndex}`), tableRowSource(client, 'SpellEffect', strikeEffect.id), tableRowSource(client, 'SpellPower', strikePower.id), own('/heroicStrike'), own('/policy/effects')], 'Next-melee timing,15Rage,+11 from current70425 text corroborated by70338 rows; cooldown and quantified threat are explicit Idle rules.');
  cite('/spells/1', 'owned-idle', [tableRowSource(client, 'SpellEffect', create.id), own('/recipeSpell'), own('/policy/recipe')], 'Create-item quantity and output from matched client; spell admission is Idle curriculum.');
  const skill = only(client.tables.SkillLineAbility.rows.filter(r => r.fields.Spell === 3275), 'bandage skill');
  if (skill.fields.SkillLine !== 129) throw Error('Bandage profession mismatch');
  const reagents = only(spellRows('SpellReagents', 3275), 'bandage reagents');
  const ids = z.array(z.number().int().nonnegative()).parse(reagents.fields.Reagent), counts = z.array(z.number().int().nonnegative()).parse(reagents.fields.ReagentCount);
  if (ids.length !== counts.length || ids.some((id, i) => (id === 0) !== (counts[i] === 0))) throw Error('Invalid reagent arrays');
  const misc = only(spellRows('SpellMisc', 3275), 'bandage misc'), cast = row('SpellCastTimes', positive(misc.fields.CastingTimeIndex));
  const recipes: ContentPacket['recipes'] = [{ spellKey: key('spell', 3275), professionKey: key('profession', positive(skill.fields.SkillLine)), minSkill: positive(skill.fields.MinSkillLineRank), durationMs: positive(cast.fields.Base), reagents: ids.flatMap((id, i) => id ? [{ itemKey: key('item', id), quantity: positive(counts[i]) }] : []), outputs: [{ itemKey: key('item', positive(create.fields.EffectItemType)), quantity: positive(create.fields.EffectBasePointsF) }] }];
  cite('/recipes/0', 'captured-forever', [tableRowSource(client, 'SkillLineAbility', skill.id), tableRowSource(client, 'SpellReagents', reagents.id), tableRowSource(client, 'SpellEffect', create.id), tableRowSource(client, 'SpellMisc', misc.id), tableRowSource(client, 'SpellCastTimes', cast.id)], 'Exact client joins; acquisition is separately authored, no missing field defaults.');
  const trainers: ContentPacket['trainers'] = rules.trainers.map((t: any, i: number) => {
    cite(`/trainers/${i}`, 'owned-idle', [own(`/trainers/${i}`), selection('data/npcs.json', `/${positive(t.npcId)}`), own('/policy/curriculum')], rules.policy.curriculum);
    return { npcKey: key('npc', positive(t.npcId)), teaches: [{ spellKey: key('spell', positive(t.spellId)), moneyCopper: integer(t.moneyCopper), requiredLevel: positive(t.requiredLevel), requiredSkill: integer(t.requiredSkill) }] };
  });
  const items: ContentPacket['items'] = [2589, 1251].map((id, i) => {
    cite(`/items/${i}`, 'adopted-original112', [selection('data/minor-items.json', `/${id}`), own('/policy/baseline'), own('/policy/recipe')], 'Original stack limit explicitly adopted; bandage has craft-output use only.');
    return { key: key('item', id), stackLimit: positive(data['data/minor-items.json'][id][8]), use: id === 2589 ? 'material' : 'craft-output' };
  });
  cite('/start', 'owned-idle', [own('/start')], 'Owned starting balance, materials and profession seed.');
  const dependencies = [...Object.values(input.sources).map(c => c.file), input.client.manifest.file, ...input.client.tables.flatMap(t => [t.file, t.definition])].map(({ sourceId, path, sha256 }) => ({ sourceId, path, sha256 })).sort((a, b) => `${a.sourceId}:${a.path}`.localeCompare(`${b.sourceId}:${b.path}`));
  const packet = contentPacketSchema.parse({ schemaVersion: 1, id: rules.id, snapshotId: lock.snapshotId, authenticServerCombat: false, dependencies, clientContext: { build: client.build, definitionRevision: input.client.tables[0].definition.commit, locale: client.locale.status, hotfix: client.hotfix.status }, entities, quests, encounters, spells, recipes, trainers, items, start: rules.start, evidence, gaps: [...rules.gaps, ...client.gaps] });
  const validation = validatePlayablePacket(packet, starterCapabilities); if (!validation.ok) throw Error(JSON.stringify(validation.issues));
  const countsByType = new Map<number, number>();
  for (const r of client.tables.SpellEffect.rows) { if ([strikeEffect.id, create.id].includes(r.id)) continue; const type = integer(r.fields.Effect); countsByType.set(type, (countsByType.get(type) ?? 0) + 1); }
  const effectInventory: EffectInventory = { snapshotId: lock.snapshotId, build: client.build, scope: 'active-packet-only', active: spells.map(s => ({ originalSpellId: Number(s.key.split(':')[2]), requiredEffectTypes: s.effects.map(e => e.originalEffectType), handlers: s.effects.map(e => e.type), sourceRows: spellRows('SpellEffect', Number(s.key.split(':')[2])).map(r => tableRowSource(client, 'SpellEffect', r.id)), limits: [s.key.endsWith(':78') ? rules.policy.effects : rules.policy.recipe, 'Data contract only; simulation behavior is validated separately in T08/T23.'] })), unsupported: [...countsByType.entries()].sort(([a], [b]) => a - b).map(([effectType, capturedRows]) => ({ effectType, capturedRows, reason: [17, 24].includes(effectType) ? 'Only the explicitly joined active spell rows are admitted; all other occurrences remain unsupported.' : 'No active packet handler contract; blocked until implemented and tested.' })), gaps: packet.gaps };
  return { packet, effectInventory };
}
