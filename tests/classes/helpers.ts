import { createCharacter, createClassCatalog, materializeCharacterActor } from '../../src/game/classes/creation';
import { makeCatalog, makeCheckpoint } from '../fixtures/factories';
export const catalog = createClassCatalog(makeCatalog());
export function warriorFixture() {
  const combo=catalog.classes.combinations.find(c=>c.raceKey==='forever:race:1' && c.classKey==='forever:class:1')!;
  const result=createCharacter({id:'hero',name:'Krieger',...combo,combinationKey:combo.key},catalog);if(!result.ok)throw Error('fixture creation failed');
  const character=result.value; character.level=60;character.moneyCopper=10000;character.knownSpells=catalog.classes.training.filter(t=>t.classKey==='forever:class:1').map(t=>t.spellKey);character.resource=50;
  character.stats={...character.stats,minDamage:10,maxDamage:10,attackPower:0,armor:0,critChanceBps:0};
  const cp=makeCheckpoint();cp.state.profile.characters=[character];
  cp.state.encounter={id:'fight',locationKey:character.locationKey,status:'running',actors:[materializeCharacterActor(character),{kind:'npc',id:'enemy',npcKey:'forever:npc:1',stats:{...character.stats,maxHealth:1000},health:1000,maxHealth:1000,resource:0,maxResource:0,nextAttackMs:0}]};
  return cp;
}
export const budget={maxEvents:10000,shouldYield:()=>false};
