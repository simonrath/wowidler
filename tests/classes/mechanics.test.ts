import { describe,it,expect } from 'vitest';
import { resolveAction, statsFor } from '../../src/game/combat/attack';
import { applyEffects } from '../../src/game/combat/effects';
import { advance } from '../../src/game/simulation/advance';
import { spellForActor, talentValue, gainDamageRage } from '../../src/game/classes/resources';
import { setStance } from '../../src/game/classes/forms';
import { allocateTalents } from '../../src/game/classes/talents';
import { learnAbility } from '../../src/game/classes/training';
import { materializeCharacterActor } from '../../src/game/classes/creation';
import { gameStateSchema } from '../../src/domain/state';
import { chooseAction } from '../../src/game/combat/tactics';
import { scheduleEvent } from '../../src/game/simulation/queue';
import { warriorFixture,catalog,budget } from './helpers';
const get=(cp:ReturnType<typeof warriorFixture>,id='hero')=>cp.state.encounter!.actors.find(a=>a.id===id)!;
describe('executable Warrior core',()=>{
  it('runs all three role-appropriate default profiles through production advance',()=>{
    for(const profile of catalog.classes.profiles.filter(p=>p.classKey==='forever:class:1')){
      let cp=warriorFixture();cp.state.encounter=null;
      const result=allocateTalents(cp.state,{characterId:'hero',profileId:profile.id,allocation:profile.allocation},catalog);expect(result.ok).toBe(true);if(!result.ok)continue;
      cp.state=result.value;const fresh=warriorFixture();cp.state.encounter=fresh.state.encounter;cp.state.encounter!.actors[0]=materializeCharacterActor(cp.state.profile.characters[0]);
      scheduleEvent(cp,0,{type:'combat-decision',actorId:'hero'});
      const end=advance(cp,12000,catalog,budget);expect(end.diagnostic).toBeUndefined();expect(get(end.checkpoint,'enemy').health).toBeLessThan(1000);expect(gameStateSchema.safeParse(end.checkpoint.state).success).toBe(true);
      if(profile.id==='protection') expect(get(end.checkpoint,'enemy').threat!.hero).toBeGreaterThan(1000-get(end.checkpoint,'enemy').health);
    }
  });
  it('Arms default tactic does not refresh its own active Rend before a tick',()=>{
    const cp=warriorFixture();get(cp).resource=100;cp.state.profile.characters[0].resource=100;
    const started=resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:'forever:spell:772'},catalog);
    const done=advance(started.checkpoint,1500,catalog,budget);
    const choice=chooseAction(get(done.checkpoint),done.checkpoint.state,catalog);
    expect(choice.rejected).toContainEqual({ruleId:'arms-772',reason:'aura-already-active'});
  });
  it('gains capped rage from actual damage, reduces defensive incoming damage and raises threat',()=>{
    let cp=warriorFixture();const stance=setStance(cp.state,'hero','defensive',catalog);expect(stance.ok).toBe(true);if(!stance.ok)return;cp.state=stance.value;
    const hit=applyEffects(cp,[{type:'damage',amount:100,school:'physical'}],{actorId:'enemy',targetId:'hero'},catalog);
    expect(hit.outcomes[0].amount).toBe(90);expect(get(hit.checkpoint).resource).toBe(30);
    const attack=applyEffects(cp,[{type:'damage',amount:100,school:'physical'}],{actorId:'hero',targetId:'enemy'},catalog);
    expect(attack.outcomes[0].amount).toBe(90);expect(get(attack.checkpoint,'enemy').threat!.hero).toBe(117);
  });
  it('rejects unknown ranks, wrong stance and missing reagents without state changes',()=>{
    const cp=warriorFixture();cp.state.profile.characters[0].knownSpells=cp.state.profile.characters[0].knownSpells.filter(k=>k!=='forever:spell:284');cp.state.encounter!.actors[0]=materializeCharacterActor(cp.state.profile.characters[0]);
    const input=structuredClone(cp);expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:'forever:spell:284'},catalog).ok).toBe(false);expect(cp).toEqual(input);
    const stance=setStance(cp.state,'hero','berserker',catalog);if(!stance.ok)throw Error('stance');cp.state=stance.value;
    expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:'forever:spell:772'},catalog).reason).toBe('wrong-stance');
    const reagentCatalog={...catalog,combat:{spells:catalog.combat!.spells.map(s=>s.key==='forever:spell:78'?{...s,reagents:[{itemKey:'forever:item:2589' as const,quantity:1}]}:s)}};
    expect(resolveAction(cp,{type:'cast',actorId:'hero',targetId:'enemy',spellKey:'forever:spell:78'},reagentCatalog).reason).toBe('missing-reagents');
  });
  it('trains a source rank only with explicit level, previous rank, quest and authored trainer cost',()=>{
    const cp=warriorFixture();cp.state.encounter=null;const c=cp.state.profile.characters[0];c.knownSpells=['forever:spell:2457'];
    const learn=(spellKey:'forever:spell:284'|'forever:spell:78'|'forever:spell:71')=>learnAbility(cp.state,{characterId:'hero',trainerId:'idle-warrior-field-trainer',spellKey},catalog);
    expect(learn('forever:spell:284').ok).toBe(false);expect(learn('forever:spell:71').ok).toBe(false);
    const first=learn('forever:spell:78');expect(first.ok).toBe(true);if(!first.ok)return;expect(first.value.profile.characters[0].moneyCopper).toBe(c.moneyCopper-10);cp.state=first.value;
    expect(learn('forever:spell:284').ok).toBe(true);
    cp.state.profile.characters[0].quests.push({questKey:'forever:quest:1638',status:'rewarded',objectives:[]});expect(learn('forever:spell:71').ok).toBe(true);
  });
});

describe('offered talent execution and deterministic class state',()=>{
  function talented(allocation:Record<string,number>,profileId='arms'){
    const cp=warriorFixture();cp.state.encounter=null;
    const result=allocateTalents(cp.state,{characterId:'hero',profileId,allocation},catalog);if(!result.ok)throw Error(result.error.message);
    cp.state=result.value;cp.state.encounter=warriorFixture().state.encounter;cp.state.encounter!.actors[0]=materializeCharacterActor(cp.state.profile.characters[0]);
    cp.state.profile.characters[0].rules=[{id:'halt',enabled:false,conditions:[],action:{type:'attack'}}];return cp;
  }
  it('Improved Heroic Strike changes the consumed cost and Improved Rend changes the executed full bleed',()=>{
    const action={type:'cast' as const,actorId:'hero',targetId:'enemy',spellKey:'forever:spell:78' as const};
    const plain=resolveAction(talented({}),action,catalog),improved=resolveAction(talented({'forever:talent:10000':1}),action,catalog);
    expect(get(improved.checkpoint).resource-get(plain.checkpoint).resource).toBe(1);
    const rend={...action,spellKey:'forever:spell:772' as const};
    const base=advance(resolveAction(talented({}),rend,catalog).checkpoint,9001,catalog,budget);
    const strong=advance(resolveAction(talented({'forever:talent:10002':1}),rend,catalog).checkpoint,9001,catalog,budget);
    expect(base.diagnostic).toBeUndefined();expect(strong.diagnostic).toBeUndefined();expect(get(base.checkpoint,'enemy').health-get(strong.checkpoint,'enemy').health).toBe(1);
  });
  it('Tactical Mastery retains real rage; Improved Bloodrage changes immediate and periodic gains',()=>{
    const c=talented({'forever:talent:10000':3,'forever:talent:10002':2,'forever:talent:10011':1});
    const changed=setStance(c.state,'hero','defensive',catalog);expect(changed.ok).toBe(true);if(!changed.ok)return;expect(changed.value.profile.characters[0].resource).toBe(3);expect(changed.value.encounter!.actors[0].resource).toBe(3);
    const blood={type:'cast' as const,actorId:'hero',targetId:'hero',spellKey:'forever:spell:2687' as const};
    const base=advance(resolveAction(talented({},'protection'),blood,catalog).checkpoint,10001,catalog,budget);
    const strong=advance(resolveAction(talented({'forever:talent:12000':1},'protection'),blood,catalog).checkpoint,10001,catalog,budget);
    expect(base.diagnostic).toBeUndefined();expect(strong.diagnostic).toBeUndefined();expect(get(strong.checkpoint).resource-get(base.checkpoint).resource).toBe(4);
  });
  it('Cruelty turns a seeded attack into a critical hit and Deep Wounds deals its prerequisite-gated bleed',()=>{
    const hit=(allocation:Record<string,number>,critical=false)=>{
      const cp=talented(allocation);cp.rng=[1,2,3,4];
      const c=cp.state.profile.characters[0];c.stats.critChanceBps=critical?10000:100;cp.state.encounter!.actors[0]=materializeCharacterActor(c);
      scheduleEvent(cp,0,{type:'melee-impact',actorId:'hero',targetId:'enemy',bonusDamage:0,threatMultiplierBps:10000});return advance(cp,critical?12000:0,catalog,budget);
    };
    // With xoshiro seed [1,2,3,4], the second inclusive 1..10000 draw is 1.
    const plain=hit({});expect(plain.diagnostic).toBeUndefined();
    const bleed=hit({'forever:talent:10000':3,'forever:talent:10002':3,'forever:talent:10011':5,'forever:talent:10022':1},true);
    const base=hit({},true);expect(bleed.diagnostic).toBeUndefined();expect(get(base.checkpoint,'enemy').health-get(bleed.checkpoint,'enemy').health).toBe(2);
    const fury=talented({'forever:talent:11002':1},'fury');
    const c=fury.state.profile.characters[0];c.classProgress!.stance='battle';c.stats.critChanceBps=0;fury.state.encounter!.actors[0]=materializeCharacterActor(c);
    const noTalent=structuredClone(fury);noTalent.state.profile.characters[0].talents={};noTalent.state.profile.characters[0].classProgress!.specs[0]!.allocation={};noTalent.state.encounter!.actors[0]=materializeCharacterActor(noTalent.state.profile.characters[0]);
    for(const cp of [fury,noTalent])scheduleEvent(cp,0,{type:'melee-impact',actorId:'hero',targetId:'enemy',bonusDamage:0,threatMultiplierBps:10000});
    expect(get(advance(noTalent,0,catalog,budget).checkpoint,'enemy').health-get(advance(fury,0,catalog,budget).checkpoint,'enemy').health).toBe(10);
  });
  it('validates the snapshot against persistence and resumes identically across serialization and small budgets',()=>{
    const cp=talented({'forever:talent:10002':1});cp.state.encounter!.actors[0].classState!.talents={};expect(gameStateSchema.safeParse(cp.state).success).toBe(false);
    const forged=warriorFixture();delete forged.state.profile.characters[0].classProgress;expect(gameStateSchema.safeParse(forged.state).success).toBe(false);
    const valid=warriorFixture();scheduleEvent(valid,0,{type:'combat-decision',actorId:'hero'});
    const whole=advance(valid,15000,catalog,budget);let chunk=valid;
    while(chunk.simMs<15000){const next=advance(JSON.parse(JSON.stringify(chunk)),15000,catalog,{maxEvents:2,shouldYield:()=>false});expect(next.diagnostic).toBeUndefined();chunk=next.checkpoint;}
    expect(chunk).toEqual(whole.checkpoint);
  });
});

describe('required class execution package',()=>{
  it('rejects attacks, learned spells and incoming/outgoing effects when the package is missing or unsupported',()=>{
    const cp=warriorFixture(),before=structuredClone(cp);
    const missing={...catalog,classes:undefined};
    const unsupported={...catalog,classes:{...catalog.classes,definitions:catalog.classes.definitions.map(d=>({...d,mechanics:'unsupported' as const}))}};
    for(const bound of [missing,unsupported]) {
      for(const action of [{type:'attack' as const,actorId:'hero',targetId:'enemy'},{type:'attack' as const,actorId:'enemy',targetId:'hero'},{type:'cast' as const,actorId:'hero',targetId:'enemy',spellKey:'forever:spell:78' as const}]) {
        const result=resolveAction(cp,action,bound);expect(result.ok).toBe(false);expect(result.reason).toBe('missing-class-package');expect(result.checkpoint).toBe(cp);expect(result.scheduled).toEqual([]);
      }
      expect(()=>statsFor(get(cp),cp,bound)).toThrow();
      expect(()=>spellForActor(catalog.combat!.spells[0],get(cp),bound)).toThrow();
      expect(()=>talentValue(get(cp),'heroic-cost',bound)).toThrow();
      expect(()=>gainDamageRage(get(cp),10,false,bound)).toThrow();
      for(const context of [{actorId:'hero',targetId:'enemy'},{actorId:'enemy',targetId:'hero'}]) {
        const result=applyEffects(cp,[{type:'damage',amount:10,school:'physical'}],context,bound);expect(result.ok).toBe(false);expect(result.reason).toBe('missing-class-package');expect(result.checkpoint).toBe(cp);expect(result.outcomes).toEqual([]);
      }
    }
    expect(applyEffects(cp,[{type:'heal',amount:1}],{actorId:'hero',targetId:'hero'}).reason).toBe('missing-class-package');
    expect(cp).toEqual(before);
  });
  it('rolls back a queued impact instead of resolving generic damage without class mechanics',()=>{
    const cp=warriorFixture();scheduleEvent(cp,1,{type:'melee-impact',actorId:'hero',targetId:'enemy',bonusDamage:0,threatMultiplierBps:10000});
    const result=advance(cp,1,{...catalog,classes:undefined},budget);
    expect(result.diagnostic).toBeDefined();expect(result.reachedTarget).toBe(false);expect(result.checkpoint).toEqual(cp);
  });
});
