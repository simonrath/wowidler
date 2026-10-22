import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createCharacter, materializeCharacterActor, snapshotCharacter } from '../../src/game/classes/creation';
import { allocateTalents, validateTalentAllocation, unlockDualSpec, switchSpec } from '../../src/game/classes/talents';
import { learnAbility } from '../../src/game/classes/training';
import { deriveActor } from '../../src/game/classes/resources';
import { resolveAction, statsFor } from '../../src/game/combat/attack';
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
function shaman(profileId='shaman-elemental',allocation:Record<string,number>={}) {
  const combo=catalog.classes.combinations.find(c=>c.raceKey==='forever:race:3'&&c.classKey==='forever:class:7')!;
  const result=createCharacter({id:'hero',name:'Schamane',...combo,combinationKey:combo.key},catalog);
  if(!result.ok)throw Error(result.error.message);
  const c=result.value;c.level=60;c.moneyCopper=10000;c.knownSpells=catalog.classes.training.filter(t=>t.classKey===c.classKey).map(t=>t.spellKey);
  c.stats={...c.stats,maxHealth:1000,maxResource:2000,minDamage:100,maxDamage:100,attackPower:0,armor:0,critChanceBps:0};c.health=1000;c.resource=2000;
  const cp=makeCheckpoint();cp.state.profile.characters=[c];cp.state.encounter=null;
  const allocated=allocateTalents(cp.state,{characterId:'hero',profileId,allocation},catalog);expect(allocated.ok).toBe(true);if(!allocated.ok)throw Error(allocated.error.message);cp.state=allocated.value;
  cp.state.encounter={id:'fight',locationKey:c.locationKey,status:'running',actors:[materializeCharacterActor(cp.state.profile.characters[0]),{kind:'npc',id:'enemy',npcKey:'forever:npc:1',stats:{...c.stats,maxHealth:10000},health:10000,maxHealth:10000,resource:0,maxResource:0,nextAttackMs:0},{kind:'npc',id:'ally',allegiance:'ally',npcKey:'forever:npc:2',stats:{...c.stats},health:100,maxHealth:1000,resource:0,maxResource:2000,nextAttackMs:0}]};
  return cp;
}
const actor=(cp:Checkpoint,id='hero')=>cp.state.encounter!.actors.find(a=>a.id===id)!;
const halt=(cp:Checkpoint)=>{cp.state.profile.characters[0].rules=[{id:'halt',enabled:false,conditions:[],action:{type:'attack'}}];return cp;};
const run=(cp:Checkpoint,time:number)=>{const done=advance(cp,time,catalog,budget);expect(done.diagnostic).toBeUndefined();return done.checkpoint;};
function cast(cp:Checkpoint,id:number,targetId='hero',duration=1) {const result=resolveAction(cp,{type:'cast',actorId:'hero',targetId,spellKey:key(id)},catalog);expect(result.ok,result.reason).toBe(true);return run(result.checkpoint,cp.simMs+duration);}
const sync=(cp:Checkpoint)=>{actor(cp).classState=snapshotCharacter(cp.state.profile.characters[0]);};

describe('Shaman bounded source and execution package',()=>{
  it('retains all current talents, ranks, exact prerequisites and explicit primitive backlog',()=>{
    const trees=JSON.parse(readFileSync('content/sources/vendor/grimoire/data/talents.json','utf8')).shaman.trees;
    const talents=catalog.classes.talents.filter(t=>t.classKey==='forever:class:7');expect(talents).toHaveLength(50);
    expect(talents.filter(t=>t.handler).map(t=>t.key)).toEqual(['forever:talent:60001','forever:talent:61001','forever:talent:62001']);
    for(const tree of trees)for(const t of tree.talents){const x=talents.find(x=>x.key===`forever:talent:${t.id}`)!;expect(x.spells).toEqual(t.spells);expect(x.descriptions).toEqual(t.desc);expect(x.prerequisite).toEqual(t.req?{key:`forever:talent:${t.req.id}`,rank:t.req.qty}:null);if(!x.handler)expect(x.gap.join(' ')).toContain('Required primitive:');}
    const cp=shaman();expect(validateTalentAllocation(actor(cp),{'forever:talent:62061':1},catalog).ok).toBe(false);expect(validateTalentAllocation(actor(cp),{'forever:talent:60001':6},catalog).ok).toBe(false);
  });
  it('three default profiles execute elemental damage, imbued melee and ally healing with real mana costs',()=>{
    const cps=['shaman-elemental','shaman-enhancement','shaman-restoration'].map(id=>shaman(id));
    const first=cps.map(cp=>chooseAction(actor(cp),cp.state,catalog).action);expect(first.map(a=>a&&'spellKey'in a?a.spellKey:undefined)).toEqual([key(3599),key(8018),key(332)]);
    for(const cp of cps)scheduleEvent(cp,0,{type:'combat-decision',actorId:'hero'});
    const [e,m,h]=cps.map(cp=>run(cp,6000));expect(actor(e,'enemy').health).toBeLessThan(10000);expect(actor(m,'enemy').health).toBeLessThan(10000);expect(actor(h,'ally').health).toBeGreaterThan(100);
    for(const cp of [e,m,h])expect(actor(cp).resource).toBeLessThan(2000);
    expect(actor(m).auras?.some(a=>a.id==='shaman-rockbiter')).toBe(true);
  });
  it('every Convection rank changes executed Lightning Bolt mana cost',()=>{
    const costs=[0,1,2,3,4,5].map(rank=>2000-actor(cast(halt(shaman('shaman-elemental',rank?{'forever:talent:60001':rank}:{})),915,'enemy',2500)).resource);
    expect(costs).toEqual([60,58,57,56,55,54]);
  });
  it('every Improved Healing Wave rank changes actual completion time and effective ally healing',()=>{
    for(let rank=0;rank<=5;rank++){const cp=halt(shaman('shaman-restoration',rank?{'forever:talent:62001':rank}:{}));const result=resolveAction(cp,{type:'cast',actorId:'hero',targetId:'ally',spellKey:key(332)},catalog);expect(result.ok).toBe(true);expect(actor(result.checkpoint).casting?.endsAtMs).toBe(2000-rank*100);expect(actor(run(result.checkpoint,1999-rank*100),'ally').health).toBe(100);expect(actor(run(result.checkpoint,2000-rank*100),'ally').health).toBe(176);}
  });
});

const totem=(cp:Checkpoint,element:string)=>cp.state.encounter!.actors.find(a=>a.kind==='totem'&&a.element===element&&a.health>0)!;
function rollSeed(low:number,high:number,melee=false):RngState {for(let b=1;b<100000;b++){const seed:RngState=[1,b,3,4];const state=melee?randomInt(seed,100,100).state:seed;const roll=randomInt(state,1,10000).value;if(roll>low&&roll<=high)return seed;}throw Error('seed unavailable');}
function equip(cp:Checkpoint,slot='mainHand'){const c=cp.state.profile.characters[0];c.inventory.push({instanceId:'assigned',itemKey:'forever:item:1',quantity:1});c.equipment[slot]='assigned';}
describe('Shaman critical effects and independent totem lifecycle',()=>{
  it('every Thundering Strikes rank changes real direct damage, healing and melee critical outcomes',()=>{
    for(let rank=1;rank<=5;rank++)for(const mode of ['bolt','heal','melee']){
      const outcomes=[rank-1,rank].map(r=>{const cp=halt(shaman('shaman-enhancement',r?{'forever:talent:61001':r}:{}));cp.rng=rollSeed((rank-1)*100,rank*100,mode==='melee');
        if(mode==='heal')return actor(cast(cp,332,'ally',2000),'ally').health-100;
        if(mode==='bolt')return 10000-actor(cast(cp,915,'enemy',2500),'enemy').health;
        const started=resolveAction(cp,{type:'attack',actorId:'hero',targetId:'enemy'},catalog);expect(started.ok).toBe(true);return 10000-actor(run(started.checkpoint,1),'enemy').health;
      });expect(outcomes).toEqual(mode==='heal'?[76,152]:mode==='bolt'?[63,126]:[100,200]);
    }
  });
  it('independent zero-slot earth/fire/water actors coexist and same-element replacement retires only that old actor',()=>{
    let cp=cast(halt(shaman()),3599);const old=totem(cp,'fire');expect(old).toMatchObject({kind:'totem',ownerActorId:'hero',partySlotsConsumed:0,health:5,resource:0,expiresAtMs:30001,nextPulseMs:2001});
    cp=cast(run(cp,1000),5394);cp=cast(run(cp,2000),8075);expect(cp.state.encounter!.actors.filter(a=>a.kind==='totem'&&a.health>0)).toHaveLength(3);
    expect(totem(cp,'water')).toMatchObject({expiresAtMs:301001});expect(totem(cp,'earth')).toMatchObject({expiresAtMs:302001});
    cp=cast(run(cp,3000),3599);expect(actor(cp,old.id).health).toBe(0);expect(totem(cp,'fire').id).not.toBe(old.id);expect(cp.state.encounter!.actors.filter(a=>a.kind==='totem'&&a.health>0)).toHaveLength(3);expect(cp.state.profile.characters).toHaveLength(1);expect(gameStateSchema.safeParse(cp.state).success).toBe(true);
    const invalid=structuredClone(cp);const t=structuredClone(totem(invalid,'water'));t.id='duplicate';invalid.state.encounter!.actors.push(t);expect(gameStateSchema.safeParse(invalid.state).success).toBe(false);
    const slots=structuredClone(cp);const unit=slots.state.encounter!.actors.find(a=>a.kind==='totem')!;Object.assign(unit,{partySlotsConsumed:1});expect(gameStateSchema.safeParse(slots.state).success).toBe(false);
    expect(resolveAction(cp,{type:'attack',actorId:totem(cp,'water').id,targetId:'enemy'},catalog).reason).toBe('totem-pulse-only');
  });
  it('Searing owns actual damage and threat, does not crit with owner talent, and stale pulses/expiry cannot affect replacement',()=>{
    let cp=cast(halt(shaman('shaman-elemental',{'forever:talent:61001':5})),3599);const old=totem(cp,'fire').id;cp=cast(run(cp,1000),3599);const current=totem(cp,'fire').id;
    cp=run(cp,2001);expect(actor(cp,'enemy').health).toBe(10000);cp=run(cp,3001);expect(actor(cp,'enemy').health).toBe(9990);expect(actor(cp,'enemy').threat?.[current]).toBe(10);expect(actor(cp,'enemy').threat?.hero).toBeUndefined();expect(actor(cp,'enemy').threat?.[old]).toBeUndefined();
    cp=run(cp,30001);expect(actor(cp,current).health).toBe(5);const hp=actor(cp,'enemy').health;cp=run(cp,31001);expect(actor(cp,current).health).toBe(0);expect(actor(cp,'enemy').health).toBe(hp);expect(cp.state.encounter!.status).toBe('running');
  });
  it('Healing Stream heals eligible group members and creates only effective healing threat after real enemy engagement',()=>{
    let cp=cast(halt(shaman('shaman-restoration')),5394);const id=totem(cp,'water').id;
    const hit=applyEffects(cp,[{type:'damage',amount:20,school:'physical'}],{actorId:'enemy',targetId:'ally'},catalog);expect(hit.ok).toBe(true);cp=hit.checkpoint;expect(actor(cp,'enemy').threat?.ally).toBe(0);
    cp=run(cp,2001);expect(actor(cp,'ally').health).toBe(85);expect(actor(cp).health).toBe(1000);expect(actor(cp,'enemy').threat?.[id]).toBe(2);expect(actor(cp,'enemy').threat?.hero).toBeUndefined();
    actor(cp,'ally').health=1000;cp=run(cp,4001);expect(actor(cp,'enemy').threat?.[id]).toBe(2);
    const wrong=actor(cp,'ally');if(wrong.kind==='npc')delete wrong.allegiance;wrong.health=1;cp=run(cp,6001);expect(actor(cp,'ally').health).toBe(1);
  });
  it('Strength of Earth increases actual ally melee and cleans old-source buffs on replacement, death and expiry',()=>{
    let cp=run(cast(halt(shaman('shaman-enhancement')),8075),2001);const old=totem(cp,'earth').id;expect(actor(cp,'ally').auras?.some(a=>a.sourceId===old&&a.effect.type==='buff'&&a.effect.attackPower===14)).toBe(true);
    expect(statsFor(actor(cp,'ally'),cp,catalog).attackPower).toBe(14);const missing={...catalog,classes:{...catalog.classes,shaman:undefined}} as unknown as typeof catalog;expect(statsFor(actor(cp,'ally'),cp,missing).attackPower).toBe(0);
    let hit=resolveAction(cp,{type:'attack',actorId:'hero',targetId:'enemy'},catalog);expect(hit.ok).toBe(true);const attacked=run(hit.checkpoint,2002);expect(actor(attacked,'enemy').health).toBe(9898);
    cp=cast(cp,8075);expect(actor(cp).auras?.some(a=>a.sourceId===old)).toBe(false);const fresh=totem(cp,'earth').id;cp=run(cp,4002);expect(actor(cp).auras?.some(a=>a.sourceId===fresh)).toBe(true);
    const kill=applyEffects(cp,[{type:'damage',amount:5,school:'physical'}],{actorId:'enemy',targetId:fresh},catalog);expect(kill.ok).toBe(true);cp=run(kill.checkpoint,4002);expect(actor(cp).auras?.some(a=>a.sourceId===fresh)).toBe(false);expect(cp.state.encounter!.status).toBe('running');
    let expiry=run(cast(halt(shaman()),8075),298001);expect(actor(expiry).auras?.some(a=>a.effect.type==='buff')).toBe(true);expiry=run(expiry,300001);expect(actor(expiry).auras?.length??0).toBe(0);expect(totem(expiry,'earth')).toBeUndefined();
  });
  it('hostile NPCs can target and kill totems, while a totem death leaves Shaman vulnerable and the encounter running',()=>{
    let cp=cast(halt(shaman()),3599);const id=totem(cp,'fire').id;actor(cp,'enemy').threat={[id]:100};const choice=chooseAction(actor(cp,'enemy'),cp.state,catalog).action;expect(choice).toMatchObject({type:'attack',targetId:id});const hit=resolveAction(cp,choice!,catalog);expect(hit.ok).toBe(true);cp=run(hit.checkpoint,2);expect(actor(cp,id).health).toBe(0);expect(cp.state.encounter!.status).toBe('running');
    actor(cp,'enemy').nextAttackMs=0;const next=chooseAction(actor(cp,'enemy'),cp.state,catalog).action;expect(next?.targetId).not.toBe(id);expect(resolveAction(cp,{type:'attack',actorId:'enemy',targetId:'hero'},catalog).ok).toBe(true);
  });
  it('owner death, departure and ended encounters stop totem damage/healing/buffs; totem package and drift fail closed',()=>{
    const base=cast(halt(shaman()),3599);
    for(const mode of ['death','zone','ended']){let cp=structuredClone(base);if(mode==='death'){actor(cp).health=0;cp.state.profile.characters[0].health=0;cp.state.profile.characters[0].dead=true;scheduleEvent(cp,2,{type:'death',actorId:'hero'});}if(mode==='zone')cp.state.profile.characters[0].locationKey='forever:location:1537';if(mode==='ended')cp.state.encounter!.status='won';cp=run(cp,4001);expect(actor(cp,'enemy').health).toBe(10000);expect(cp.state.encounter!.actors.filter(a=>a.kind==='totem'&&a.health>0)).toHaveLength(0);if(mode==='death')expect(cp.state.encounter!.status).toBe('lost');}
    const missing={...catalog,classes:{...catalog.classes,shaman:undefined}} as unknown as typeof catalog;const t=totem(base,'fire');expect(applyEffects(base,[{type:'damage',amount:1,school:'fire'}],{actorId:t.id,targetId:'enemy'},missing).reason).toBe('missing-class-package');expect(()=>deriveActor(t,missing)).toThrow('Missing supported');
    const changed=structuredClone(base);const unit=totem(changed,'fire');if(unit.kind==='totem')unit.stats.maxHealth=999;expect(applyEffects(changed,[{type:'damage',amount:1,school:'fire'}],{actorId:unit.id,targetId:'enemy'},catalog).reason).toBe('invalid-totem-state');
    const foreign=structuredClone(base);const f=totem(foreign,'fire');if(f.kind==='totem')f.ownerActorId='ally';expect(gameStateSchema.safeParse(foreign.state).success).toBe(false);
  });
  it('Rockbiter ranks replace one imbue, change real melee damage/threat, expire and never increase spell threat',()=>{
    let cp=cast(halt(shaman('shaman-enhancement')),8017);cp=cast(run(cp,1500),8018);expect(actor(cp).auras?.filter(a=>a.id==='shaman-rockbiter')).toHaveLength(1);
    const attack=resolveAction(cp,{type:'attack',actorId:'hero',targetId:'enemy'},catalog);expect(attack.ok).toBe(true);cp=run(attack.checkpoint,1502);expect(actor(cp,'enemy').health).toBe(9889);expect(actor(cp,'enemy').threat?.hero).toBe(122);
    cp=cast(run(cp,3000),915,'enemy',2500);expect(actor(cp,'enemy').health).toBe(9826);expect(actor(cp,'enemy').threat?.hero).toBe(185);
    cp=run(cp,3601501);expect(actor(cp).auras?.some(a=>a.id==='shaman-rockbiter')).toBe(false);
  });
  it('mainhand assignment rejects imbue before admission/completion and removes its benefit before a queued melee impact',()=>{
    const cp=halt(shaman());equip(cp);const before=structuredClone(cp);expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'hero',spellKey:key(8017)},catalog).reason).toBe('unsupported-weapon');expect(cp).toEqual(before);
    const start=resolveAction(halt(shaman()),{type:'cast',actorId:'hero',targetId:'hero',spellKey:key(8017)},catalog);expect(start.ok).toBe(true);equip(start.checkpoint);expect(actor(run(start.checkpoint,1)).auras?.some(a=>a.id==='shaman-rockbiter')).not.toBe(true);
    let imbued=cast(halt(shaman()),8017);const attack=resolveAction(imbued,{type:'attack',actorId:'hero',targetId:'enemy'},catalog);expect(attack.ok).toBe(true);equip(attack.checkpoint);imbued=run(attack.checkpoint,2);expect(actor(imbued,'enemy').health).toBe(9900);expect(actor(imbued,'enemy').threat?.hero).toBe(100);
    const armor=halt(shaman());equip(armor,'chest');expect(actor(cast(armor,8017)).auras?.some(a=>a.id==='shaman-rockbiter')).toBe(true);
  });
  it('serialized sliced totem execution equals a single run exactly',()=>{
    const cp=cast(halt(shaman()),3599);const full=run(cp,31001);let sliced=JSON.parse(JSON.stringify(cp)) as Checkpoint;for(const t of [1000,2001,7777,16000,30001,31001])sliced=run(JSON.parse(JSON.stringify(sliced)),t);expect(sliced).toEqual(full);
  });
});


describe('Shaman authority and transactional boundaries',()=>{
  it('rejects absent packages, unknown or foreign ranks, wrong targets, insufficient mana and invalid caches without mutation',()=>{
    const cp=halt(shaman()),before=structuredClone(cp);
    const missing={...catalog,classes:{...catalog.classes,shaman:undefined}} as unknown as typeof catalog;
    expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(403)},missing).reason).toBe('missing-class-package');expect(()=>deriveActor(actor(cp),missing)).toThrow('Missing supported');
    for(const [id,target] of [[403,'ally'],[331,'enemy'],[3599,'ally'],[17,'hero'],[421,'enemy']] as const)expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:target,spellKey:key(id)},catalog).ok).toBe(false);
    const foreign=structuredClone(cp);foreign.state.profile.characters[0].knownSpells.push(key(17));sync(foreign);expect(resolveAction(foreign,{type:'cast',actorId:'hero',targetId:'hero',spellKey:key(17)},catalog).reason).toBe('unknown-spell');
    const mana=structuredClone(cp);actor(mana).resource=0;mana.state.profile.characters[0].resource=0;expect(resolveAction(mana,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(403)},catalog).reason).toBe('insufficient-resource');
    const stale=structuredClone(cp);actor(stale).classState!.talents={'forever:talent:60001':5};expect(resolveAction(stale,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(403)},catalog).reason).toBe('invalid-class-state');expect(cp).toEqual(before);
    expect(applyEffects(cp,[{type:'periodic',auraId:'hostile-bleed',amount:5,school:'physical',durationMs:2001,intervalMs:2000}],{actorId:'enemy',targetId:'hero'},catalog).ok).toBe(true);
    const reagents={...catalog,combat:{spells:catalog.combat!.spells.map(s=>s.key===key(3599)?{...s,reagents:[{itemKey:'forever:item:1' as const,quantity:1}]}:s)}};const missingReagent=resolveAction(cp,{type:'cast',actorId:'hero',targetId:'hero',spellKey:key(3599)},reagents);expect(missingReagent.reason).toBe('missing-reagents');expect(missingReagent.checkpoint).toEqual(before);
    const tools={...catalog,classes:{...catalog.classes,shaman:{...catalog.classes.shaman,totemToolAccess:undefined}}} as unknown as typeof catalog;expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'hero',spellKey:key(3599)},tools).reason).toBe('unsupported-totem');
    const direct=structuredClone(cp);direct.state.profile.characters[0].locationKey='forever:location:1537';expect(applyEffects(direct,[{type:'damage',amount:20,school:'nature'}],{actorId:'hero',targetId:'enemy'},catalog).reason).toBe('different-zone');
  });
  it('queued Shaman spells recheck rank ownership and eligible allies before consuming effects or critical RNG',()=>{
    const cp=halt(shaman()),start=resolveAction(cp,{type:'cast',actorId:'hero',targetId:'ally',spellKey:key(332)},catalog);expect(start.ok).toBe(true);
    const next=start.checkpoint;next.state.profile.characters[0].knownSpells=next.state.profile.characters[0].knownSpells.filter(k=>k!==key(332));sync(next);const rng=[...next.rng];const done=run(next,2000);expect(actor(done,'ally').health).toBe(100);expect(done.rng).toEqual(rng);
    const profile=shaman('shaman-restoration');actor(profile,'ally').health=0;actor(profile).health=400;profile.state.profile.characters[0].health=400;expect(chooseAction(actor(profile),profile.state,catalog).action).toMatchObject({targetId:'hero',spellKey:key(332)});
    const hit=resolveAction(profile,{type:'attack',actorId:'enemy',targetId:'hero'},catalog);expect(hit.ok).toBe(true);expect(actor(run(hit.checkpoint,1)).health).toBe(300);
  });
  it('training and dual specialization refresh actor caches atomically and require the Shaman package',()=>{
    let cp=shaman();cp.state.encounter!.status='won';const c=cp.state.profile.characters[0];c.knownSpells=[key(403),key(331),key(8017)];sync(cp);
    const bad=learnAbility(cp.state,{characterId:'hero',trainerId:'idle-shaman-field-trainer',spellKey:key(915)},catalog);expect(bad.ok).toBe(false);
    const trained=learnAbility(cp.state,{characterId:'hero',trainerId:'idle-shaman-field-trainer',spellKey:key(529)},catalog);expect(trained.ok).toBe(true);if(!trained.ok)throw Error('train');cp.state=trained.value;expect(gameStateSchema.safeParse(cp.state).success).toBe(true);expect(actor(cp).classState!.knownSpells).toContain(key(529));
    cp.state.profile.characters[0].locationKey='forever:location:1537';const unlocked=unlockDualSpec(cp.state,'hero','idle-shaman-capital-trainer',catalog);expect(unlocked.ok).toBe(true);if(!unlocked.ok)throw Error('unlock');cp.state=unlocked.value;
    const switched=switchSpec(cp.state,'hero',1,catalog);expect(switched.ok).toBe(true);if(!switched.ok)throw Error('switch');cp.state=switched.value;
    const allocation=allocateTalents(cp.state,{characterId:'hero',profileId:'shaman-restoration',allocation:{'forever:talent:62001':5}},catalog);expect(allocation.ok).toBe(true);if(!allocation.ok)throw Error('allocate');cp.state=allocation.value;expect(actor(cp).classState!.talents).toEqual({'forever:talent:62001':5});expect(gameStateSchema.safeParse(cp.state).success).toBe(true);
    const missing={...catalog,classes:{...catalog.classes,shaman:undefined}} as unknown as typeof catalog;expect(validateTalentAllocation(actor(cp),{},missing).ok).toBe(false);expect(learnAbility(cp.state,{characterId:'hero',trainerId:'idle-shaman-capital-trainer',spellKey:key(548)},missing).ok).toBe(false);
  });
  it('same-timestamp established Shaman melee impacts retain simultaneous damage semantics',()=>{
    const cp=halt(shaman());actor(cp).health=100;cp.state.profile.characters[0].health=100;actor(cp,'enemy').health=100;
    scheduleEvent(cp,1,{type:'melee-impact',actorId:'enemy',targetId:'hero',bonusDamage:0,threatMultiplierBps:10000});scheduleEvent(cp,1,{type:'melee-impact',actorId:'hero',targetId:'enemy',bonusDamage:0,threatMultiplierBps:10000});
    const done=run(cp,1);expect(actor(done).health).toBe(0);expect(actor(done,'enemy').health).toBe(0);expect(done.state.encounter!.status).toBe('lost');
  });
});
