import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createCharacter, materializeCharacterActor, snapshotCharacter } from '../../src/game/classes/creation';
import { allocateTalents, validateTalentAllocation, unlockDualSpec, switchSpec } from '../../src/game/classes/talents';
import { learnAbility } from '../../src/game/classes/training';
import { setStance } from '../../src/game/classes/forms';
import { deriveActor } from '../../src/game/classes/resources';
import { resolveAction } from '../../src/game/combat/attack';
import { applyEffects } from '../../src/game/combat/effects';
import { chooseAction } from '../../src/game/combat/tactics';
import { advance } from '../../src/game/simulation/advance';
import { scheduleEvent } from '../../src/game/simulation/queue';
import { randomInt } from '../../src/game/simulation/random';
import { gameStateSchema, type Checkpoint } from '../../src/domain/state';
import type { RngState } from '../../src/domain/ids';
import { makeCheckpoint } from '../fixtures/factories';
import { catalog, budget } from './helpers';
const key=(id:number)=>`forever:spell:${id}` as const;
function priest(profileId='priest-discipline',allocation:Record<string,number>={}) {
  const combo=catalog.classes.combinations.find(c=>c.raceKey==='forever:race:1'&&c.classKey==='forever:class:5')!;
  const result=createCharacter({id:'hero',name:'Priester',...combo,combinationKey:combo.key},catalog);
  if(!result.ok)throw Error(result.error.message);
  const c=result.value;c.level=60;c.moneyCopper=10000;c.knownSpells=catalog.classes.training.filter(t=>t.classKey===c.classKey).map(t=>t.spellKey);
  c.stats={...c.stats,maxHealth:1000,maxResource:2000,minDamage:10,maxDamage:10,attackPower:0,armor:0,critChanceBps:0};c.health=1000;c.resource=2000;
  const cp=makeCheckpoint();cp.state.profile.characters=[c];cp.state.encounter=null;
  const allocated=allocateTalents(cp.state,{characterId:'hero',profileId,allocation},catalog);
  expect(allocated.ok).toBe(true);if(!allocated.ok)throw Error(allocated.error.message);cp.state=allocated.value;
  cp.state.encounter={id:'fight',locationKey:c.locationKey,status:'running',actors:[materializeCharacterActor(cp.state.profile.characters[0]),{kind:'npc',id:'enemy',npcKey:'forever:npc:1',stats:{...c.stats,maxHealth:10000},health:10000,maxHealth:10000,resource:0,maxResource:0,nextAttackMs:0,threat:{ally:10}},{kind:'npc',id:'ally',allegiance:'ally',npcKey:'forever:npc:2',stats:{...c.stats},health:100,maxHealth:1000,resource:0,maxResource:2000,nextAttackMs:0}]};
  return cp;
}
const actor=(cp:Checkpoint,id='hero')=>cp.state.encounter!.actors.find(a=>a.id===id)!;
const halt=(cp:Checkpoint)=>{cp.state.profile.characters[0].rules=[{id:'halt',enabled:false,conditions:[],action:{type:'attack'}}];return cp;};
const run=(cp:Checkpoint,time:number)=>{const done=advance(cp,time,catalog,budget);expect(done.diagnostic).toBeUndefined();return done.checkpoint;};
function cast(cp:Checkpoint,id:number,targetId='ally',duration=1) {
  const result=resolveAction(cp,{type:'cast',actorId:'hero',targetId,spellKey:key(id)},catalog);expect(result.ok).toBe(true);
  return run(result.checkpoint,cp.simMs+duration);
}
function sync(cp:Checkpoint){actor(cp).classState=snapshotCharacter(cp.state.profile.characters[0]);}

describe('Priest bounded source and execution package',()=>{
  it('preserves every current talent/rank/prerequisite and twelve racial variants without upgrading source status',()=>{
    const source=JSON.parse(readFileSync('content/sources/vendor/grimoire/data/talents.json','utf8')).priest.trees;
    const talents=catalog.classes.talents.filter(t=>t.classKey==='forever:class:5');
    expect(talents).toHaveLength(source.flatMap((t:{talents:unknown[]})=>t.talents).length);
    expect(talents.filter(t=>t.handler).map(t=>t.key)).toEqual(['forever:talent:50002','forever:talent:51001','forever:talent:52000']);
    for(const tree of source) for(const t of tree.talents){const actual=talents.find(x=>x.key===`forever:talent:${t.id}`)!;expect(actual.spells).toEqual(t.spells);expect(actual.descriptions).toEqual(t.desc);expect(actual.prerequisite).toEqual(t.req?{key:`forever:talent:${t.req.id}`,rank:t.req.qty}:null);if(!actual.handler)expect(actual.gap.join(' ')).toContain('Required primitive:');}
    const racials=catalog.classes.racials.filter(r=>r.classKey==='forever:class:5');expect(racials).toHaveLength(12);expect(racials.every(r=>r.implementation==='unsupported'&&r.description.length>0)).toBe(true);
    const cp=priest();expect(validateTalentAllocation(actor(cp),{'forever:talent:52061':1},catalog).ok).toBe(false);expect(validateTalentAllocation(actor(cp),{'forever:talent:50002':6},catalog).ok).toBe(false);
  });
  it('three production tactics execute ally protection, periodic healing, and Shadow damage',()=>{
    const disc=priest(),holy=priest('priest-holy'),shadow=priest('priest-shadow');
    expect(chooseAction(actor(disc),disc.state,catalog).action).toMatchObject({targetId:'ally',spellKey:key(592)});
    expect(chooseAction(actor(holy),holy.state,catalog).action).toMatchObject({targetId:'ally',spellKey:key(6075)});
    expect(chooseAction(actor(shadow),shadow.state,catalog).action?.targetId).toBe('enemy');
    for(const cp of [disc,holy,shadow])scheduleEvent(cp,0,{type:'combat-decision',actorId:'hero'});
    const d=run(disc,1),h=run(holy,15001),s=run(shadow,5000);
    expect(actor(d,'ally').auras?.some(a=>a.effect.type==='absorb'&&a.remaining===92)).toBe(true);
    expect(actor(h,'ally').health).toBeGreaterThan(100);expect(actor(s,'enemy').health).toBeLessThan(10000);
    expect(actor(d).resource).toBe(1920);expect(actor(h).resource).toBeLessThan(2000);expect(actor(s).resource).toBeLessThan(2000);
  });
  it('Shield absorbs real incoming damage and Weakened Soul blocks every rank until exact expiry',()=>{
    let cp=cast(halt(priest()),17);const before=structuredClone(cp);
    const hit=applyEffects(cp,[{type:'damage',amount:70,school:'physical'}],{actorId:'enemy',targetId:'ally'},catalog);expect(hit.ok).toBe(true);expect(actor(hit.checkpoint,'ally').health).toBe(78);expect(actor(hit.checkpoint,'ally').auras?.find(a=>a.id==='priest-shield')?.remaining).toBe(0);
    cp=run(hit.checkpoint,4001);const rejected=resolveAction(cp,{type:'cast',actorId:'hero',targetId:'ally',spellKey:key(592)},catalog);expect(rejected.ok).toBe(false);expect(rejected.reason).toBe('target-aura-blocked');expect(rejected.checkpoint).toEqual(cp);
    cp=run(cp,15001);expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'ally',spellKey:key(592)},catalog).ok).toBe(true);expect(actor(before,'ally').health).toBe(100);
  });
  it('a target shielded between admission and completion cancels the second shield',()=>{
    const cp=halt(priest());const started=resolveAction(cp,{type:'cast',actorId:'hero',targetId:'ally',spellKey:key(17)},catalog);expect(started.ok).toBe(true);
    const injected=applyEffects(started.checkpoint,[{type:'marker',auraId:'priest-weakened-soul',durationMs:15000}],{actorId:'ally',targetId:'ally'},catalog);expect(injected.ok).toBe(true);
    const done=run(injected.checkpoint,1);expect(actor(done,'ally').auras?.some(a=>a.effect.type==='absorb')).not.toBe(true);
  });
  it('every Twin Disciplines rank changes executed Renew healing and Shadow Word: Pain damage but not absorbs',()=>{
    const heals:number[]=[],damage:number[]=[];
    for(let rank=0;rank<=5;rank++){
      const allocation:Record<string,number>=rank?{'forever:talent:50002':rank}:{};
      heals.push(actor(cast(halt(priest('priest-discipline',allocation)),6075,'ally',15001),'ally').health-100);
      damage.push(10000-actor(cast(halt(priest('priest-discipline',allocation)),970,'enemy',18001),'enemy').health);
      expect(actor(cast(halt(priest('priest-discipline',allocation)),17),'ally').auras?.find(a=>a.id==='priest-shield')?.remaining).toBe(48);
    }
    expect(heals).toEqual([125,126,127,128,130,131]);expect(damage).toEqual([108,109,110,111,112,113]);
  });
  it('every Improved Renew rank changes actual periodic healing with preserved final remainder',()=>{
    const heals=[0,1,2,3].map(rank=>actor(cast(halt(priest('priest-holy',rank?{'forever:talent:51001':rank}:{})),139,'ally',15001),'ally').health-100);
    expect(heals).toEqual([45,47,49,51]);
  });
  it('every Shadow Focus rank changes an actual seeded spell application outcome',()=>{
    for(let rank=1;rank<=5;rank++){
      let rng:RngState=[1,1,3,4];for(let b=1;b<10000;b++){const candidate:RngState=[1,b,3,4],roll=randomInt(candidate,1,10000).value;if(roll>9500+(rank-1)*100&&roll<=9500+rank*100){rng=candidate;break;}}
      const hp=[rank-1,rank].map(r=>{const cp=halt(priest('priest-shadow',r?{'forever:talent:52000':r}:{}));cp.rng=rng;return actor(cast(cp,8092,'enemy',1500),'enemy').health;});
      expect(hp).toEqual([10000,9958]);
    }
  });
  it('Renew ticks heal actual missing health, emit only effective healing threat, and stop on death/zone/encounter invalidation',()=>{
    const cp=cast(halt(priest()),139);const tick=run(cp,3001);expect(actor(tick,'ally').health).toBe(109);expect(actor(tick,'enemy').threat?.hero).toBe(4);
    for(const kind of ['dead','source-dead','zone','ended','wrong-side']){const next=structuredClone(cp);if(kind==='dead'){actor(next,'ally').health=0;}if(kind==='source-dead'){actor(next).health=0;next.state.profile.characters[0].health=0;next.state.profile.characters[0].dead=true;}if(kind==='wrong-side'){const ally=actor(next,'ally');if(ally.kind==='npc')delete ally.allegiance;}if(kind==='zone')next.state.profile.characters[0].locationKey='forever:location:1519';if(kind==='ended')next.state.encounter!.status='won';expect(actor(run(next,15001),'ally').health).toBe(kind==='dead'?0:100);}
    const full=structuredClone(cp);actor(full,'ally').health=1000;const done=run(full,3001);expect(actor(done,'enemy').threat?.hero??0).toBe(0);
  });
  it('healing continues on another eligible ally and hostile melee can hit Priest after ally death',()=>{
    const cp=priest();actor(cp,'ally').health=0;actor(cp).health=500;cp.state.profile.characters[0].health=500;
    expect(chooseAction(actor(cp),cp.state,catalog).action?.targetId).toBe('hero');
    const enemyChoice=chooseAction(actor(cp,'enemy'),cp.state,catalog).action;expect(enemyChoice).toMatchObject({type:'attack',targetId:'hero'});
    const started=resolveAction(cp,enemyChoice!,catalog);expect(started.ok).toBe(true);expect(actor(run(started.checkpoint,1)).health).toBeLessThan(500);
  });
  it('missing execution package, foreign/unlearned ranks, invalid targets, and insufficient mana fail atomically',()=>{
    const cp=halt(priest());const before=structuredClone(cp);
    const missing={...catalog,classes:{...catalog.classes,definitions:catalog.classes.definitions.map(d=>d.key==='forever:class:5'?{...d,mechanics:'unsupported' as const}:d)}};
    expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'ally',spellKey:key(17)},missing).ok).toBe(false);expect(applyEffects(cp,[{type:'damage',amount:10,school:'physical'}],{actorId:'enemy',targetId:'hero'},missing).ok).toBe(false);
    for(const [id,target] of [[2050,'enemy'],[17,'enemy'],[8092,'ally'],[2061,'ally']] as const)expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:target,spellKey:key(id)},catalog).ok).toBe(false);
    const missingRule={...catalog,classes:{...catalog.classes,priest:undefined}} as unknown as typeof catalog;
    expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'ally',spellKey:key(17)},missingRule).reason).toBe('missing-class-package');expect(()=>deriveActor(actor(cp),missingRule)).toThrow('Missing supported');
    expect(cp).toEqual(before);cp.state.profile.characters[0].knownSpells.push(key(635));sync(cp);expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'ally',spellKey:key(635)},catalog).ok).toBe(false);
    actor(cp).resource=0;cp.state.profile.characters[0].resource=0;expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'ally',spellKey:key(17)},catalog).reason).toBe('insufficient-resource');
  });
  it('persistent authority rejects stale caches; training and spec refresh snapshot atomically',()=>{
    const cp=priest();cp.state.encounter!.status='won';const c=cp.state.profile.characters[0];c.knownSpells=c.knownSpells.filter(k=>k!==key(2052));sync(cp);
    const learned=learnAbility(cp.state,{characterId:'hero',trainerId:'idle-priest-field-trainer',spellKey:key(2052)},catalog);expect(learned.ok).toBe(true);if(!learned.ok)return;expect(gameStateSchema.safeParse(learned.value).success).toBe(true);expect(learned.value.encounter!.actors[0].classState?.knownSpells).toContain(key(2052));
    const allocated=allocateTalents(learned.value,{characterId:'hero',profileId:'priest-discipline',allocation:{'forever:talent:50002':5}},catalog);expect(allocated.ok).toBe(true);if(allocated.ok){expect(gameStateSchema.safeParse(allocated.value).success).toBe(true);expect(allocated.value.encounter!.actors[0].classState?.talents).toEqual({'forever:talent:50002':5});}
    c.locationKey='forever:location:1519';const dual=unlockDualSpec(cp.state,'hero','idle-priest-capital-trainer',catalog);expect(dual.ok).toBe(true);if(!dual.ok)return;dual.value.profile.characters[0].classProgress!.specs[1]={profileId:'priest-shadow',allocation:{'forever:talent:52000':5}};
    const switched=switchSpec(dual.value,'hero',1,catalog);expect(switched.ok).toBe(true);if(!switched.ok)return;expect(gameStateSchema.safeParse(switched.value).success).toBe(true);expect(switched.value.encounter!.actors[0].classState?.talents).toEqual({'forever:talent:52000':5});
    actor(cp).classState!.talents={'forever:talent:50002':5};expect(gameStateSchema.safeParse(cp.state).success).toBe(false);
  });
  it('inert Priest stance gives no Warrior multiplier and cannot be changed',()=>{
    const cp=priest();actor(cp).classState!.stance='berserker';expect(deriveActor(actor(cp),catalog)).toMatchObject({damageBps:10000,takenBps:10000,threatBps:10000});expect(deriveActor(actor(cp),catalog).stats.critChanceBps).toBe(0);cp.state.encounter=null;expect(setStance(cp.state,'hero','defensive',catalog).ok).toBe(false);
  });
  it('Shadow misses preserve mana, GCD, cooldown and one RNG draw without damage or periodic ticks',()=>{
    let seed:RngState=[1,1,3,4];for(let b=1;b<1000;b++){const next:RngState=[1,b,3,4];if(randomInt(next,1,10000).value>9500){seed=next;break;}}
    for(const id of [8092,970]) {
      const cp=halt(priest('priest-shadow'));cp.rng=seed;const end=cast(cp,id,'enemy',id===8092?1500:1);
      expect(actor(end).lastShadowApplicationResult).toEqual({spellKey:key(id),targetId:'enemy',atMs:id===8092?1500:1,outcome:'miss'});
      expect(end.rng).toEqual(randomInt(seed,1,10000).state);expect(actor(end).resource).toBe(2000-(id===8092?50:95));expect(actor(end).gcdUntilMs).toBe(1500);
      expect(actor(end).cooldowns?.[key(id)]).toBe(id===8092?8000:0);expect(actor(end,'enemy').health).toBe(10000);expect(actor(end,'enemy').auras??[]).toHaveLength(0);
      expect(end.queue.some(e=>e.event.type==='aura-tick')).toBe(false);const later=run(end,18001);expect(later.rng).toEqual(end.rng);expect(actor(later,'enemy').health).toBe(10000);
    }
    const cp=halt(priest('priest-shadow',{'forever:talent:52000':5}));cp.rng=seed;const applied=cast(cp,970,'enemy');expect(actor(applied).lastShadowApplicationResult?.outcome).toBe('hit');const final=run(applied,18001);expect(final.rng).toEqual(applied.rng);expect(actor(final,'enemy').health).toBe(9892);
  });
  it('combined Renew talents modify the stored total once; actual tick threat uses the final remainder',()=>{
    const cp=cast(halt(priest('priest-holy',{'forever:talent:50002':5,'forever:talent:51001':3})),6075);
    const aura=actor(cp,'ally').auras!.find(a=>a.id==='priest-renew')!;expect(aura.effect).toMatchObject({amount:30,finalAmount:30});
    const done=run(cp,15001);expect(actor(done,'ally').health).toBe(250);expect(actor(done,'enemy').threat?.hero).toBe(75);
    const remainder=run(cast(halt(priest('priest-holy',{'forever:talent:51001':1})),139),15001);expect(actor(remainder,'ally').health).toBe(147);expect(actor(remainder,'enemy').threat?.hero).toBe(21);
  });
  it('shield target markers from another caster block admission and redirect the protection tactic',()=>{
    const cp=priest();actor(cp).health=500;cp.state.profile.characters[0].health=500;
    const blocked=applyEffects(cp,[{type:'marker',auraId:'priest-weakened-soul',durationMs:15000}],{actorId:'ally',targetId:'ally'},catalog);expect(blocked.ok).toBe(true);
    const before=structuredClone(blocked.checkpoint);expect(resolveAction(blocked.checkpoint,{type:'cast',actorId:'hero',targetId:'ally',spellKey:key(592)},catalog).reason).toBe('target-aura-blocked');expect(blocked.checkpoint).toEqual(before);
    expect(chooseAction(actor(before),before.state,catalog).action).toMatchObject({targetId:'hero',spellKey:key(592)});
  });
  it.each([
    ['priest-holy',6075,'priest-renew',1500],
    ['priest-discipline',592,'priest-shield',15001],
  ] as const)('%s maintains its aura on the next eligible injured ally', (profileId,spellId,auraId,readyAt)=>{
    const initial=priest(profileId),rules=structuredClone(initial.state.profile.characters[0].rules);
    initial.state.encounter!.actors.push({...structuredClone(actor(initial,'ally')),id:'ally-two',health:200});
    // Establish the lowest-health ally's real aura; Shield's marker expires before its absorb.
    let cp=run(cast(halt(initial),spellId),readyAt);cp.state.profile.characters[0].rules=rules;
    expect(actor(cp,'ally').auras?.some(a=>a.id===auraId&&a.expiresAtMs>readyAt)).toBe(true);
    if(auraId==='priest-shield')expect(actor(cp,'ally').auras?.some(a=>a.id==='priest-weakened-soul')).toBe(false);
    const choice=chooseAction(actor(cp),cp.state,catalog).action;
    expect(choice).toMatchObject({type:'cast',spellKey:key(spellId),targetId:'ally-two'});
    const started=resolveAction(cp,choice!,catalog);expect(started.ok).toBe(true);
    const done=run(halt(started.checkpoint),readyAt+(auraId==='priest-renew'?3001:1));
    expect(actor(done,'ally-two').auras?.some(a=>a.id===auraId&&a.sourceId==='hero')).toBe(true);
    if(auraId==='priest-renew')expect(actor(done,'ally-two').health).toBe(225);
    else {const hit=applyEffects(done,[{type:'damage',amount:100,school:'physical'}],{actorId:'enemy',targetId:'ally-two'},catalog);expect(hit.ok).toBe(true);expect(actor(hit.checkpoint,'ally-two').health).toBe(192);}
    // Avoidance is caster-owned and active-only; it does not copy Weakened Soul's any-caster rule.
    for(const change of ['other-caster','expired'] as const){const other=structuredClone(cp),aura=actor(other,'ally').auras!.find(a=>a.id===auraId)!;if(change==='other-caster')aura.sourceId='ally';else aura.expiresAtMs=readyAt;expect(chooseAction(actor(other),other.state,catalog).action).toMatchObject({spellKey:key(spellId),targetId:'ally'});}
    const healthy=structuredClone(cp);actor(healthy,'ally-two').health=900;expect(chooseAction(actor(healthy),healthy.state,catalog).action).not.toMatchObject({spellKey:key(spellId)});
  });
  it('Renew refresh invalidates old tokens and expiry while Shield, marker and interrupts are independent',()=>{
    let cp=cast(halt(priest()),139);cp=run(cp,1500);cp=cast(cp,17);cp=run(cp,3000);cp=cast(cp,139);const afterRefresh=actor(cp,'ally').health;expect(afterRefresh).toBe(109); // The old tick at3001 precedes same-timestamp cast completion.
    cp=run(cp,4500);const started=resolveAction(cp,{type:'cast',actorId:'hero',targetId:'ally',spellKey:key(2053)},catalog);expect(started.ok).toBe(true);const interrupted=applyEffects(started.checkpoint,[{type:'interrupt'}],{actorId:'enemy',targetId:'hero'},catalog);expect(interrupted.ok).toBe(true);
    const later=run(interrupted.checkpoint,15002);expect(actor(later,'ally').health).toBe(145);expect(actor(later,'ally').auras?.some(a=>a.id==='priest-renew')).toBe(true);expect(actor(later,'ally').auras?.some(a=>a.id==='priest-shield')).toBe(true);expect(actor(later,'ally').auras?.some(a=>a.id==='priest-weakened-soul')).toBe(true);
    const end=run(later,18002);expect(actor(end,'ally').health).toBe(154);expect(actor(end,'ally').auras?.some(a=>a.id==='priest-renew')).toBe(false);expect(actor(end,'ally').auras?.some(a=>a.id==='priest-weakened-soul')).toBe(false);expect(actor(end,'ally').auras?.some(a=>a.id==='priest-shield')).toBe(true);
    expect(actor(run(end,31501),'ally').auras?.some(a=>a.id==='priest-shield')).toBe(false);
  });
  it('queued Priest ranks are revalidated and unknown ranks never become hidden passive effects',()=>{
    const cp=halt(priest());const started=resolveAction(cp,{type:'cast',actorId:'hero',targetId:'ally',spellKey:key(2053)},catalog);expect(started.ok).toBe(true);
    started.checkpoint.state.profile.characters[0].knownSpells=started.checkpoint.state.profile.characters[0].knownSpells.filter(k=>k!==key(2053));sync(started.checkpoint);const done=run(started.checkpoint,2500);expect(actor(done,'ally').health).toBe(100);expect(actor(done).resource).toBe(1925);
    const train=priest();train.state.encounter=null;const c=train.state.profile.characters[0];c.knownSpells=[];const before=structuredClone(train.state);expect(learnAbility(train.state,{characterId:'hero',trainerId:'idle-priest-field-trainer',spellKey:key(2052)},catalog).ok).toBe(false);expect(train.state).toEqual(before);
  });
  it('serialized slices preserve the periodic effect and ordered RNG result exactly',()=>{
    const cp=priest('priest-shadow',{'forever:talent:52000':2});scheduleEvent(cp,0,{type:'combat-decision',actorId:'hero'});scheduleEvent(cp,0,{type:'combat-decision',actorId:'enemy'});
    const direct=run(cp,18001);let sliced=cp;for(const t of [1,1500,3001,6001,9001,12001,15001,18001])sliced=run(JSON.parse(JSON.stringify(sliced)),t);expect(sliced).toEqual(direct);
  });
});
