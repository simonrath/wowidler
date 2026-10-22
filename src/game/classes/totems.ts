import type { Catalog } from '../../domain/content';
import type { ActorState, Checkpoint, GameState } from '../../domain/state';
import { scheduleEvent } from '../simulation/queue';
import { targetReason } from '../combat/positions';
export type TotemActor = Extract<ActorState,{kind:'totem'}>;
/** Independent encounter actors; Hunter's single retained-pet contract is unchanged. */
export function summonTotemReason(owner: ActorState, state: GameState, catalog: Catalog, templateId: string): string | undefined {
  const c=owner.kind==='character'?state.profile.characters.find(c=>c.id===owner.characterId):undefined;
  const t=catalog.classes?.shaman?.totems.find(t=>t.id===templateId);
  if(!c?.classProgress || c.classKey!=='forever:class:7' || c.id!==state.profile.activeCharacterId || !t || catalog.classes?.shaman?.totemToolAccess!=='owned-idle-encounter-tools')return 'unsupported-totem';
  if(!c.knownSpells.includes(t.sourceSpellKey) || !catalog.classes?.training.some(o=>o.classKey===c.classKey && o.spellKey===t.sourceSpellKey && o.level<=c.level))return 'unknown-spell';
  return targetReason(owner,owner,state,'self');
}
export function totemStateReason(actor: TotemActor, state: GameState, catalog?: Catalog): string | undefined {
  const owner=state.encounter?.actors.find(a=>a.id===actor.ownerActorId);
  const c=owner?.kind==='character'?state.profile.characters.find(c=>c.id===owner.characterId):undefined;
  const t=catalog?.classes?.shaman?.totems.find(t=>t.id===actor.templateId);
  if(catalog?.classes?.shaman?.totemToolAccess!=='owned-idle-encounter-tools' || !t || !c?.classProgress || c.classKey!=='forever:class:7' || c.id!==state.profile.activeCharacterId || !catalog?.classes?.definitions.some(d=>d.key===c.classKey&&d.mechanics==='playable'))return 'missing-class-package';
  if(actor.sourceSpellKey!==t.sourceSpellKey || actor.element!==t.element || actor.maxHealth!==t.stats.maxHealth || actor.maxResource!==0 || actor.resource!==0 || actor.partySlotsConsumed!==0 || actor.expiresAtMs!==actor.summonedAtMs+t.durationMs || (actor.nextPulseMs-actor.summonedAtMs)%t.intervalMs!==0 || actor.position?.range==='ranged' || (Object.keys(t.stats) as (keyof typeof t.stats)[]).some(k=>actor.stats[k]!==t.stats[k]))return 'invalid-totem-state';
  if(!c.knownSpells.includes(t.sourceSpellKey) || !catalog.classes.training.some(o=>o.classKey===c.classKey&&o.spellKey===t.sourceSpellKey&&o.level<=c.level))return 'unknown-spell';
}
export function retireTotem(checkpoint: Checkpoint, totem: TotemActor): void {
  totem.health=0;totem.defeatedAtMs??=checkpoint.simMs;
  for(const actor of checkpoint.state.encounter?.actors??[])actor.auras=actor.auras?.filter(a=>a.sourceId!==totem.id);
}
export function retireUnavailableTotems(checkpoint: Checkpoint): void {
  for(const actor of checkpoint.state.encounter?.actors??[])if(actor.kind==='totem' && (actor.health===0 || actor.expiresAtMs<=checkpoint.simMs || targetReason(actor,actor,checkpoint.state,'self')))retireTotem(checkpoint,actor);
}
export function summonTotem(checkpoint: Checkpoint, owner: ActorState, catalog: Catalog, templateId: string): TotemActor {
  const t=catalog.classes!.shaman.totems.find(t=>t.id===templateId)!;
  for(const actor of checkpoint.state.encounter!.actors)if(actor.kind==='totem'&&actor.ownerActorId===owner.id&&actor.element===t.element&&actor.health>0)retireTotem(checkpoint,actor);
  const totem:TotemActor={kind:'totem',id:`totem:${owner.id}:${t.element}:${checkpoint.nextSequence}`,ownerActorId:owner.id,partySlotsConsumed:0,templateId:t.id,sourceSpellKey:t.sourceSpellKey,element:t.element,stats:{...t.stats},health:t.stats.maxHealth,maxHealth:t.stats.maxHealth,resource:0,maxResource:0,nextAttackMs:0,auras:[],threat:{},cooldowns:{},summonedAtMs:checkpoint.simMs,expiresAtMs:checkpoint.simMs+t.durationMs,nextPulseMs:checkpoint.simMs+t.intervalMs};
  checkpoint.state.encounter!.actors.push(totem);
  scheduleEvent(checkpoint,totem.nextPulseMs,{type:'totem-pulse',actorId:totem.id});
  scheduleEvent(checkpoint,totem.expiresAtMs,{type:'totem-expire',actorId:totem.id});return totem;
}
/** A bounded owned starter weapon projection, invalidated by real mainhand assignment. */
export function shamanWeaponReason(actor: ActorState, state: GameState, catalog: Catalog): string | undefined {
  const c=actor.kind==='character'?state.profile.characters.find(c=>c.id===actor.characterId):undefined;
  if(!c?.classProgress || c.classKey!=='forever:class:7' || c.equipment.mainHand!==undefined || catalog.classes?.shaman?.starterMainHand!=='owned-idle-shaman-weapon')return 'unsupported-weapon';
}
