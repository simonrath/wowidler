import type { ActorState, GameState } from '../../domain/state';
import type { CombatSpell } from '../../domain/content';
export function side(actor: ActorState): 'ally' | 'enemy' { return actor.kind==='character' || actor.kind==='pet' || actor.kind==='totem' || actor.allegiance==='ally' ? 'ally' : 'enemy'; }
export function actorById(state: GameState, id: string): ActorState {
  const actor = state.encounter?.actors.find(a => a.id === id);
  if (!actor) throw new Error(`Unknown combat actor: ${id}`);
  return actor;
}
export function targetReason(actor: ActorState, target: ActorState, state: GameState, kind: CombatSpell['target'], melee = false, sector?: CombatSpell['sector'], ranged = false): string | undefined {
  if (!state.encounter || state.encounter.status !== 'running') return 'encounter-not-running';
  if (actor.health === 0) return 'actor-dead';
  if (target.health === 0) return 'target-dead';
  if ((kind === 'enemy' && side(actor) === side(target)) || (kind === 'ally' && side(actor) !== side(target)) || (kind === 'self' && actor.id !== target.id)) return 'invalid-target';
  for(const unit of [actor,target]) {const reason=petOwnerReason(unit,state);if(reason)return reason; if(unit.kind==='character'&&state.profile.characters.find(c=>c.id===unit.characterId)?.locationKey!==state.encounter.locationKey)return 'different-zone';}
  if(ranged && actor.position?.range!=='ranged') return 'out-of-range';
  // Absence represents the legacy encounter's unpositioned melee formation, not invented coordinates.
  if (melee && (actor.position?.range === 'ranged' || target.position?.range === 'ranged')) return 'out-of-range';
  if (sector && actor.position?.sector !== sector) return 'wrong-sector';
}

/** Hunter auto shot and melee swings share the existing ordered attack clock. */
export function isRangedAttack(actor: ActorState): boolean {return actor.classState?.classKey==='forever:class:3' && actor.position?.range==='ranged';}

export function petOwnerReason(actor: ActorState, state: GameState): string | undefined {
  if(actor.kind!=='pet' && actor.kind!=='totem')return;
  const owner=state.encounter?.actors.find(a=>a.id===actor.ownerActorId);
  if(owner?.kind!=='character'||owner.health===0)return actor.kind==='totem'?'totem-owner-unavailable':'pet-owner-unavailable';
  if(state.profile.characters.find(c=>c.id===owner.characterId)?.locationKey!==state.encounter?.locationKey)return 'different-zone';
}

/** Bounded owned formation transition, not a general movement/yard system. */
export function canApproachHunter(actor: ActorState, target: ActorState, state: GameState, requireRanged = true): boolean {
  return actor.kind==='npc' && side(actor)==='enemy' && actor.position?.range!=='ranged' && target.kind==='character' && target.classState?.classKey==='forever:class:3' && (!requireRanged || target.position?.range==='ranged') && !targetReason(actor,target,state,'enemy');
}
