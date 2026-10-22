import type { Catalog } from '../../domain/content';
import { gameStateSchema, type GameState } from '../../domain/state';
import type { Result } from '../../domain/result';
import { materializeCharacterActor, refreshClassActors } from './creation';
import { talentValue } from './resources';
import type { ClassSnapshot } from './contracts';
export const stanceSpell = {battle:'forever:spell:2457',defensive:'forever:spell:71',berserker:'forever:spell:2458'} as const;
export function setStance(state: GameState, characterId: string, stance: ClassSnapshot['stance'], catalog: Catalog): Result<GameState> {
  if(!gameStateSchema.safeParse(state).success || state.profile.activeCharacterId!==characterId) return {ok:false,error:{code:'invalid',message:'Ungültiger Klassenstand.'}};
  const c=state.profile.characters.find(c=>c.id===characterId), rules=catalog.classes?.rules;
  if(!c?.classProgress || c.classKey!=='forever:class:1' || !rules || !stanceSpell[stance] || !c.knownSpells.includes(stanceSpell[stance]) || c.dead) return {ok:false,error:{code:'forbidden',message:'Haltung nicht gelernt.'}};
  const now=state.combatTimeMs??0;
  if(c.classProgress.stanceReadyAtMs>now || c.classProgress.stance===stance) return {ok:false,error:{code:'conflict',message:'Haltungswechsel nicht bereit.'}};
  const draft=structuredClone(state), character=draft.profile.characters.find(c=>c.id===characterId)!;
  character.classProgress!.stance=stance; character.classProgress!.stanceReadyAtMs=now+rules.stanceCooldownMs;
  character.resource=Math.min(character.resource,rules.stanceRetainedRage+talentValue(materializeCharacterActor(c),'stance-retention',catalog));
  for(const actor of draft.encounter?.actors??[]) if(actor.kind==='character' && actor.characterId===characterId) actor.resource=character.resource;
  refreshClassActors(draft,character); return {ok:true,value:draft};
}
