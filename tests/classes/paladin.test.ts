import { describe, it, expect } from 'vitest';
import { createCharacter, materializeCharacterActor } from '../../src/game/classes/creation';
import { allocateTalents, validateTalentAllocation, unlockDualSpec, switchSpec } from '../../src/game/classes/talents';
import { learnAbility } from '../../src/game/classes/training';
import { setStance } from '../../src/game/classes/forms';
import { resolveAction } from '../../src/game/combat/attack';
import { applyEffects } from '../../src/game/combat/effects';
import { highestThreatTarget } from '../../src/game/combat/threat';
import { chooseAction } from '../../src/game/combat/tactics';
import { advance } from '../../src/game/simulation/advance';
import { scheduleEvent } from '../../src/game/simulation/queue';
import { gameStateSchema, type ActorState } from '../../src/domain/state';
import { makeCheckpoint } from '../fixtures/factories';
import { catalog, budget } from './helpers';
const key=(id:number)=>`forever:spell:${id}` as const;
function paladin(profileId='paladin-holy',allocation:Record<string,number>={}) {
  const combo=catalog.classes.combinations.find(c=>c.raceKey==='forever:race:1'&&c.classKey==='forever:class:2')!;
  const result=createCharacter({id:'hero',name:'Paladin',...combo,combinationKey:combo.key},catalog);
  if(!result.ok)throw Error(result.error.message);
  const c=result.value;c.level=60;c.moneyCopper=10000;c.knownSpells=catalog.classes.training.filter(t=>t.classKey===c.classKey).map(t=>t.spellKey);
  c.stats={...c.stats,maxHealth:1000,maxResource:1000,minDamage:100,maxDamage:100,attackPower:700,armor:100,critChanceBps:0};c.health=1000;c.resource=1000;
  const cp=makeCheckpoint();cp.state.profile.characters=[c];cp.state.encounter=null;
  const allocated=allocateTalents(cp.state,{characterId:'hero',profileId,allocation},catalog);
  expect(allocated.ok).toBe(true);if(!allocated.ok)throw Error(allocated.error.message);cp.state=allocated.value;
  const hero=cp.state.profile.characters[0];
  cp.state.encounter={id:'fight',locationKey:c.locationKey,status:'running',actors:[materializeCharacterActor(hero),{kind:'npc',id:'enemy',npcKey:'forever:npc:1',stats:{...c.stats,maxHealth:10000,armor:0},health:10000,maxHealth:10000,resource:0,maxResource:0,nextAttackMs:0,threat:{hero:1}},{kind:'npc',id:'ally',allegiance:'ally',npcKey:'forever:npc:2',stats:{...c.stats},health:100,maxHealth:1000,resource:0,maxResource:1000,nextAttackMs:0} as ActorState]};
  return cp;
}
const actor=(cp:ReturnType<typeof paladin>,id='hero')=>cp.state.encounter!.actors.find(a=>a.id===id)!;
function cast(cp:ReturnType<typeof paladin>,id:number,targetId='hero',until=1) {
  const result=resolveAction(cp,{type:'cast',actorId:'hero',targetId,spellKey:key(id)},catalog);expect(result.ok).toBe(true);
  const done=advance(result.checkpoint,cp.simMs+until,catalog,budget);expect(done.diagnostic).toBeUndefined();return done.checkpoint;
}
function halt(cp:ReturnType<typeof paladin>) {cp.state.profile.characters[0].rules=[{id:'halt',enabled:false,conditions:[],action:{type:'attack'}}];return cp;}

describe('Paladin bounded source package',()=>{
  it('retains every current talent rank and keeps unsupported talents unavailable',()=>{
    const talents=catalog.classes.talents.filter(t=>t.classKey==='forever:class:2');expect(talents).toHaveLength(50);
    expect(new Set(talents.map(t=>t.treeId))).toEqual(new Set([382,383,381]));
    expect(talents.filter(t=>t.handler)).toHaveLength(4);
    expect(talents.every(t=>t.descriptions.length===t.max && t.spells.length===t.max)).toBe(true);
    const cp=paladin();expect(validateTalentAllocation(actor(cp),{'forever:talent:21002':1},catalog).ok).toBe(false);
    expect(validateTalentAllocation(actor(cp),{'forever:talent:20010':1},catalog).ok).toBe(false);
    expect(validateTalentAllocation(actor(cp),{'forever:talent:20001':6},catalog).ok).toBe(false);
  });
  it('Holy selects and actually heals an injured allied actor with production advance',()=>{
    const cp=paladin();expect(gameStateSchema.safeParse(cp.state).success).toBe(true);
    expect(chooseAction(actor(cp),cp.state,catalog).action?.targetId).toBe('ally');
    scheduleEvent(cp,0,{type:'combat-decision',actorId:'hero'});
    const done=advance(cp,8000,catalog,budget);expect(done.diagnostic).toBeUndefined();
    expect(actor(done.checkpoint,'ally').health).toBeGreaterThan(100);expect(actor(done.checkpoint).resource).toBeLessThan(1000);
    expect(actor(done.checkpoint,'enemy').health).toBe(10000);expect(gameStateSchema.safeParse(done.checkpoint.state).success).toBe(true);
  });
  it('Protection executes armor and Holy threat while Retribution executes Might and melee',()=>{
    const ends=['paladin-protection','paladin-retribution'].map(id=>{const cp=paladin(id);scheduleEvent(cp,0,{type:'combat-decision',actorId:'hero'});const done=advance(cp,8000,catalog,budget);expect(done.diagnostic).toBeUndefined();return done.checkpoint;});
    const [tank,melee]=ends;
    expect(actor(tank).auras?.some(a=>a.id==='paladin-devotion')).toBe(true);
    expect(actor(tank).auras?.some(a=>a.id==='paladin-righteous-fury')).toBe(true);
    expect(actor(tank,'enemy').threat!.hero).toBeGreaterThan(10000-actor(tank,'enemy').health+1);
    expect(actor(melee).auras?.some(a=>a.id==='paladin-might')).toBe(true);expect(actor(melee,'enemy').health).toBeLessThan(10000);
    expect(actor(melee).auras?.some(a=>a.id==='paladin-righteous-fury')).not.toBe(true);
    const incoming=(cp:typeof tank)=>applyEffects(cp,[{type:'damage',amount:1000,school:'physical'}],{actorId:'enemy',targetId:'hero'},catalog).outcomes[0].amount!;
    expect(incoming(tank)).toBeLessThan(incoming(melee));
  });
  it('every offered Divine Strength rank increases real melee damage',()=>{
    const damages=[0,1,2,3,4,5].map(rank=>{const cp=halt(paladin('paladin-holy',rank?{'forever:talent:20001':rank}:{}));scheduleEvent(cp,0,{type:'melee-impact',actorId:'hero',targetId:'enemy',bonusDamage:0,threatMultiplierBps:10000});const done=advance(cp,0,catalog,budget);expect(done.diagnostic).toBeUndefined();return 10000-actor(done.checkpoint,'enemy').health;});
    for(let i=1;i<damages.length;i++)expect(damages[i]).toBeGreaterThan(damages[i-1]);
  });
  it('every offered Healing Light rank increases real ally healing',()=>{
    const healing=[0,1,2,3].map(rank=>actor(cast(halt(paladin('paladin-holy',{'forever:talent:20001':5,...(rank?{'forever:talent:20010':rank}:{})})),635,'ally',2500),'ally').health);
    expect(healing).toEqual([146,147,149,151]);
  });
  it('every offered Toughness rank reduces physical damage received',()=>{
    const taken=[0,1,2,3,4,5].map(rank=>applyEffects(paladin('paladin-protection',rank?{'forever:talent:21001':rank}:{}),[{type:'damage',amount:1000,school:'physical'}],{actorId:'enemy',targetId:'hero'},catalog).outcomes[0].amount!);
    expect(taken).toEqual([500,495,490,485,480,476]);
  });
  it('every offered Benediction rank changes actual instant-spell mana cost',()=>{
    const spent=[0,1,2,3,4,5].map(rank=>{const cp=halt(paladin('paladin-retribution',rank?{'forever:talent:22002':rank}:{}));const result=resolveAction(cp,{type:'cast',actorId:'hero',targetId:'hero',spellKey:key(25780)},catalog);expect(result.ok).toBe(true);return 1000-actor(result.checkpoint).resource;});
    expect(spent).toEqual([300,294,288,282,276,270]);
  });
  it('Might and Wisdom replace per-caster blessings; Wisdom restores mana on its exact tick',()=>{
    let cp=halt(paladin());cp=cast(cp,19740);cp.simMs=1500;cp.state.combatTimeMs=1500;
    cp=cast(cp,19742);expect(actor(cp).auras?.filter(a=>a.id==='paladin-might')).toHaveLength(0);
    const before=actor(cp).resource;const done=advance(cp,6501,catalog,budget);expect(done.diagnostic).toBeUndefined();expect(actor(done.checkpoint).resource).toBe(before+12);
  });
  it('rejects cross-class profiles and unknown ranks atomically, uses Paladin dual specs',()=>{
    const cp=paladin();cp.state.encounter=null;const c=cp.state.profile.characters[0];c.locationKey='forever:location:1519';const before=structuredClone(cp.state);
    expect(allocateTalents(cp.state,{characterId:'hero',profileId:'arms',allocation:{}},catalog).ok).toBe(false);expect(cp.state).toEqual(before);
    const dual=unlockDualSpec(cp.state,'hero','idle-paladin-capital-trainer',catalog);expect(dual.ok).toBe(true);if(!dual.ok)return;
    const switched=switchSpec(dual.value,'hero',1,catalog);expect(switched.ok).toBe(true);if(switched.ok)expect(switched.value.profile.characters[0].classProgress!.specs[1]!.profileId).toBe('paladin-holy');
  });
  it('training refuses an unsupported class package without mutating state',()=>{
    const cp=paladin();cp.state.encounter=null;const c=cp.state.profile.characters[0];c.knownSpells=c.knownSpells.filter(k=>k!==key(639));
    const missing={...catalog,classes:{...catalog.classes,definitions:catalog.classes.definitions.map(d=>d.key==='forever:class:2'?{...d,mechanics:'unsupported' as const}:d)}};
    const before=structuredClone(cp.state);
    expect(learnAbility(cp.state,{characterId:'hero',trainerId:'idle-paladin-field-trainer',spellKey:key(639)},missing).ok).toBe(false);expect(cp.state).toEqual(before);
  });
  it('source rank training checks previous rank and refreshes the derived snapshot atomically',()=>{
    const cp=paladin();cp.state.encounter!.status='won';const c=cp.state.profile.characters[0];c.knownSpells=[];cp.state.encounter!.actors[0]=materializeCharacterActor(c);
    const input={characterId:'hero',trainerId:'idle-paladin-field-trainer',spellKey:key(639)};
    expect(learnAbility(cp.state,input,catalog).ok).toBe(false);
    const rank1=learnAbility(cp.state,{...input,spellKey:key(635)},catalog);expect(rank1.ok).toBe(true);if(!rank1.ok)return;
    const rank2=learnAbility(rank1.value,input,catalog);expect(rank2.ok).toBe(true);if(!rank2.ok)return;
    expect(rank2.value.profile.characters[0].moneyCopper).toBe(9930);expect(gameStateSchema.safeParse(rank2.value).success).toBe(true);
    expect(rank2.value.encounter!.actors[0].classState!.knownSpells).toEqual([key(635),key(639)]);
  });
  it('allies have independent enemy targeting, deterministic healing ties and terminal semantics',()=>{
    let cp=halt(paladin());const ally=actor(cp,'ally');
    expect(chooseAction(ally,cp.state,catalog).action?.targetId).toBe('enemy');
    actor(cp,'enemy').threat={hero:1,ally:20};expect(chooseAction(actor(cp,'enemy'),cp.state,catalog).action?.targetId).toBe('ally');
    const twin={...structuredClone(ally),id:'a-ally'};cp.state.encounter!.actors.push(twin);
    cp.state.profile.characters[0].rules=catalog.classes.profiles.find(p=>p.id==='paladin-holy')!.rules;
    expect(chooseAction(actor(cp),cp.state,catalog).action?.targetId).toBe('a-ally');
    twin.health=0;expect(chooseAction(actor(cp),cp.state,catalog).action?.targetId).toBe('ally');
    cp=halt(cp);scheduleEvent(cp,0,{type:'death',actorId:'a-ally'});const alive=advance(cp,0,catalog,budget);expect(alive.diagnostic).toBeUndefined();expect(alive.checkpoint.state.encounter!.status).toBe('running');
    actor(alive.checkpoint,'enemy').health=0;scheduleEvent(alive.checkpoint,1,{type:'death',actorId:'enemy'});const win=advance(alive.checkpoint,1,catalog,budget);expect(win.diagnostic).toBeUndefined();expect(win.checkpoint.state.encounter!.status).toBe('won');
  });
  it('Righteous Fury affects only actual Holy damage and expires; no Warrior stance is exposed',()=>{
    const cp=cast(halt(paladin('paladin-protection')),25780);
    const hit=(school:'physical'|'holy')=>applyEffects(cp,[{type:'damage',amount:100,school}],{actorId:'hero',targetId:'enemy'},catalog);
    expect(actor(hit('physical').checkpoint,'enemy').threat!.hero).toBe(101);
    expect(actor(hit('holy').checkpoint,'enemy').threat!.hero).toBe(191);
    actor(cp,'enemy').threat!.ally=1;
    const healed=applyEffects(cp,[{type:'heal',amount:100}],{actorId:'hero',targetId:'ally'},catalog);expect(actor(healed.checkpoint,'enemy').threat!.hero).toBe(51);
    const done=advance(cp,1800001,catalog,budget);expect(done.diagnostic).toBeUndefined();
    expect(actor(applyEffects(done.checkpoint,[{type:'damage',amount:100,school:'holy'}],{actorId:'hero',targetId:'enemy'},catalog).checkpoint,'enemy').threat!.hero).toBe(101);
    const idle=paladin();idle.state.encounter=null;expect(setStance(idle.state,'hero','defensive',catalog).ok).toBe(false);
  });
  it('healing a genuinely attacked ally creates healer threat without seeded engagement',()=>{
    const cp=halt(paladin());const enemy=actor(cp,'enemy'),ally=actor(cp,'ally');delete enemy.threat;ally.health=1000;if(enemy.kind==='npc'){enemy.stats.attackIntervalMs=4000;enemy.stats.attackPower=350;}
    const spectator={...structuredClone(enemy),id:'spectator'};cp.state.encounter!.actors.push(spectator);
    const attack=resolveAction(cp,{type:'attack',actorId:'enemy',targetId:'ally'},catalog);expect(attack.ok).toBe(true);
    const hit=advance(attack.checkpoint,1,catalog,budget);expect(hit.diagnostic).toBeUndefined();
    expect(actor(hit.checkpoint,'ally').health).toBe(900);
    // Cancel neither action nor events: the healer finishes before the next enemy swing.
    const heal=cast(hit.checkpoint,635,'ally',2500);
    expect(actor(heal,'ally').health).toBe(946);
    expect(actor(heal,'enemy').threat?.hero).toBe(23);
    expect(actor(heal,'spectator').threat).toBeUndefined();
    expect(actor(heal,'ally').threat?.hero).toBeUndefined();
    expect(highestThreatTarget(actor(heal,'enemy'),heal.state)?.id).toBe('hero');
  });
  it('healing does not aggro unengaged, friendly, dead or other-zone actors',()=>{
    const cp=halt(paladin());delete actor(cp,'enemy').threat;
    const unengaged=applyEffects(cp,[{type:'heal',amount:46}],{actorId:'hero',targetId:'ally'},catalog);
    expect(actor(unengaged.checkpoint,'enemy').threat).toBeUndefined();
    const hit=applyEffects(cp,[{type:'damage',amount:10,school:'physical'}],{actorId:'enemy',targetId:'ally'},catalog);expect(hit.ok).toBe(true);
    const before=structuredClone(actor(hit.checkpoint,'enemy').threat);expect(before).toEqual({ally:0});
    const friendly=structuredClone(hit.checkpoint),formerEnemy=actor(friendly,'enemy');if(formerEnemy.kind==='npc')formerEnemy.allegiance='ally';
    expect(actor(applyEffects(friendly,[{type:'heal',amount:46}],{actorId:'hero',targetId:'ally'},catalog).checkpoint,'enemy').threat).toEqual(before);
    hit.checkpoint.state.profile.characters[0].locationKey='forever:location:1519';
    const away=applyEffects(hit.checkpoint,[{type:'heal',amount:46}],{actorId:'hero',targetId:'ally'},catalog);
    expect(actor(away.checkpoint,'enemy').threat).toEqual(before);
    hit.checkpoint.state.profile.characters[0].locationKey=hit.checkpoint.state.encounter!.locationKey;
    actor(hit.checkpoint,'enemy').health=0;
    const dead=applyEffects(hit.checkpoint,[{type:'heal',amount:46}],{actorId:'hero',targetId:'ally'},catalog);
    expect(actor(dead.checkpoint,'enemy').threat).toEqual(before);
  });
  it('blessing exclusivity is per caster and target, and removed periodic ticks do nothing',()=>{
    let cp=halt(paladin());const wisdom=catalog.classes.spells.find(s=>s.key===key(19742))!.effects;
    const might=catalog.classes.spells.find(s=>s.key===key(19740))!.effects;
    cp=applyEffects(cp,wisdom,{actorId:'hero',targetId:'ally'},catalog).checkpoint;
    cp=applyEffects(cp,wisdom,{actorId:'hero',targetId:'hero'},catalog).checkpoint;
    cp=applyEffects(cp,might,{actorId:'ally',targetId:'ally'},catalog).checkpoint;
    expect(actor(cp,'ally').auras).toHaveLength(2);
    cp=applyEffects(cp,might,{actorId:'hero',targetId:'ally'},catalog).checkpoint;
    expect(actor(cp,'ally').auras).toHaveLength(2);expect(actor(cp).auras).toHaveLength(1);
    const done=advance(cp,5000,catalog,budget);expect(done.diagnostic).toBeUndefined();expect(actor(done.checkpoint,'ally').resource).toBe(0);
  });
  it('Paladin actions fail closed, rank/range/reagent rejection is atomic, and resumes identically',()=>{
    const cp=paladin('paladin-retribution'),before=structuredClone(cp);
    const missing={...catalog,classes:undefined};
    for(const action of [{type:'attack' as const,actorId:'hero',targetId:'enemy'},{type:'attack' as const,actorId:'enemy',targetId:'hero'}])expect(resolveAction(cp,action,missing).reason).toBe('missing-class-package');
    expect(applyEffects(cp,[{type:'damage',amount:10,school:'holy'}],{actorId:'enemy',targetId:'hero'},missing).reason).toBe('missing-class-package');expect(cp).toEqual(before);
    const c=cp.state.profile.characters[0];c.knownSpells=c.knownSpells.filter(k=>k!==key(639));cp.state.encounter!.actors[0]=materializeCharacterActor(c);
    expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'ally',spellKey:key(639)},catalog).reason).toBe('unknown-spell');
    actor(cp).position={range:'ranged',sector:'front'};
    expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(679)},catalog).reason).toBe('out-of-range');delete actor(cp).position;
    const reagents={...catalog,combat:{spells:catalog.combat!.spells.map(s=>s.key===key(679)?{...s,reagents:[{itemKey:'forever:item:2589' as const,quantity:1}]}:s)}};
    expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:key(679)},reagents).reason).toBe('missing-reagents');
    scheduleEvent(cp,0,{type:'combat-decision',actorId:'hero'});const whole=advance(cp,12000,catalog,budget);let chunk=cp;
    while(chunk.simMs<12000){const done=advance(JSON.parse(JSON.stringify(chunk)),12000,catalog,{maxEvents:2,shouldYield:()=>false});expect(done.diagnostic).toBeUndefined();chunk=done.checkpoint;}
    expect(chunk).toEqual(whole.checkpoint);
  });

});
