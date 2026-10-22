import type { Catalog } from '../../domain/content';
import type { ActorState, GameState } from '../../domain/state';
import type { EntityKey } from '../../domain/ids';
import type { Result, Validation } from '../../domain/result';
import { materializeCharacterActor, refreshClassActors } from './creation';
import { classCommandReason, classFailure, trainerReason } from './training';
import { stanceSpell, setStance } from './forms';
export function talentPoints(level: number, catalog: Catalog): number {
  const rules=catalog.classes?.rules;if(!rules || !Number.isSafeInteger(level) || level<1) throw Error('Invalid talent budget input');
  return Math.max(0,Math.min(level,rules.maxLevel)-rules.talentsUnlockLevel+1)*rules.pointsPerLevel;
}
export function validateTalentAllocation(actor: ActorState, allocation: Readonly<Record<EntityKey,number>>, catalog: Catalog): Validation {
  const issues: {path:(string|number)[];message:string}[]=[], c=catalog.classes,s=actor.classState;
  if(!s || !c || (s.classKey==='forever:class:7' && !c.shaman) || !c.definitions.some(d=>d.key===s.classKey && d.mechanics==='playable')) return {ok:false,issues:[{path:[],message:'Supported class snapshot required'}]};
  let total=0;
  for(const [key,rank] of Object.entries(allocation)) {
    const t=c.talents.find(t=>t.key===key && t.classKey===s.classKey);
    if(!t?.handler || !Number.isSafeInteger(rank) || rank<0 || rank>t.max) {issues.push({path:[key],message:'Unsupported talent or invalid rank'});continue;}
    total+=rank;if(!rank)continue;
    if(t.prerequisite && (allocation[t.prerequisite.key]??0)<t.prerequisite.rank) issues.push({path:[key],message:'Talent prerequisite missing'});
    const previous=c.talents.filter(p=>p.treeId===t.treeId && p.row<t.row).reduce((n,p)=>n+(allocation[p.key]??0),0);
    if(previous<t.row*c.rules.rowPoints) issues.push({path:[key],message:'Insufficient points in earlier tiers'});
  }
  if(total>talentPoints(s.level,catalog)) issues.push({path:[],message:'Talent point budget exceeded'});
  return issues.length?{ok:false,issues}:{ok:true};
}
export function allocateTalents(state: GameState, input: {characterId:string;profileId:string;allocation:Readonly<Record<EntityKey,number>>}, catalog: Catalog): Result<GameState> {
  const reason=classCommandReason(state,input.characterId);if(reason)return classFailure(reason);
  const character=state.profile.characters.find(c=>c.id===input.characterId)!;
  const validation=validateTalentAllocation(materializeCharacterActor(character),input.allocation,catalog);
  if(!validation.ok)return {ok:false,error:{code:'invalid',message:'Ungültige Talentverteilung.',issues:validation.issues}};
  const profile=catalog.classes!.profiles.find(p=>p.id===input.profileId);
  if(!profile || profile.classKey!==character.classKey || (character.classKey==='forever:class:1' && !character.knownSpells.includes(stanceSpell[profile.stance])))return classFailure('Talentprofil oder Haltung nicht verfügbar.');
  const current=character.classProgress!.specs[character.classProgress!.activeSpec]!;
  if(Object.entries(character.talents).some(([key,rank])=>(input.allocation[key as EntityKey]??0)<rank) || (current.profileId!==input.profileId && Object.values(character.talents).some(rank=>rank>0)))return classFailure('Talente zuerst beim Stadtlehrer zurücksetzen.');
  const stance=character.classProgress!.stance===profile.stance?{ok:true as const,value:state}:setStance(state,input.characterId,profile.stance,catalog);
  if(!stance.ok)return stance;
  const draft=structuredClone(stance.value), next=draft.profile.characters.find(c=>c.id===input.characterId)!;
  next.talents={...input.allocation};next.classProgress!.specs[next.classProgress!.activeSpec]={profileId:profile.id,allocation:{...input.allocation}};
  next.classProgress!.stance=profile.stance;next.rules=structuredClone(profile.rules);refreshClassActors(draft,next,catalog);return {ok:true,value:draft};
}
export function unlockDualSpec(state:GameState,characterId:string,trainerId:string,catalog:Catalog):Result<GameState>{
  const reason=classCommandReason(state,characterId);if(reason)return classFailure(reason);
  const c=state.profile.characters.find(c=>c.id===characterId)!,rules=catalog.classes?.rules;
  if(!rules || (c.classKey==='forever:class:7' && !catalog.classes?.shaman) || !catalog.classes?.definitions.some(d=>d.key===c.classKey && d.mechanics==='playable') || trainerReason(c,trainerId,catalog,true) || c.level<rules.dualLevel || c.moneyCopper<rules.dualCost || c.classProgress!.specs[1])return classFailure('Zweite Spezialisierung nicht verfügbar.');
  const draft=structuredClone(state),next=draft.profile.characters.find(c=>c.id===characterId)!;
  next.moneyCopper-=rules.dualCost;next.classProgress!.specs[1]={profileId:catalog.classes!.profiles.find(p=>p.classKey===c.classKey)!.id,allocation:{}};refreshClassActors(draft,next,catalog);return {ok:true,value:draft};
}
export function switchSpec(state:GameState,characterId:string,slot:0|1,catalog:Catalog):Result<GameState>{
  const reason=classCommandReason(state,characterId);if(reason)return classFailure(reason);
  const c=state.profile.characters.find(c=>c.id===characterId)!,spec=c.classProgress!.specs[slot],rules=catalog.classes?.rules;
  if(!rules || !spec || c.moneyCopper<rules.switchCost || (slot===1 && c.level<rules.dualLevel))return classFailure('Spezialisierung nicht verfügbar.');
  const validation=validateTalentAllocation(materializeCharacterActor(c),spec.allocation,catalog),profile=catalog.classes!.profiles.find(p=>p.id===spec.profileId);
  if(!validation.ok || !profile || profile.classKey!==c.classKey || (c.classKey==='forever:class:1' && !c.knownSpells.includes(stanceSpell[profile.stance])))return classFailure('Gespeicherte Spezialisierung ungültig.');
  const stance=c.classProgress!.stance===profile.stance?{ok:true as const,value:state}:setStance(state,characterId,profile.stance,catalog);
  if(!stance.ok)return stance;
  const draft=structuredClone(stance.value),next=draft.profile.characters.find(c=>c.id===characterId)!;
  next.moneyCopper-=rules.switchCost;next.classProgress!.activeSpec=slot;next.talents={...spec.allocation};next.classProgress!.stance=profile.stance;next.rules=structuredClone(profile.rules);refreshClassActors(draft,next,catalog);return {ok:true,value:draft};
}
export function resetTalents(state:GameState,characterId:string,trainerId:string,catalog:Catalog):Result<GameState>{
  const reason=classCommandReason(state,characterId);if(reason)return classFailure(reason);
  const c=state.profile.characters.find(c=>c.id===characterId)!,rules=catalog.classes?.rules;
  if(!rules || (c.classKey==='forever:class:7' && !catalog.classes?.shaman) || !catalog.classes?.definitions.some(d=>d.key===c.classKey && d.mechanics==='playable') || trainerReason(c,trainerId,catalog,true) || c.moneyCopper<rules.resetCost)return classFailure('Zurücksetzen beim Stadtlehrer nicht möglich.');
  const draft=structuredClone(state),next=draft.profile.characters.find(c=>c.id===characterId)!;
  next.moneyCopper-=rules.resetCost;next.talents={};next.classProgress!.specs[next.classProgress!.activeSpec]!.allocation={};refreshClassActors(draft,next,catalog);return {ok:true,value:draft};
}
