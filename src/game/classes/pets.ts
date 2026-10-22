import type { Catalog } from '../../domain/content';
import type { ActorState, Checkpoint, CharacterState } from '../../domain/state';
import { snapshotCharacter } from './creation';
import { talentValue } from './resources';
import { scheduleEvent } from '../simulation/queue';
import { addAura } from '../combat/auras';
/** Encounter-only owned companion. Persistent bonding/taming/revival remains T23. */
export interface PetOwnership { ownerActorId: string; partySlotsConsumed: 0; role: 'pet' | 'demon' | 'totem' }
export const warriorPetSupport = false;
export function summonPetReason(owner: ActorState, checkpoint: Pick<Checkpoint,'state'>, catalog: Catalog, templateId: string): string | undefined {
  const character=owner.kind==='character'?checkpoint.state.profile.characters.find(c=>c.id===owner.characterId):undefined;
  if(!character?.classProgress || character.classKey!=='forever:class:3' || catalog.classes?.hunterPet.id!==templateId) return 'unsupported-pet';
  // Dead records stay present. Call Pet cannot revive, replace or duplicate them.
  if(checkpoint.state.encounter?.actors.some(a=>a.kind==='pet'&&a.ownerActorId===owner.id)) return 'pet-already-present';
}
export function hunterPetStats(character: CharacterState, catalog: Catalog) {
  const definition=catalog.classes!.hunterPet;
  const owner: ActorState={kind:'character',id:character.id,characterId:character.id,health:character.health,maxHealth:character.stats.maxHealth,resource:character.resource,maxResource:character.stats.maxResource,nextAttackMs:0,classState:snapshotCharacter(character)};
  const bonus=talentValue(owner,'pet-endurance',catalog);
  return {...definition.stats,maxHealth:Math.floor(definition.stats.maxHealth*(10000+bonus)/10000),armor:Math.floor(definition.stats.armor*(10000+bonus)/10000)};
}
export function summonHunterPet(checkpoint: Checkpoint, owner: ActorState, catalog: Catalog): ActorState {
  const definition=catalog.classes!.hunterPet,character=checkpoint.state.profile.characters.find(c=>owner.kind==='character'&&c.id===owner.characterId)!;
  const stats=hunterPetStats(character,catalog);
  const pet: ActorState={kind:'pet',id:`pet:${owner.id}`,ownerActorId:owner.id,partySlotsConsumed:0,templateId:definition.id,sourceSpellKey:definition.sourceSpellKey,stats,health:stats.maxHealth,maxHealth:stats.maxHealth,resource:definition.initialResource,maxResource:stats.maxResource,nextAttackMs:checkpoint.simMs+1,cooldowns:{},auras:[],threat:{},rules:structuredClone(definition.rules),knownSpells:[...definition.knownSpells],position:{range:'melee',sector:'front'}};
  checkpoint.state.encounter!.actors.push(pet);
  addAura(checkpoint,pet,{type:'periodic-resource',auraId:'idle-pet-focus',amount:definition.focusPerTick,intervalMs:definition.focusIntervalMs,durationMs:definition.focusDurationMs},pet.id);
  scheduleEvent(checkpoint,checkpoint.simMs+1,{type:'combat-decision',actorId:pet.id});return pet;
}
