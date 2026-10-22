import { describe,it,expect } from 'vitest';
import { deriveActor } from '../../src/game/classes/resources';
import { learnAbility } from '../../src/game/classes/training';
import { createCharacter,materializeCharacterActor } from '../../src/game/classes/creation';
import { allocateTalents,validateTalentAllocation,unlockDualSpec,switchSpec } from '../../src/game/classes/talents';
import { resolveAction } from '../../src/game/combat/attack';
import { applyEffects } from '../../src/game/combat/effects';
import { chooseAction } from '../../src/game/combat/tactics';
import { side,targetReason } from '../../src/game/combat/positions';
import { advance } from '../../src/game/simulation/advance';
import { scheduleEvent } from '../../src/game/simulation/queue';
import { randomInt } from '../../src/game/simulation/random';
import { gameStateSchema } from '../../src/domain/state';
import { makeCheckpoint } from '../fixtures/factories';
import { catalog,budget } from './helpers';
const key=(id:number)=>`forever:spell:${id}` as const;
function hunter(profileId='hunter-beast-mastery',allocation:Record<string,number>={}) {
 const combo=catalog.classes.combinations.find(c=>c.classKey==='forever:class:3')!;
 const made=createCharacter({id:'hero',name:'Jaegerin',...combo,combinationKey:combo.key},catalog);if(!made.ok)throw Error(made.error.message);
 const c=made.value;c.level=60;c.moneyCopper=10000;c.knownSpells=catalog.classes.training.filter(t=>t.classKey===c.classKey).map(t=>t.spellKey);
 c.stats={...c.stats,maxHealth:1000,maxResource:1000,minDamage:100,maxDamage:100,attackPower:0,armor:0,critChanceBps:0};c.health=1000;c.resource=1000;
 const cp=makeCheckpoint();cp.state.profile.characters=[c];cp.state.encounter=null;
 const allocated=allocateTalents(cp.state,{characterId:'hero',profileId,allocation},catalog);if(!allocated.ok)throw Error(allocated.error.message);cp.state=allocated.value;
 cp.state.encounter={id:'fight',locationKey:c.locationKey,status:'running',actors:[materializeCharacterActor(cp.state.profile.characters[0]),{kind:'npc',id:'enemy',npcKey:'forever:npc:1',stats:{...c.stats,maxHealth:10000},health:10000,maxHealth:10000,resource:0,maxResource:0,nextAttackMs:0}]};return cp;
}
const actor=(cp:ReturnType<typeof hunter>,id='hero')=>cp.state.encounter!.actors.find(a=>a.id===id)!;
const halt=(cp:ReturnType<typeof hunter>)=>{cp.state.profile.characters[0].rules=[{id:'halt',enabled:false,conditions:[],action:{type:'attack'}}];return cp;};
function cast(cp:ReturnType<typeof hunter>,id:number,target='enemy',duration=1){const start=resolveAction(cp,{type:'cast',actorId:'hero',targetId:target,spellKey:key(id)},catalog);expect(start.ok,start.reason).toBe(true);const end=advance(start.checkpoint,cp.simMs+duration,catalog,budget);expect(end.diagnostic).toBeUndefined();return end.checkpoint;}
function pet(cp:ReturnType<typeof hunter>){return cp.state.encounter!.actors.find(a=>a.kind==='pet')!;}
function seedForRoll(rank:number,draws=1):[number,number,number,number]{for(let i=1;i<10000;i++){const seed:[number,number,number,number]=[1,i,3,4];let state: import('../../src/domain/ids').RngState=seed;let value=0;for(let d=0;d<draws;d++){const draw=randomInt(state,d===draws-1?1:100,d===draws-1?10000:100);value=draw.value;state=draw.state;}if(value>(rank-1)*100&&value<=rank*100)return seed;}throw Error('No deterministic boundary seed');}
describe('Hunter bounded core and independent pet',()=>{
 it('retains all current Hunter ranks and three distinct executable defaults',()=>{
  const talents=catalog.classes.talents.filter(t=>t.classKey==='forever:class:3');expect(talents.length).toBeGreaterThan(45);
  expect(new Set(talents.map(t=>t.treeId))).toEqual(new Set([361,363,362]));
  expect(talents.every(t=>t.descriptions.length===t.max&&t.spells.length===t.max)).toBe(true);
  expect(talents.filter(t=>!t.handler).every(t=>t.gap.some(g=>g.includes('T23')))).toBe(true);
  const profiles=catalog.classes.profiles.filter(p=>p.classKey==='forever:class:3');expect(profiles).toHaveLength(3);
  const signatures=[];
  for(const p of profiles){const cp=hunter(p.id,p.allocation);scheduleEvent(cp,0,{type:'combat-decision',actorId:'hero'});const end=advance(cp,12000,catalog,budget);expect(end.diagnostic).toBeUndefined();expect(actor(end.checkpoint,'enemy').health).toBeLessThan(10000);expect(gameStateSchema.safeParse(end.checkpoint.state).success).toBe(true);signatures.push([actor(end.checkpoint,'enemy').health,actor(end.checkpoint).resource,!!pet(end.checkpoint)]);}
  expect(new Set(signatures.map(s=>JSON.stringify(s))).size).toBe(3);
 });
 it('Call Pet creates a non-party independent actor with its own attacks, focus, cooldowns and threat',()=>{
  const cp=cast(halt(hunter()),883,'hero');const summoned=pet(cp);expect(summoned).toBeDefined();expect(summoned).toMatchObject({ownerActorId:'hero',partySlotsConsumed:0,resource:100,health:120});expect(side(summoned)).toBe('ally');
  const end=advance(cp,6000,catalog,budget);expect(end.diagnostic).toBeUndefined();const companion=pet(end.checkpoint);
  expect(actor(end.checkpoint,'enemy').health).toBeLessThan(10000);expect(actor(end.checkpoint,'enemy').threat?.[companion.id]).toBeGreaterThan(0);expect(companion.resource).toBeLessThan(100);expect(companion.cooldowns?.[key(2649)]).toBeGreaterThan(0);expect(actor(end.checkpoint).resource).toBe(1000);
  expect(chooseAction(actor(end.checkpoint,'enemy'),end.checkpoint.state,catalog).action?.targetId).toBe(companion.id);
  expect(end.checkpoint.state.profile.characters).toHaveLength(1);expect(end.checkpoint.state.encounter!.actors.filter(a=>a.kind==='character')).toHaveLength(1);
  expect(resolveAction(end.checkpoint,{type:'cast',actorId:'hero',targetId:'hero',spellKey:key(883)},catalog).reason).toBe('pet-already-present');
 });
 it('every Endurance Training rank changes a summoned pet surviving a real incoming hit',()=>{
  let last=0;for(let rank=0;rank<=5;rank++){let cp=cast(halt(hunter('hunter-beast-mastery',rank?{'forever:talent:30002':rank}:{})),883,'hero');const companion=pet(cp);const hit=applyEffects(cp,[{type:'damage',school:'physical',amount:20}],{actorId:'enemy',targetId:companion.id},catalog);expect(hit.ok).toBe(true);const hp=pet(hit.checkpoint).health;expect(hp).toBeGreaterThan(last);last=hp;}
 });
 it('every Lethal Attacks rank changes executed auto-shot, direct shot and Raptor Strike critical outcomes',()=>{
  for(let rank=1;rank<=5;rank++)for(const mode of ['auto','shot','melee']){
   const run=(r:number)=>{const cp=halt(hunter(mode==='melee'?'hunter-survival':'hunter-marksmanship',r?{'forever:talent:31002':r}:{}));cp.rng=seedForRoll(rank,mode==='shot'?1:2);const started=resolveAction(cp,mode==='auto'?{type:'attack',actorId:'hero',targetId:'enemy'}:{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(mode==='melee'?2973:3044)},catalog);expect(started.ok).toBe(true);const done=advance(started.checkpoint,1,catalog,budget);expect(done.diagnostic).toBeUndefined();return actor(done.checkpoint,'enemy').health;};
   expect(run(rank-1)-run(rank)).toBe(mode==='auto'?100:mode==='melee'?105:20);
  }
 });
 it('every Deflection rank parries an actual incoming melee impact without damage or threat',()=>{
  for(let rank=1;rank<=5;rank++){
   const run=(r:number)=>{const cp=halt(hunter('hunter-survival',r?{'forever:talent:32002':r}:{}));cp.rng=seedForRoll(rank);const started=resolveAction(cp,{type:'attack',actorId:'enemy',targetId:'hero'},catalog);expect(started.ok).toBe(true);const done=advance(started.checkpoint,1,catalog,budget);expect(done.diagnostic).toBeUndefined();return done.checkpoint;};
   const before=run(rank-1),after=run(rank);expect(actor(before).health).toBeLessThan(1000);expect(actor(after).health).toBe(1000);expect(actor(after,'enemy').threat).toBeUndefined();
  }
 });
 it('retains the real Frenzy prerequisite but rejects its unsupported execution; supported ranks obey budgets',()=>{
  const cp=hunter(),frenzy=catalog.classes.talents.find(t=>t.key==='forever:talent:30052')!;
  expect(frenzy.prerequisite).toEqual({key:'forever:talent:30032',rank:5});expect(frenzy.handler).toBeNull();
  // Both are backlog, so this is unsupported-source-chain evidence, not positive Hunter prerequisite execution.
  expect(validateTalentAllocation(actor(cp),{'forever:talent:30052':1},catalog).ok).toBe(false);
  expect(validateTalentAllocation(actor(cp),{'forever:talent:30032':5,'forever:talent:30052':1},catalog).ok).toBe(false);
  for(const rank of [-1,1.5,6])expect(validateTalentAllocation(actor(cp),{'forever:talent:30002':rank},catalog).ok).toBe(false);
  const young=structuredClone(actor(cp));young.classState!.level=10;expect(validateTalentAllocation(young,{'forever:talent:30002':2},catalog).ok).toBe(false);
 });
 it('trains only owner ranks, preserves previous-rank gates and refreshes snapshots during class commands',()=>{
  const cp=hunter();cp.state.encounter!.status='won';const c=cp.state.profile.characters[0];c.locationKey='forever:location:1';c.knownSpells=[];cp.state.encounter!.actors[0]=materializeCharacterActor(c);
  const input={characterId:'hero',trainerId:'idle-hunter-field-trainer',spellKey:key(14281)};const before=structuredClone(cp.state);expect(learnAbility(cp.state,input,catalog).ok).toBe(false);expect(cp.state).toEqual(before);
  expect(learnAbility(cp.state,{...input,spellKey:key(2649)},catalog).ok).toBe(false);
  const rank1=learnAbility(cp.state,{...input,spellKey:key(3044)},catalog);expect(rank1.ok).toBe(true);if(!rank1.ok)return;
  const rank2=learnAbility(rank1.value,input,catalog);expect(rank2.ok).toBe(true);if(!rank2.ok)return;expect(gameStateSchema.safeParse(rank2.value).success).toBe(true);expect(rank2.value.encounter!.actors[0].classState!.knownSpells).toEqual([key(3044),key(14281)]);
  rank2.value.profile.characters[0].locationKey='forever:location:1537';const dual=unlockDualSpec(rank2.value,'hero','idle-hunter-capital-trainer',catalog);expect(dual.ok).toBe(true);if(!dual.ok)return;
  const switched=switchSpec(dual.value,'hero',1,catalog);expect(switched.ok).toBe(true);if(!switched.ok)return;expect(gameStateSchema.safeParse(switched.value).success).toBe(true);
 });
 it('Hunter ranged attacks and shots execute at ranged formation; melee strike rejects it atomically',()=>{
  const cp=halt(hunter('hunter-marksmanship'));actor(cp).position={range:'ranged',sector:'front'};
  const shot=cast(cp,3044);expect(actor(shot,'enemy').health).toBe(9980);expect(actor(shot).resource).toBe(975);
  const auto=resolveAction(cp,{type:'attack',actorId:'hero',targetId:'enemy'},catalog);expect(auto.ok).toBe(true);expect(actor(advance(auto.checkpoint,1,catalog,budget).checkpoint,'enemy').health).toBe(9900);
  const before=structuredClone(cp);expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(2973)},catalog).reason).toBe('out-of-range');expect(cp).toEqual(before);
 });
 it('pet death does not lose, owner death does, and dead pets cannot be silently recalled',()=>{
  let cp=cast(halt(hunter()),883,'hero');const companion=pet(cp);companion.health=0;scheduleEvent(cp,cp.simMs,{type:'death',actorId:companion.id});let end=advance(cp,cp.simMs,catalog,budget);expect(end.diagnostic).toBeUndefined();expect(end.checkpoint.state.encounter!.status).toBe('running');
  end=advance(end.checkpoint,1501,catalog,budget);expect(resolveAction(end.checkpoint,{type:'cast',actorId:'hero',targetId:'hero',spellKey:key(883)},catalog).reason).toBe('pet-already-present');
  cp=end.checkpoint;actor(cp).health=0;cp.state.profile.characters[0].health=0;cp.state.profile.characters[0].dead=true;scheduleEvent(cp,cp.simMs,{type:'death',actorId:'hero'});end=advance(cp,cp.simMs,catalog,budget);expect(end.checkpoint.state.encounter!.status).toBe('lost');
 });
 it('pet package and ownership fail closed on both combat participants',()=>{
  const cp=cast(halt(hunter()),883,'hero'),companion=pet(cp);const missing={...catalog,classes:undefined};
  for(const [source,target] of [[companion.id,'enemy'],['enemy',companion.id]]){expect(resolveAction(cp,{type:'attack',actorId:source,targetId:target},missing).reason).toBe('missing-class-package');expect(applyEffects(cp,[{type:'damage',amount:10,school:'physical'}],{actorId:source,targetId:target},missing).reason).toBe('missing-class-package');}
  const forged=structuredClone(cp);Object.assign(pet(forged),{ownerActorId:'enemy'});expect(gameStateSchema.safeParse(forged.state).success).toBe(false);
  const away=structuredClone(cp);away.state.profile.characters[0].locationKey='forever:location:1519';expect(targetReason(pet(away),actor(away,'enemy'),away.state,'enemy')).toBe('different-zone');
 });
 it('rejects forged pet ownership/slots/duplicates and stale Hunter class caches',()=>{
  const cp=cast(halt(hunter()),883,'hero');
  for(const patch of [{ownerActorId:'enemy'},{partySlotsConsumed:1},{classState:actor(cp).classState}]){const bad=structuredClone(cp);Object.assign(pet(bad),patch);expect(gameStateSchema.safeParse(bad.state).success).toBe(false);}
  const duplicate=structuredClone(cp);duplicate.state.encounter!.actors.push({...structuredClone(pet(cp)),id:'second-pet'});expect(gameStateSchema.safeParse(duplicate.state).success).toBe(false);
  const stale=structuredClone(cp);actor(stale).classState!.talents={'forever:talent:31002':5};const before=structuredClone(stale);expect(resolveAction(stale,{type:'attack',actorId:'hero',targetId:'enemy'},catalog).reason).toBe('invalid-class-state');expect(stale).toEqual(before);
 });
 it('unknown ranks, insufficient mana and missing reagents reject without mutation',()=>{
  const cp=halt(hunter()),c=cp.state.profile.characters[0];c.knownSpells=c.knownSpells.filter(s=>s!==key(14281));cp.state.encounter!.actors[0]=materializeCharacterActor(c);const before=structuredClone(cp);
  expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(14281)},catalog).reason).toBe('unknown-spell');expect(cp).toEqual(before);
  const reagentCatalog={...catalog,combat:{spells:catalog.combat!.spells.map(s=>s.key===key(3044)?{...s,reagents:[{itemKey:'forever:item:2589' as const,quantity:1}]}:s)}};
  expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(3044)},reagentCatalog).reason).toBe('missing-reagents');expect(cp).toEqual(before);
  actor(cp).resource=0;c.resource=0;const empty=structuredClone(cp);expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(3044)},catalog).reason).toBe('insufficient-resource');expect(cp).toEqual(empty);
 });
 it('refreshes retained pet stats atomically after combat without resurrection or a respec healing exploit',()=>{
  const cp=cast(halt(hunter()),883,'hero');cp.state.encounter!.status='won';
  pet(cp).health=60;const result=allocateTalents(cp.state,{characterId:'hero',profileId:'hunter-beast-mastery',allocation:{'forever:talent:30002':1}},catalog);expect(result.ok).toBe(true);if(!result.ok)return;
  const changed=result.value.encounter!.actors.find(a=>a.kind==='pet')!;expect(changed.maxHealth).toBe(123);expect(changed.health).toBe(61);expect(changed.cooldowns).toEqual(pet(cp).cooldowns);expect(gameStateSchema.safeParse(result.value).success).toBe(true);
  const dead=structuredClone(cp);pet(dead).health=0;const deadResult=allocateTalents(dead.state,{characterId:'hero',profileId:'hunter-beast-mastery',allocation:{'forever:talent:30002':1}},catalog);expect(deadResult.ok).toBe(true);if(deadResult.ok)expect(deadResult.value.encounter!.actors.find(a=>a.kind==='pet')!.health).toBe(0);
  cp.state.encounter!.status='running';const running=structuredClone(cp.state);expect(allocateTalents(cp.state,{characterId:'hero',profileId:'hunter-beast-mastery',allocation:{'forever:talent:30002':1}},catalog).ok).toBe(false);expect(cp.state).toEqual(running);
 });
 it('blocks direct pet effects with a dead or absent-zone owner, and stops its scheduled focus after owner death',()=>{
  const cp=cast(halt(hunter()),883,'hero');const companion=pet(cp);companion.resource=0;
  const away=structuredClone(cp);away.state.profile.characters[0].locationKey='forever:location:1519';expect(applyEffects(away,[{type:'damage',amount:10,school:'physical'}],{actorId:companion.id,targetId:'enemy'},catalog).reason).toBe('different-zone');
  actor(cp).health=0;cp.state.profile.characters[0].health=0;cp.state.profile.characters[0].dead=true;
  expect(applyEffects(cp,[{type:'damage',amount:10,school:'physical'}],{actorId:companion.id,targetId:'enemy'},catalog).reason).toBe('pet-owner-unavailable');
  scheduleEvent(cp,cp.simMs,{type:'death',actorId:'hero'});const end=advance(cp,5000,catalog,budget);expect(end.diagnostic).toBeUndefined();expect(end.checkpoint.state.encounter!.status).toBe('lost');expect(pet(end.checkpoint).resource).toBe(0);
 });
 it('uses one Arcane Shot cooldown across learned ranks',()=>{
  const cp=cast(halt(hunter('hunter-marksmanship')),14281);const later=advance(cp,1501,catalog,budget);expect(later.diagnostic).toBeUndefined();expect(resolveAction(later.checkpoint,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(3044)},catalog).reason).toBe('spell-cooldown');
 });
 it('rejects derived pet stat drift and keeps pet derivation bound to its execution package',()=>{
  const cp=cast(halt(hunter()),883,'hero');const companion=pet(cp);expect(()=>deriveActor(companion,{...catalog,classes:undefined})).toThrow();
  if(companion.kind!=='pet')throw Error('pet');companion.stats.armor+=1;
  expect(resolveAction(cp,{type:'attack',actorId:companion.id,targetId:'enemy'},catalog).reason).toBe('invalid-pet-state');
  expect(applyEffects(cp,[{type:'damage',amount:10,school:'physical'}],{actorId:'enemy',targetId:companion.id},catalog).reason).toBe('invalid-pet-state');
 });
 it('melee enemies close on the Hunter after killing its pet and continue applying real incoming pressure',()=>{
  const cp=hunter();const enemy=actor(cp,'enemy');if(enemy.kind!=='npc')throw Error('enemy');enemy.stats.minDamage=200;enemy.stats.maxDamage=200;
  scheduleEvent(cp,0,{type:'combat-decision',actorId:'hero'});scheduleEvent(cp,500,{type:'combat-decision',actorId:'enemy'});
  const killed=advance(cp,1000,catalog,budget);expect(killed.diagnostic).toBeUndefined();expect(pet(killed.checkpoint).health).toBe(0);expect(actor(killed.checkpoint).health).toBe(1000);expect(actor(killed.checkpoint).position?.range).toBe('ranged');
  const pressured=advance(killed.checkpoint,8000,catalog,budget);expect(pressured.diagnostic).toBeUndefined();expect(actor(pressured.checkpoint).health).toBeLessThan(1000);expect(actor(pressured.checkpoint).position?.range).toBe('melee');expect(actor(pressured.checkpoint,'enemy').health).toBeLessThan(actor(killed.checkpoint,'enemy').health);
  const continued=advance(pressured.checkpoint,11000,catalog,budget);expect(continued.diagnostic).toBeUndefined();expect(actor(continued.checkpoint).health).toBeLessThan(actor(pressured.checkpoint).health);
 });
 it('approach preserves ranged shots before contact and changes Hunter fallback to melee at contact',()=>{
  const cp=hunter('hunter-marksmanship');scheduleEvent(cp,0,{type:'combat-decision',actorId:'hero'});scheduleEvent(cp,0,{type:'combat-decision',actorId:'enemy'});
  const approaching=advance(cp,999,catalog,budget);expect(approaching.diagnostic).toBeUndefined();expect(actor(approaching.checkpoint).position?.range).toBe('ranged');expect(actor(approaching.checkpoint).health).toBe(1000);expect(actor(approaching.checkpoint,'enemy').health).toBeLessThan(10000);
  const contact=advance(approaching.checkpoint,1001,catalog,budget);expect(contact.diagnostic).toBeUndefined();expect(actor(contact.checkpoint).position?.range).toBe('melee');expect(actor(contact.checkpoint).health).toBeLessThan(1000);
  expect(targetReason(actor(contact.checkpoint),actor(contact.checkpoint,'enemy'),contact.checkpoint.state,'enemy',false,undefined,true)).toBe('out-of-range');
 });
 it('approach is single-pending, revalidates dead or departed targets and never moves an invalid target',()=>{
  for(const invalidation of ['dead-attacker','different-zone','friendly-attacker','missing-package']){
   const cp=halt(hunter('hunter-marksmanship'));const started=resolveAction(cp,{type:'attack',actorId:'enemy',targetId:'hero'},catalog);expect(started.ok).toBe(true);expect(actor(started.checkpoint).position?.range).toBe('ranged');
   expect(resolveAction(started.checkpoint,{type:'attack',actorId:'enemy',targetId:'hero'},catalog).reason).toBe('attack-not-ready');expect(started.scheduled.filter(e=>e.event.type==='melee-impact')).toHaveLength(1);
   if(invalidation==='dead-attacker')scheduleEvent(started.checkpoint,500,{type:'damage',actorId:'hero',targetId:'enemy',amount:10000});
   if(invalidation==='different-zone')scheduleEvent(started.checkpoint,500,{type:'arrival',characterId:'hero',locationKey:'forever:location:1519'});
   if(invalidation==='friendly-attacker'){const enemy=actor(started.checkpoint,'enemy');if(enemy.kind==='npc')enemy.allegiance='ally';}
   const bound=invalidation==='missing-package'?{...catalog,classes:undefined}:catalog;
   const end=advance(started.checkpoint,1001,bound,budget);if(invalidation==='missing-package')expect(end.diagnostic).toBeDefined();else expect(end.diagnostic).toBeUndefined();expect(actor(end.checkpoint).position?.range).toBe('ranged');expect(actor(end.checkpoint).health).toBe(1000);
  }
 });
 it('approach timing comes from the bound authored rules',()=>{
  const cp=halt(hunter('hunter-marksmanship')),bound={...catalog,classes:{...catalog.classes,rules:{...catalog.classes.rules,hunterApproachMs:2400}}};
  const started=resolveAction(cp,{type:'attack',actorId:'enemy',targetId:'hero'},bound);expect(started.ok).toBe(true);expect(started.scheduled[0].atMs).toBe(2400);
 });
 it('pet rank validation requires the complete exact spell set and queued impacts fail closed',()=>{
  for(const spells of [[],[key(2649),key(3044)],[key(2649),key(2649)]]){
   const cp=cast(halt(hunter()),883,'hero');const companion=pet(cp);if(companion.kind!=='pet')throw Error('pet');companion.knownSpells=spells;
   for(const [source,target] of [[companion.id,'enemy'],['enemy',companion.id]]){
    expect(resolveAction(cp,{type:'attack',actorId:source,targetId:target},catalog).reason).toBe('invalid-pet-state');
    expect(applyEffects(cp,[{type:'damage',amount:10,school:'physical'}],{actorId:source,targetId:target},catalog).reason).toBe('invalid-pet-state');
   }
   scheduleEvent(cp,2,{type:'melee-impact',actorId:companion.id,targetId:'enemy',bonusDamage:0,threatMultiplierBps:10000});const before=structuredClone(cp);const end=advance(cp,2,catalog,budget);expect(end.diagnostic).toBeDefined();expect(end.checkpoint).toEqual(before);expect(cp).toEqual(before);
  }
 });
 it('serializes and resumes simultaneous Hunter/pet combat identically',()=>{
  const cp=hunter();scheduleEvent(cp,0,{type:'combat-decision',actorId:'hero'});scheduleEvent(cp,0,{type:'combat-decision',actorId:'enemy'});const whole=advance(cp,12000,catalog,budget);expect(whole.diagnostic).toBeUndefined();let chunk=cp;
  while(chunk.simMs<12000){const end=advance(JSON.parse(JSON.stringify(chunk)),12000,catalog,{maxEvents:2,shouldYield:()=>false});expect(end.diagnostic).toBeUndefined();chunk=end.checkpoint;}expect(chunk).toEqual(whole.checkpoint);
 });
});
