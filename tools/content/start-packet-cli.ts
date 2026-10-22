import { mkdirSync, writeFileSync } from 'node:fs';
import { buildStartPacket, readStartPacketInputs } from './start-packet';
if (!process.argv.includes('--frozen')) throw Error('Starter build requires --frozen');
const { packet, effectInventory } = buildStartPacket(readStartPacketInputs());
const reportDirectory = `reports/content/${packet.snapshotId}`;
mkdirSync('content/authoring', { recursive: true }); mkdirSync(reportDirectory, { recursive: true });
writeFileSync('content/authoring/start-packet.json', JSON.stringify(packet, null, 2) + '\n');
writeFileSync(`${reportDirectory}/effect-inventory.json`, JSON.stringify(effectInventory, null, 2) + '\n');
console.log(JSON.stringify({ packet: packet.id, entities: packet.entities.length, quests: packet.quests.length, encounters: packet.encounters.length, spells: packet.spells.length, recipes: packet.recipes.length, authenticServerCombat: false, scope: 'closed-idle-adaptation' }));
