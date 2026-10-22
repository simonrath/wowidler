import type { Catalog } from '../../domain/content';
import { gameStateSchema, type GameState, type CharacterState } from '../../domain/state';
import type { EntityKey } from '../../domain/ids';
import type { Result } from '../../domain/result';
import { refreshClassActors } from './creation';
export interface LearnAbilityInput { characterId: string; trainerId: string; spellKey: EntityKey }
export const classFailure = (message: string): Result<GameState> => ({ok:false,error:{code:'forbidden',message}});
export function classCommandReason(state: GameState, characterId: string): string | undefined {
  if(!gameStateSchema.safeParse(state).success) return 'Ungültiger Klassenstand.';
  const c=state.profile.characters.find(c=>c.id===characterId);
  if(!c?.classProgress || c.dead || state.profile.activeCharacterId!==characterId) return 'Aktiver Klassencharakter fehlt.';
  if(state.encounter?.status==='running' || c.activity) return 'Nur außerhalb einer Tätigkeit möglich.';
}
export function trainerReason(character: CharacterState, trainerId: string, catalog: Catalog, majorCity=false): string | undefined {
  const trainer=catalog.classes?.trainers.find(t=>t.id===trainerId && t.classKey===character.classKey);
  if(!trainer || !trainer.locations.includes(character.locationKey) || (majorCity&&!trainer.majorCity)) return 'Passender Lehrer am aktuellen Ort erforderlich.';
}
export function learnAbility(state: GameState, input: LearnAbilityInput, catalog: Catalog): Result<GameState> {
  const reason=classCommandReason(state,input.characterId);if(reason)return classFailure(reason);
  const c=state.profile.characters.find(c=>c.id===input.characterId)!;
  if((c.classKey==='forever:class:7' && !catalog.classes?.shaman) || !catalog.classes?.definitions.some(d=>d.key===c.classKey && d.mechanics==='playable'))return classFailure('Klassenpaket nicht verfügbar.');
  const trainer=trainerReason(c,input.trainerId,catalog);if(trainer)return classFailure(trainer);
  const offer=catalog.classes?.training.find(o=>o.spellKey===input.spellKey && o.classKey===c.classKey);
  if(!offer || c.level<offer.level || c.moneyCopper<offer.cost || c.knownSpells.includes(input.spellKey) || (offer.previousRank&&!c.knownSpells.includes(offer.previousRank)) || (offer.questKey&&!c.quests.some(q=>q.questKey===offer.questKey && q.status==='rewarded'))) return classFailure('Voraussetzungen für diesen Rang fehlen.');
  if(offer.reagents.some(r=>c.inventory.filter(s=>s.itemKey===r.itemKey).reduce((n,s)=>n+s.quantity,0)<r.quantity)) return classFailure('Reagenzien fehlen.');
  const draft=structuredClone(state), next=draft.profile.characters.find(c=>c.id===input.characterId)!;
  next.moneyCopper-=offer.cost;next.knownSpells.push(input.spellKey);
  for(const reagent of offer.reagents){let count=reagent.quantity;for(const stack of next.inventory)if(stack.itemKey===reagent.itemKey){const n=Math.min(stack.quantity,count);stack.quantity-=n;count-=n;}}
  next.inventory=next.inventory.filter(s=>s.quantity>0);refreshClassActors(draft,next,catalog);
  return {ok:true,value:draft};
}
