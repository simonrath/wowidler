import { describe,it,expect } from 'vitest';
import { validateTalentAllocation, allocateTalents, unlockDualSpec, switchSpec, resetTalents, talentPoints } from '../../src/game/classes/talents';
import { deriveActor } from '../../src/game/classes/resources';
import { materializeCharacterActor } from '../../src/game/classes/creation';
import { warriorFixture,catalog } from './helpers';
const talent=(id:number)=>`forever:talent:${id}` as const;
describe('Warrior allocations and separate specializations',()=>{
  it('enforces ranks, prerequisites, row points, level budgets and unsupported talents',()=>{
    const actor=warriorFixture().state.encounter!.actors[0];
    for(const allocation of [{[talent(10000)]:4},{[talent(10022)]:1},{[talent(10001)]:1},{[talent(10000)]:-1},{[talent(10000)]:1.5}]) expect(validateTalentAllocation(actor,allocation,catalog).ok).toBe(false);
    const allocation={[talent(10000)]:3,[talent(10002)]:3,[talent(10011)]:5,[talent(10022)]:1};
    expect(validateTalentAllocation(actor,allocation,catalog).ok).toBe(true);
    actor.classState!.level=10;expect(validateTalentAllocation(actor,allocation,catalog).ok).toBe(false);
    expect([9,10,11,16,60].map(l=>talentPoints(l,catalog))).toEqual([0,1,2,7,51]);
    expect(()=>deriveActor({...actor,classState:undefined},catalog)).toThrow();
  });
  it('keeps profiles independent, requires level40, rejects in-combat switching and resets at a major-city trainer',()=>{
    let s=warriorFixture().state;s.encounter=null;
    const c=s.profile.characters[0];c.locationKey='forever:location:1519';
    const learned=allocateTalents(s,{characterId:c.id,profileId:'arms',allocation:{[talent(10002)]:1}},catalog);expect(learned.ok).toBe(true);if(!learned.ok)return;s=learned.value;
    const low=structuredClone(s);low.profile.characters[0].level=39;expect(unlockDualSpec(low,'hero','idle-warrior-capital-trainer',catalog).ok).toBe(false);
    const dual=unlockDualSpec(s,'hero','idle-warrior-capital-trainer',catalog);expect(dual.ok).toBe(true);if(!dual.ok)return;
    const switched=switchSpec(dual.value,'hero',1,catalog);expect(switched.ok).toBe(true);if(!switched.ok)return;
    const fury=allocateTalents(switched.value,{characterId:'hero',profileId:'fury',allocation:{[talent(11002)]:1}},catalog);expect(fury.ok).toBe(true);if(!fury.ok)return;
    expect(fury.value.profile.characters[0].classProgress!.specs[0]!.allocation).toEqual({[talent(10002)]:1});
    const combat=warriorFixture().state;combat.profile.characters=fury.value.profile.characters;expect(switchSpec(combat,'hero',0,catalog).ok).toBe(false);
    expect(resetTalents(fury.value,'hero','idle-warrior-field-trainer',catalog).ok).toBe(false);
    expect(resetTalents(fury.value,'hero','idle-warrior-capital-trainer',catalog).ok).toBe(true);
  });
});
