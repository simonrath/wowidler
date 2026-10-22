import {describe,it,expect} from 'vitest';
import {spellForActor} from '../../src/game/classes/resources';
import {randomInt} from '../../src/game/simulation/random';
import {applyEffects} from '../../src/game/combat/effects';
import {learnAbility} from '../../src/game/classes/training';
import {unlockDualSpec,switchSpec} from '../../src/game/classes/talents';
import {createCharacter,materializeCharacterActor} from '../../src/game/classes/creation';
import {allocateTalents,validateTalentAllocation} from '../../src/game/classes/talents';
import {resolveAction} from '../../src/game/combat/attack';
import {advance} from '../../src/game/simulation/advance';
import {scheduleEvent} from '../../src/game/simulation/queue';
import {gameStateSchema} from '../../src/domain/state';
import {makeCheckpoint} from '../fixtures/factories';
import {catalog,budget} from './helpers';
const key=(id:number)=>`forever:spell:${id}` as const;
function rogue(profileId='rogue-combat',allocation:Record<string,number>={}){
 const combination=catalog.classes.combinations.find(c=>c.classKey==='forever:class:4')!;
 const made=createCharacter({id:'hero',name:'Schurke',...combination,combinationKey:combination.key},catalog);if(!made.ok)throw Error(made.error.message);
 const c=made.value;c.level=60;c.moneyCopper=10000;c.knownSpells=catalog.classes.training.filter(t=>t.classKey===c.classKey).map(t=>t.spellKey);
 c.stats={...c.stats,maxHealth:10000,minDamage:100,maxDamage:100,attackPower:0,armor:0,critChanceBps:0};c.health=10000;c.resource=100;
 const cp=makeCheckpoint();cp.state.profile.characters=[c];cp.state.encounter=null;
 const allocated=allocateTalents(cp.state,{characterId:c.id,profileId,allocation},catalog);if(!allocated.ok)throw Error(allocated.error.message);cp.state=allocated.value;
 cp.state.encounter={id:'fight',locationKey:c.locationKey,status:'running',actors:[materializeCharacterActor(cp.state.profile.characters[0]),{kind:'npc',id:'enemy',npcKey:'forever:npc:1',stats:{...c.stats,maxHealth:10000},health:10000,maxHealth:10000,resource:0,maxResource:0,nextAttackMs:0}]};return cp;
}
const actor=(cp:ReturnType<typeof rogue>,id='hero')=>cp.state.encounter!.actors.find(a=>a.id===id)!;
const halt=(cp:ReturnType<typeof rogue>)=>{cp.state.profile.characters[0].rules=[{id:'halt',enabled:false,conditions:[],action:{type:'attack'}}];return cp;};
function cast(cp:ReturnType<typeof rogue>,id:number,target='enemy') {const result=resolveAction(cp,{type:'cast',actorId:'hero',targetId:target,spellKey:key(id)},catalog);expect(result.ok,result.reason).toBe(true);const end=advance(result.checkpoint,cp.simMs+1,catalog,budget);expect(end.diagnostic).toBeUndefined();return end.checkpoint;}
describe('Rogue bounded core',()=>{
 it('retains 53 current talents/ranks/prerequisites and executes three distinct profiles',()=>{
  const talents=catalog.classes.talents.filter(t=>t.classKey==='forever:class:4');expect(talents).toHaveLength(53);
  expect(talents.every(t=>t.spells.length===t.max&&t.descriptions.length===t.max)).toBe(true);
  expect(talents.filter(t=>!t.handler).every(t=>t.gap.some(g=>g.includes('T23'))&&t.gap.some(g=>g.includes('primitive')))).toBe(true);
  const signatures=[];for(const p of catalog.classes.profiles.filter(p=>p.classKey==='forever:class:4')) {const cp=rogue(p.id,p.allocation);scheduleEvent(cp,0,{type:'combat-decision',actorId:'hero'});const end=advance(cp,20000,catalog,budget);expect(end.diagnostic).toBeUndefined();expect(actor(end.checkpoint,'enemy').health).toBeLessThan(10000);expect(gameStateSchema.safeParse(end.checkpoint.state).success).toBe(true);signatures.push([actor(end.checkpoint,'enemy').health,actor(end.checkpoint).resource,actor(end.checkpoint,'enemy').auras?.map(a=>a.id)]);}
  expect(signatures).toHaveLength(3);expect(new Set(signatures.map(s=>JSON.stringify(s))).size).toBe(3);
 });
 it('Sinister Strike builds target-bound points and Eviscerate consumes only that target',()=>{
  let cp=cast(halt(rogue()),1752);expect(actor(cp).combo).toEqual({targetId:'enemy',points:1});
  cp=advance(cp,1000,catalog,budget).checkpoint;cp.state.encounter!.actors.push({...structuredClone(actor(cp,'enemy')),id:'other'});
  const before=structuredClone(cp);expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'other',spellKey:key(2098)},catalog).ok).toBe(false);expect(cp).toEqual(before);
  cp=cast(cp,2098);expect(actor(cp).combo).toBeUndefined();expect(actor(cp,'enemy').health).toBe(9889);
 });
});
describe('Rogue energy, prerequisites and executed rank effects',()=>{
 it('regenerates actual energy in ordered ticks, caps it and resumes an exhausted spender',()=>{
  const cp=rogue();actor(cp).resource=0;cp.state.profile.characters[0].resource=0;scheduleEvent(cp,0,{type:'combat-decision',actorId:'hero'});
  const early=advance(cp,1999,catalog,budget);expect(early.diagnostic).toBeUndefined();expect(actor(early.checkpoint).resource).toBe(0);
  const tick=advance(early.checkpoint,2000,catalog,budget);expect(actor(tick.checkpoint).resource).toBe(20);
  const done=advance(tick.checkpoint,12000,catalog,budget);expect(done.diagnostic).toBeUndefined();expect(actor(done.checkpoint,'enemy').health).toBeLessThan(9500);expect(actor(done.checkpoint).combo).toBeDefined();
  const idle=halt(rogue());actor(idle).resource=95;idle.state.profile.characters[0].resource=95;scheduleEvent(idle,0,{type:'combat-decision',actorId:'hero'});expect(actor(advance(idle,6000,catalog,budget).checkpoint).resource).toBe(100);
 });
 it('each Improved Sinister Strike rank changes executed energy cost',()=>{
  const spent=[];for(let rank=0;rank<=2;rank++){const cp=cast(halt(rogue('rogue-combat',rank?{'forever:talent:41001':rank}:{})),1752);spent.push(100-actor(cp).resource);}expect(spent).toEqual([45,42,40]);
 });
 it('each Improved Eviscerate rank changes actual target damage',()=>{
  const damage=[];for(let rank=0;rank<=3;rank++){const cp=halt(rogue('rogue-combat',rank?{'forever:talent:41000':rank}:{}));actor(cp).combo={targetId:'enemy',points:5};damage.push(10000-actor(cast(cp,2098),'enemy').health);}expect(damage).toEqual([28,29,31,33]);
 });
 it('each Opportunity rank changes actual rear Backstab damage',()=>{
  const damage=[];for(let rank=0;rank<=2;rank++){const cp=halt(rogue('rogue-subtlety',rank?{'forever:talent:42002':rank}:{}));damage.push(10000-actor(cast(cp,53),'enemy').health);}expect(damage).toEqual([165,173,181]);
 });
 it('Backstab enforces rear formation and the owned starter dagger boundary',()=>{
  const cp=halt(rogue());const action={type:'cast' as const,actorId:'hero',targetId:'enemy',spellKey:key(53)};expect(resolveAction(cp,action,catalog).reason).toBe('wrong-sector');
  actor(cp).position={range:'melee',sector:'rear'};const c=cp.state.profile.characters[0];c.inventory=[{instanceId:'unknown-weapon',itemKey:'forever:item:1',quantity:1}];c.equipment={mainHand:'unknown-weapon'};const before=structuredClone(cp);expect(resolveAction(cp,action,catalog).reason).toBe('unsupported-weapon');expect(cp).toEqual(before);
 });
 it('retains current prerequisites and rejects unsupported talents, invalid ranks and overspending',()=>{
  const cp=rogue(),t=catalog.classes.talents.find(t=>t.key==='forever:talent:42042')!;expect(t.prerequisite).toEqual({key:'forever:talent:42032',rank:3});expect(t.handler).toBeNull();
  const invalid:Record<`forever:talent:${number}`,number>[]=[{'forever:talent:42042':1},{'forever:talent:41000':4},{'forever:talent:41000':1.5},{'forever:talent:41000':-1}];
  for(const allocation of invalid)expect(validateTalentAllocation(actor(cp),allocation,catalog).ok).toBe(false);
  actor(cp).classState!.level=10;expect(validateTalentAllocation(actor(cp),{'forever:talent:41000':2},catalog).ok).toBe(false);
 });
 it('production advance is identical after serialization and arbitrary time slicing',()=>{
  const cp=rogue('rogue-assassination');scheduleEvent(cp,0,{type:'combat-decision',actorId:'hero'});scheduleEvent(cp,0,{type:'combat-decision',actorId:'enemy'});
  const full=advance(cp,30000,catalog,budget);expect(full.diagnostic).toBeUndefined();let sliced=cp;
  for(const time of [1,1999,2000,9017,19000,30000]){const result=advance(JSON.parse(JSON.stringify(sliced)),time,catalog,budget);expect(result.diagnostic).toBeUndefined();sliced=result.checkpoint;}expect(sliced).toEqual(full.checkpoint);expect(actor(full.checkpoint).health).toBeLessThan(10000);
 });
});
describe('Rogue lifecycle and hostile validation',()=>{
 it('caps points, resets on a builder target switch, and clears on target death',()=>{
  let cp=halt(rogue());actor(cp).combo={targetId:'enemy',points:5};cp=cast(cp,1752);expect(actor(cp).combo?.points).toBe(5);
  cp=advance(cp,1000,catalog,budget).checkpoint;cp.state.encounter!.actors.push({...structuredClone(actor(cp,'enemy')),id:'other'});cp=cast(cp,1752,'other');expect(actor(cp).combo).toEqual({targetId:'other',points:1});
  actor(cp,'other').health=0;scheduleEvent(cp,cp.simMs,{type:'death',actorId:'other'});const end=advance(cp,cp.simMs,catalog,budget);expect(end.diagnostic).toBeUndefined();expect(actor(end.checkpoint).combo).toBeUndefined();expect(end.checkpoint.state.encounter!.status).toBe('running');
 });
 it('invalid targets, unknown ranks and missing packages reject without mutating points or energy',()=>{
  for(const mode of ['dead','friendly','zone','unknown','package','sub-package']){
   const cp=halt(rogue());actor(cp).combo={targetId:'enemy',points:2};if(mode==='dead')actor(cp,'enemy').health=0;if(mode==='friendly'){const e=actor(cp,'enemy');if(e.kind==='npc')e.allegiance='ally';delete actor(cp).combo;}if(mode==='zone')cp.state.profile.characters[0].locationKey='forever:location:1519';if(mode==='unknown'){cp.state.profile.characters[0].knownSpells=[];actor(cp).classState!.knownSpells=[];}
   const bound=mode==='package'?{...catalog,classes:undefined}:mode==='sub-package'?{...catalog,classes:{...catalog.classes,rogue:undefined} as unknown as typeof catalog.classes}:catalog;
   const before=structuredClone(cp);expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(2098)},bound).ok).toBe(false);expect(cp).toEqual(before);
  }
 });
 it('revalidates spender target at completion and resumes interrupted actions',()=>{
  let cp=halt(rogue());actor(cp).combo={targetId:'enemy',points:2};const start=resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(2098)},catalog);expect(start.ok).toBe(true);
  actor(start.checkpoint,'enemy').position={range:'ranged',sector:'front'};const end=advance(start.checkpoint,1,catalog,budget);expect(end.diagnostic).toBeUndefined();expect(actor(end.checkpoint,'enemy').health).toBe(10000);expect(actor(end.checkpoint).combo?.points).toBe(2);expect(actor(end.checkpoint).casting).toBeUndefined();expect(end.checkpoint.queue.some(e=>e.event.type==='combat-decision')).toBe(true);
 });
 it('Rupture spends the exact points and distributes the entire sourced base damage',()=>{
  for(let points=1;points<=5;points++){const cp=halt(rogue());actor(cp).combo={targetId:'enemy',points};const started=cast(cp,1943);expect(actor(started).combo).toBeUndefined();const end=advance(started,17000,catalog,budget);expect(end.diagnostic).toBeUndefined();expect(10000-actor(end.checkpoint,'enemy').health).toBe([25,37,51,68,87][points-1]);}
 });
 it('does not regenerate dead, departed or ended actors; no Rogue rage gains from damage',()=>{
  for(const mode of ['dead','zone','ended']){let cp=cast(halt(rogue()),1752);if(mode==='dead'){actor(cp).health=0;cp.state.profile.characters[0].health=0;cp.state.profile.characters[0].dead=true;}if(mode==='zone')cp.state.profile.characters[0].locationKey='forever:location:1519';if(mode==='ended')cp.state.encounter!.status='won';const end=advance(cp,4000,catalog,budget);expect(end.diagnostic).toBeUndefined();expect(actor(end.checkpoint).resource).toBe(55);}
 });
 it('energy renews after the first 24 hours with exactly one tick chain',()=>{
  // Advance a valid serialized checkpoint just before its long-lived aura boundary; no 43k irrelevant full-resource ticks.
  let cp=cast(halt(rogue()),1752);const aura=actor(cp).auras!.find(a=>a.id==='idle-rogue-energy')!;
  const boundary=aura.expiresAtMs;cp.simMs=boundary-1;cp.state.combatTimeMs=cp.simMs;cp.queue=cp.queue.filter(e=>e.atMs>=boundary);
  const renewed=advance(cp,boundary,catalog,budget);expect(renewed.diagnostic).toBeUndefined();cp=renewed.checkpoint;
  expect(actor(cp).auras!.filter(a=>a.id==='idle-rogue-energy')).toHaveLength(1);expect(cp.queue.filter(e=>e.event.type==='aura-tick')).toHaveLength(1);
  const tick=advance(cp,boundary+2000,catalog,budget);expect(tick.diagnostic).toBeUndefined();expect(actor(tick.checkpoint).resource).toBe(75);
 });
 it('unknown mainhand rejects Backstab while unrelated armor does not',()=>{
  const cp=halt(rogue('rogue-subtlety')),c=cp.state.profile.characters[0];c.inventory=[{instanceId:'helmet',itemKey:'forever:item:1',quantity:1}];c.equipment={head:'helmet'};expect(actor(cast(cp,53),'enemy').health).toBe(9835);
 });
});

describe('Rogue talent critical execution and class commands',()=>{
 function seedFor(rank:number,draws:number):[number,number,number,number]{for(let i=1;i<10000;i++){const seed:[number,number,number,number]=[1,i,3,4];let rng:import('../../src/domain/ids').RngState=seed,value=0;for(let n=0;n<draws;n++){const r=randomInt(rng,n===draws-1?1:100,n===draws-1?10000:100);rng=r.state;value=r.value;}if(value>(rank-1)*100&&value<=rank*100)return seed;}throw Error('Missing boundary seed');}
 it('every Malice rank changes executed auto, builder and finisher critical outcomes',()=>{
  for(let rank=1;rank<=5;rank++)for(const spell of [0,1752,53,2098]){
   const run=(r:number)=>{const cp=halt(rogue('rogue-subtlety',r?{'forever:talent:40002':r}:{}));cp.rng=seedFor(rank,spell?1:2);actor(cp).combo={targetId:'enemy',points:5};const started=resolveAction(cp,spell?{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(spell)}:{type:'attack',actorId:'hero',targetId:'enemy'},catalog);expect(started.ok,started.reason).toBe(true);const end=advance(started.checkpoint,1,catalog,budget);expect(end.diagnostic).toBeUndefined();return actor(end.checkpoint,'enemy').health;};
   expect(run(rank-1)-run(rank)).toBe(spell===1752?103:spell===53?165:spell===2098?28:100);
  }
 });
 it('a real interrupt preserves points and schedules a legal future decision',()=>{
  const cp=rogue();actor(cp).combo={targetId:'enemy',points:3};const started=resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(2098)},catalog);expect(started.ok).toBe(true);
  const interrupted=applyEffects(started.checkpoint,[{type:'interrupt'}],{actorId:'enemy',targetId:'hero'},catalog);expect(interrupted.ok).toBe(true);expect(actor(interrupted.checkpoint).casting).toBeUndefined();expect(actor(interrupted.checkpoint).combo?.points).toBe(3);expect(interrupted.checkpoint.queue.some(e=>e.event.type==='cast-complete')).toBe(false);
  const end=advance(interrupted.checkpoint,6000,catalog,budget);expect(end.diagnostic).toBeUndefined();expect(actor(end.checkpoint,'enemy').health).toBeLessThan(10000);
 });
 it('trains only available Rogue ranks and atomically refreshes caches and spec formations',()=>{
  const cp=rogue();cp.state.encounter!.status='won';const c=cp.state.profile.characters[0];c.locationKey='forever:location:1';c.knownSpells=[];cp.state.encounter!.actors[0]=materializeCharacterActor(c);
  const input={characterId:'hero',trainerId:'idle-rogue-field-trainer',spellKey:key(53)};
  const low=structuredClone(cp.state);low.profile.characters[0].level=3;low.encounter!.actors[0]=materializeCharacterActor(low.profile.characters[0]);const before=structuredClone(low);expect(learnAbility(low,input,catalog).ok).toBe(false);expect(low).toEqual(before);
  expect(learnAbility(cp.state,{...input,spellKey:key(78)},catalog).ok).toBe(false);expect(learnAbility(cp.state,{...input,spellKey:key(1757)},catalog).ok).toBe(false);
  const learned=learnAbility(cp.state,input,catalog);expect(learned.ok).toBe(true);if(!learned.ok)return;expect(gameStateSchema.safeParse(learned.value).success).toBe(true);expect(learned.value.encounter!.actors[0].classState!.knownSpells).toEqual([key(53)]);
  learned.value.profile.characters[0].locationKey='forever:location:1537';const dual=unlockDualSpec(learned.value,'hero','idle-rogue-capital-trainer',catalog);expect(dual.ok).toBe(true);if(!dual.ok)return;
  const changed=switchSpec(dual.value,'hero',1,catalog);expect(changed.ok).toBe(true);if(!changed.ok)return;
  const allocated=allocateTalents(changed.value,{characterId:'hero',profileId:'rogue-subtlety',allocation:{'forever:talent:42002':2}},catalog);expect(allocated.ok).toBe(true);if(!allocated.ok)return;expect(gameStateSchema.safeParse(allocated.value).success).toBe(true);expect(allocated.value.encounter!.actors[0].position?.sector).toBe('rear');
 });
 it('rear Subtlety remains vulnerable to ordinary incoming melee and cannot gain damage rage',()=>{
  const cp=halt(rogue('rogue-subtlety'));actor(cp).resource=0;cp.state.profile.characters[0].resource=0;const attacked=resolveAction(cp,{type:'attack',actorId:'enemy',targetId:'hero'},catalog);expect(attacked.ok).toBe(true);const end=advance(attacked.checkpoint,1,catalog,budget);expect(end.diagnostic).toBeUndefined();expect(actor(end.checkpoint).health).toBeLessThan(10000);expect(actor(end.checkpoint).resource).toBe(0);
 });
});

it('Rogue energy wakeups keep a bounded decision queue over sustained combat',()=>{
 const cp=rogue();actor(cp,'enemy').health=1000000;actor(cp,'enemy').maxHealth=1000000;const enemy=actor(cp,'enemy');if(enemy.kind==='npc')enemy.stats.maxHealth=1000000;
 scheduleEvent(cp,0,{type:'combat-decision',actorId:'hero'});const result=advance(cp,120000,catalog,budget);expect(result.diagnostic).toBeUndefined();expect(result.reachedTarget).toBe(true);expect(result.processedEvents).toBeLessThan(1500);expect(result.checkpoint.queue.filter(e=>e.event.type==='combat-decision'&&e.event.actorId==='hero').length).toBeLessThanOrEqual(2);
});

describe('Rogue weapon projection review regression',()=>{
 function equipUnknown(cp:ReturnType<typeof rogue>){const c=cp.state.profile.characters[0];c.inventory=[{instanceId:'unknown-mainhand',itemKey:'forever:item:1',quantity:1}];c.equipment.mainHand='unknown-mainhand';}
 it('rejects assigned unknown mainHand Sinister Strike atomically, but permits empty mainHand and armor',()=>{
  const cp=halt(rogue());actor(cp).combo={targetId:'enemy',points:2};equipUnknown(cp);const before=structuredClone(cp);
  const rejected=resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(1752)},catalog);expect(rejected.ok).toBe(false);expect(rejected.reason).toBe('unsupported-weapon');expect(rejected.checkpoint).toEqual(before);expect(cp).toEqual(before);
  for(const head of [false,true]){const valid=halt(rogue());if(head){const c=valid.state.profile.characters[0];c.inventory=[{instanceId:'helmet',itemKey:'forever:item:1',quantity:1}];c.equipment.head='helmet';}const end=cast(valid,1752);expect(actor(end,'enemy').health).toBe(9897);expect(actor(end).combo?.points).toBe(1);}
 });
 it('never silently derives a weapon projection from an actor-only direct call',()=>{
  const cp=halt(rogue('rogue-subtlety'));for(const id of [1752,53]){
   const spell=catalog.combat!.spells.find(s=>s.key===key(id))!,c=cp.state.profile.characters[0];expect(()=>spellForActor(spell,actor(cp),catalog)).toThrow('unsupported-weapon');
   expect(spellForActor(spell,actor(cp),catalog,0,c).effects[0]).toMatchObject({type:'damage',amount:id===1752?103:165});
   const assigned=structuredClone(cp);equipUnknown(assigned);expect(()=>spellForActor(spell,actor(assigned),catalog,0,assigned.state.profile.characters[0])).toThrow('unsupported-weapon');
   expect(()=>spellForActor(spell,actor(cp),catalog,0,{...c,id:'another-character'})).toThrow('unsupported-weapon');
  }
 });
 it('cancels weapon-dependent completions if mainHand changes, without effects, combo changes or new costs',()=>{
  for(const id of [1752,53]){const cp=halt(rogue('rogue-subtlety'));actor(cp).combo={targetId:'enemy',points:2};const start=resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(id)},catalog);expect(start.ok).toBe(true);equipUnknown(start.checkpoint);const before=structuredClone(start.checkpoint),energy=actor(before).resource;
   const end=advance(start.checkpoint,1,catalog,budget);expect(end.diagnostic).toBeUndefined();expect(start.checkpoint).toEqual(before);expect(actor(end.checkpoint,'enemy').health).toBe(10000);expect(actor(end.checkpoint).resource).toBe(energy);expect(actor(end.checkpoint).combo).toEqual({targetId:'enemy',points:2});expect(actor(end.checkpoint).casting).toBeUndefined();expect(end.checkpoint.rng).toEqual(before.rng);expect(end.checkpoint.queue.some(e=>e.event.type==='combat-decision'&&e.event.actorId==='hero')).toBe(true);
  }
 });
});
