import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importBuildTables } from '../../tools/content/client-tables';
import { buildStartPacket, readStartPacketInputs } from '../../tools/content/start-packet';
import { validatePlayablePacket, starterCapabilities } from '../../src/content/capabilities';

const build = () => buildStartPacket(readStartPacketInputs());
describe('closed, explicitly adapted Northshire packet', () => {
  it('builds complete rewards, combat, loot, trainer and recipe dependencies from locked bytes', () => {
    const { packet, effectInventory } = build();
    expect(validatePlayablePacket(packet, starterCapabilities)).toEqual({ ok: true });
    expect(packet.quests.map(q => q.key)).toEqual(['forever:quest:783', 'forever:quest:7', 'forever:quest:15']);
    expect(packet.quests.map(q => q.rewards.experience)).toEqual([40, 170, 250]);
    expect(packet.quests.map(q => q.rewards.moneyCopper)).toEqual([0, 25, 40]);
    expect(packet.quests[1].prerequisites).toEqual(['forever:quest:783']);
    expect(packet.quests[2].prerequisites).toEqual(['forever:quest:7']);
    expect(packet.encounters.find(e => e.npcKey === 'forever:npc:94')!.loot).toEqual([{ itemKey: 'forever:item:2589', quantity: 1, chanceBps: 2992 }]);
    expect(packet.spells[0].effects).toEqual([{ type: 'next-melee', originalEffectType: 17, bonusDamage: 11, resourceCost: 15, threatMultiplierBps: 15000 }]);
    expect(packet.trainers.map(t => t.npcKey)).toEqual(['forever:npc:911', 'forever:npc:2329']);
    expect(packet.recipes[0].reagents).toEqual([{ itemKey: 'forever:item:2589', quantity: 1 }]);
    expect(packet.recipes[0].outputs).toEqual([{ itemKey: 'forever:item:1251', quantity: 1 }]);
    expect(effectInventory.active.map(e => e.originalSpellId)).toEqual([78, 3275]);
    expect(effectInventory.active.map(e => e.requiredEffectTypes)).toEqual([[17], [24]]);
    expect(effectInventory.unsupported.length).toBeGreaterThan(0);
    expect(effectInventory.unsupported.reduce((n, e) => n + e.capturedRows, 0)).toBe(42566);
  });
  it.each(['reward', 'effect', 'health', 'reference', 'recipe', 'trainer', 'cycle', 'duplicate', 'capability', 'provenance', 'recipe-output', 'material-loop', 'civilian-combat'] as const)('rejects missing or unsafe %s', fault => {
    const { packet } = build();
    if (fault === 'reward') delete (packet.quests[0] as any).rewards;
    if (fault === 'effect') (packet.spells[0].effects[0] as any).type = 'unknown-effect';
    if (fault === 'health') packet.entities.find(e => e.key === 'forever:npc:6')!.combat!.maxHealth = 1;
    if (fault === 'reference') packet.entities = packet.entities.filter(e => e.key !== 'forever:item:2589');
    if (fault === 'recipe') packet.recipes[0].reagents[0].quantity = 0;
    if (fault === 'trainer') packet.trainers[0].teaches[0].spellKey = 'forever:spell:9999999';
    if (fault === 'cycle') packet.quests[0].prerequisites = ['forever:quest:15'];
    if (fault === 'provenance') packet.evidence = packet.evidence.filter(e => e.target !== '/spells/0');
    if (fault === 'recipe-output') packet.recipes[0].outputs[0].quantity = 2;
    if (fault === 'material-loop') packet.encounters.find(e => e.npcKey === 'forever:npc:94')!.loot = [];
    if (fault === 'civilian-combat') packet.entities.find(e => e.key === 'forever:npc:6')!.npcRole = 'civilian';
    if (fault === 'duplicate') packet.entities.push(packet.entities[0]);
    expect(validatePlayablePacket(packet, fault === 'capability' ? { effectTypes: [] } : starterCapabilities).ok).toBe(false);
  });
  it.each(['level', 'skill', 'unbound-skill'] as const)('rejects unreachable trainer %s requirements', requirement => {
    const { packet } = build();
    if (requirement === 'level') packet.trainers[0].teaches[0].requiredLevel = 60;
    if (requirement === 'skill') packet.trainers[1].teaches[0].requiredSkill = 300;
    if (requirement === 'unbound-skill') packet.trainers[0].teaches[0].requiredSkill = 1;
    expect(validatePlayablePacket(packet, starterCapabilities).ok).toBe(false);
  });
  it('uses explicit starting level and matching profession skill without assuming progression', () => {
    const { packet } = build();
    expect(packet.start.level).toBe(1);
    expect(packet.evidence.find(e => e.target === '/start')?.policy).toBe('owned-idle');
    packet.trainers[0].teaches[0].requiredLevel = 2;
    expect(validatePlayablePacket(packet, starterCapabilities).ok).toBe(false);
    packet.start.level = 2;
    packet.trainers[1].teaches[0].requiredSkill = 2;
    expect(validatePlayablePacket(packet, starterCapabilities).ok).toBe(false);
    packet.start.professions.find(p => p.professionKey === 'forever:profession:129')!.skill = 2;
    expect(validatePlayablePacket(packet, starterCapabilities)).toEqual({ ok: true });
  });
  it('preserves source gaps and adopted baseline values without claiming authentic combat', () => {
    const { packet } = build();
    expect(packet.authenticServerCombat).toBe(false);
    expect(packet.gaps.join(' ')).toMatch(/hotfix/i);
    expect(packet.gaps.join(' ')).toMatch(/combat/i);
    expect(packet.evidence.some(e => e.policy === 'adopted-original112')).toBe(true);
    expect(packet.evidence.some(e => e.policy === 'owned-idle')).toBe(true);
    expect(packet.evidence.every(e => e.sources.every(s => s.sha256.length === 64 && s.selector.length > 0))).toBe(true);
  });
  it('rebuilds deterministically and checks the checked-in packet and inventory', () => {
    const result = build();
    expect(build()).toEqual(result);
    expect(JSON.parse(readFileSync('content/authoring/start-packet.json', 'utf8'))).toEqual(result.packet);
    expect(JSON.parse(readFileSync('reports/content/FOR-IDLE-2026-10-21-PUBLIC/effect-inventory.json', 'utf8'))).toEqual(result.effectInventory);
  });
});
describe('actual build-table admission', () => {
  it('requires actual bytes, matching definitions, explicit locale and hotfix state', () => {
    const { client } = readStartPacketInputs();
    const imported = importBuildTables(client);
    expect(imported.build).toBe('1.60.1.70338');
    expect(imported.tables.SpellEffect.rows.find(r => r.id === 681763)?.fields.Effect).toBe(24);
    expect(imported.locale.status).toBe('unknown');
    expect(imported.hotfix.status).toBe('unknown');
    expect(() => importBuildTables({ ...client, actualBuild: '1.60.1.70425' })).toThrow();
    expect(() => importBuildTables({ ...client, locale: undefined } as any)).toThrow();
    expect(() => importBuildTables({ ...client, hotfix: undefined } as any)).toThrow();
    expect(() => importBuildTables({ ...client, tables: [] })).toThrow();
    const bad = structuredClone(client);
    bad.tables[0].definitionBytes[0] ^= 1;
    expect(() => importBuildTables(bad)).toThrow();
    const mismatched = structuredClone(client);
    mismatched.tables[0].definition = mismatched.tables[1].definition;
    mismatched.tables[0].definitionBytes = mismatched.tables[1].definitionBytes;
    expect(() => importBuildTables(mismatched)).toThrow(/mismatch/);
    const changed = structuredClone(client);
    changed.tables[0].bytes[0] ^= 1;
    expect(() => importBuildTables(changed)).toThrow();
  });
  it('rejects a source change before interpreting gameplay or applying overrides', () => {
    const inputs = readStartPacketInputs();
    inputs.sources['data/quests.json'].bytes[0] ^= 1;
    expect(() => buildStartPacket(inputs)).toThrow();
  });
});
