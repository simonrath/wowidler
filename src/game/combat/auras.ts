import { totemStateReason } from '../classes/totems';
import type { Effect, Catalog } from '../../domain/content';
import type { ActorState, Checkpoint, GameState } from '../../domain/state';
import { scheduleEvent } from '../simulation/queue';
export function activeAuras(actor: ActorState, now: number) { return (actor.auras ?? []).filter(a => a.expiresAtMs > now); }
export function addAura(checkpoint: Checkpoint, target: ActorState, effect: Effect, sourceId: string): void {
  if (!('auraId' in effect)) throw new Error('Effect is not an aura');
  target.auras ??= [];
  const old = target.auras.find(a => a.id === effect.auraId && a.sourceId === sourceId);
  const token = `aura:${target.id}:${checkpoint.nextSequence}`;
  const aura = { id: effect.auraId, sourceId, token, expiresAtMs: checkpoint.simMs + effect.durationMs, stacks: effect.type === 'buff' ? Math.min(effect.maxStacks, (old?.stacks ?? 0) + 1) : 1, effect, ...(effect.type === 'absorb' ? { remaining: effect.amount } : {}) };
  target.auras = target.auras.filter(a => a !== old && !(effect.exclusiveGroup && 'exclusiveGroup' in a.effect && a.effect.exclusiveGroup===effect.exclusiveGroup && a.sourceId===sourceId)); target.auras.push(aura);
  scheduleEvent(checkpoint, aura.expiresAtMs, { type: 'aura-expire', targetId: target.id, token });
  if ((effect.type === 'periodic' || effect.type === 'periodic-resource' || effect.type === 'periodic-heal') && checkpoint.simMs + effect.intervalMs < aura.expiresAtMs) scheduleEvent(checkpoint, checkpoint.simMs + effect.intervalMs, { type: 'aura-tick', targetId: target.id, token });
}

/** Totem buffs and projected weapon imbues never outlive their valid source. */
export function activeCombatAuras(actor: ActorState, state: GameState, now: number, catalog?: Catalog) {
  return activeAuras(actor,now).filter(a=>{
    if(a.id==='shaman-rockbiter') {const c=actor.kind==='character'?state.profile.characters.find(c=>c.id===actor.characterId):undefined;if(c?.classKey!=='forever:class:7'||c.equipment.mainHand!==undefined)return false;}
    const source=state.encounter?.actors.find(x=>x.id===a.sourceId);
    if(source?.kind!=='totem')return true;
    if(totemStateReason(source,state,catalog))return false;
    const owner=state.encounter?.actors.find(x=>x.id===source.ownerActorId);
    const c=owner?.kind==='character'?state.profile.characters.find(c=>c.id===owner.characterId):undefined;
    return source.health>0 && source.expiresAtMs>now && owner?.health!==0 && c?.locationKey===state.encounter?.locationKey && state.encounter?.status==='running';
  });
}
