import { summonTotemReason, summonTotem } from '../classes/totems';
import { summonPetReason, summonHunterPet } from '../classes/pets';
import { classExecutionReason, deriveActor, gainDamageRage } from '../classes/resources';
import { snapshotCharacter } from '../classes/creation';
import { combatEffectSchema, type Effect, type Catalog } from '../../domain/content';
import type { EntityKey } from '../../domain/ids';
import { gameStateSchema, type ActorState, type Checkpoint } from '../../domain/state';
import type { ScheduledEvent } from '../../domain/events';
import { cancelAction, scheduleEvent } from '../simulation/queue';
import { activeAuras, addAura } from './auras';
import { actorById, targetReason, petOwnerReason } from './positions';
import { addThreat } from './threat';
export type { Effect } from '../../domain/content';
export interface EffectContext { actorId: string; targetId: string; actionId?: string; sourceKey?: EntityKey; establishedMeleeImpact?: boolean }
export interface Resolution { ok: boolean; checkpoint: Checkpoint; scheduled: ScheduledEvent[]; outcomes: { type: string; amount?: number }[]; reason?: string }
export function synchronizeActor(checkpoint: Checkpoint, actor: ActorState): void {
  if (actor.kind !== 'character') return;
  const character = checkpoint.state.profile.characters.find(c => c.id === actor.characterId)!;
  character.health = actor.health; character.resource = actor.resource; character.dead = actor.health === 0;
}
export function applyEffects(checkpoint: Checkpoint, effects: Effect[], context: EffectContext, catalog?: Catalog): Resolution {
  if(!gameStateSchema.safeParse(checkpoint.state).success) return {ok:false,checkpoint,scheduled:[],outcomes:[],reason:'invalid-class-state'};
  const draft = structuredClone(checkpoint), sequence = draft.nextSequence;
  const outcomes: Resolution['outcomes'] = [];
  if (effects.some(e => !combatEffectSchema.safeParse(e).success)) return { ok: false, checkpoint, scheduled: [], outcomes, reason: 'unsupported-effect' };
  const target = actorById(draft.state, context.targetId), source = actorById(draft.state, context.actorId);
  const classReason=classExecutionReason(source,draft.state,catalog)??classExecutionReason(target,draft.state,catalog);
  const petReason=petOwnerReason(source,draft.state)??petOwnerReason(target,draft.state);
  if(petReason)return {ok:false,checkpoint,scheduled:[],outcomes:[],reason:petReason};
  if(classReason)return {ok:false,checkpoint,scheduled:[],outcomes:[],reason:classReason};
  if(source.kind==='totem' || target.kind==='totem' || source.classState?.classKey==='forever:class:7' || target.classState?.classKey==='forever:class:7') {
    for(const effect of effects){const kind=['damage','periodic','interrupt','threat'].includes(effect.type)?'enemy':effect.type==='summon-totem'?'self':'ally';const simultaneous=context.establishedMeleeImpact && (effect.type==='damage'||effect.type==='periodic');const reason=targetReason(simultaneous?{...source,health:Math.max(1,source.health)}:source,simultaneous?{...target,health:Math.max(1,target.health)}:target,draft.state,kind);if(reason)return {ok:false,checkpoint,scheduled:[],outcomes:[],reason};}
    if((source.kind==='totem'&&source.expiresAtMs<=draft.simMs)||(target.kind==='totem'&&target.expiresAtMs<=draft.simMs))return {ok:false,checkpoint,scheduled:[],outcomes:[],reason:'totem-expired'};
  }
  const derived = (actor: ActorState) => {
    const c = actor.kind === 'character' ? draft.state.profile.characters.find(c => c.id === actor.characterId) : undefined;
    return c?.classProgress ? deriveActor({ ...actor, classState: snapshotCharacter(c) }, catalog!) : { damageBps:10000, takenBps:10000, threatBps:10000 };
  };
  const sourceModifiers=derived(source), targetModifiers=derived(target);
  for (const effect of effects) {
    switch (effect.type) {
      case 'damage': {
        const auras = activeAuras(target, draft.simMs);
        const stats = target.kind !== 'character' ? target.stats : target.classState ? deriveActor({...target,classState:snapshotCharacter(draft.state.profile.characters.find(c=>c.id===target.characterId)!)},catalog!).stats : draft.state.profile.characters.find(c => c.id === target.characterId)!.stats;
        const armor = stats.armor + auras.reduce((n, a) => n + (a.effect.type === 'buff' ? a.effect.armor * a.stacks : 0), 0);
        const modified=Math.floor(Math.floor(effect.amount*sourceModifiers.damageBps/10000)*targetModifiers.takenBps/10000);
        let amount = auras.some(a => a.effect.type === 'immunity' && a.effect.school === effect.school) ? 0 : effect.school === 'physical' ? Math.floor(modified * 100 / (100 + armor)) : modified;
        for (const aura of auras) if (aura.effect.type === 'absorb') { const absorbed = Math.min(amount, aura.remaining ?? 0); aura.remaining = (aura.remaining ?? 0) - absorbed; amount -= absorbed; }
        amount = Math.min(target.health, amount); target.health -= amount;
        const holyThreat=effect.school==='holy'?activeAuras(source,draft.simMs).reduce((n,a)=>a.effect.type==='buff'?Math.max(n,a.effect.holyThreatBps??10000):n,10000):10000;
        addThreat(target, source.id, amount, Math.floor((effect.threatMultiplierBps??10000)*sourceModifiers.threatBps*holyThreat/100000000));
        // A successful hostile hit also engages the attacker's victim, even before
        // the victim has dealt damage. Zero records contact without invented threat.
        if(amount>0 && source.kind!=='character' && !targetReason(source,target,draft.state,'enemy')) {
          source.threat ??= {}; source.threat[target.id] ??= 0;
        }
        gainDamageRage(source,amount,false,catalog);gainDamageRage(target,amount,true,catalog);
        outcomes.push({ type: effect.type, amount });
        if (target.health === 0 && amount > 0) scheduleEvent(draft, draft.simMs, { type: 'death', actorId: target.id });
        break;
      }
      case 'summon-totem': {
        const reason=targetReason(source,target,draft.state,'self')??(catalog?summonTotemReason(source,draft.state,catalog,effect.templateId):'missing-class-package');
        if(reason)return {ok:false,checkpoint,scheduled:[],outcomes:[],reason};
        summonTotem(draft,source,catalog!,effect.templateId);outcomes.push({type:effect.type});break;
      }
      case 'summon-pet': {
        const reason=targetReason(source,target,draft.state,'self')??(catalog?summonPetReason(source,draft,catalog,effect.templateId):'missing-class-package');
        if(reason)return {ok:false,checkpoint,scheduled:[],outcomes:[],reason};
        summonHunterPet(draft,source,catalog!);outcomes.push({type:effect.type});break;
      }
      case 'threat': {
        const reason=targetReason(source,target,draft.state,'enemy',true);if(reason)return {ok:false,checkpoint,scheduled:[],outcomes:[],reason};
        target.threat??={};target.threat[source.id]=Math.max(0,...Object.values(target.threat))+effect.amount;outcomes.push({type:effect.type,amount:effect.amount});break;
      }
      case 'resource': {
        const amount=target.health===0?0:Math.min(effect.amount,target.maxResource-target.resource);target.resource+=amount;outcomes.push({type:effect.type,amount});break;
      }
      case 'heal': {
        const amount = target.health === 0 ? 0 : Math.min(effect.amount, target.maxHealth - target.health); target.health += amount;
        for (const enemy of draft.state.encounter?.actors ?? []) if (!targetReason(source,target,draft.state,'ally') && !targetReason(enemy,target,draft.state,'enemy') && enemy.threat?.[target.id] !== undefined) addThreat(enemy, source.id, Math.floor(amount / 2));
        outcomes.push({ type: effect.type, amount }); break;
      }
      case 'interrupt':
        if (target.casting) {
          cancelAction(draft, target.casting.actionId); delete target.casting;
          if (target.health > 0 && draft.state.encounter?.status === 'running') scheduleEvent(draft, draft.simMs + 1, { type: 'combat-decision', actorId: target.id });
        }
        outcomes.push({ type: effect.type }); break;
      case 'absorb': case 'immunity': case 'buff': case 'periodic': case 'periodic-resource': case 'periodic-heal': case 'marker':
        addAura(draft, target, effect, source.id); outcomes.push({ type: effect.type }); break;
      case 'next-melee':
        return { ok: false, checkpoint, scheduled: [], outcomes: [], reason: 'next-melee-requires-action' };
      case 'create-item': {
        if (source.kind !== 'character' || !context.sourceKey) return { ok: false, checkpoint, scheduled: [], outcomes: [], reason: 'item-output-requires-recipe' };
        const character = draft.state.profile.characters.find(c => c.id === source.characterId)!;
        const id = `craft:${context.actionId}:${character.pendingRewards.length}`;
        character.pendingRewards.push({ id, sourceKey: context.sourceKey, moneyCopper: 0, experience: 0, items: [{ instanceId: `${id}:item`, itemKey: effect.itemKey, quantity: effect.quantity }] });
        outcomes.push({ type: effect.type, amount: effect.quantity }); break;
      }
    }
  }
  synchronizeActor(draft, target); synchronizeActor(draft, source);
  return { ok: true, checkpoint: draft, scheduled: draft.queue.filter(e => e.sequence >= sequence), outcomes };
}
