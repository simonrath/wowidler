import { summonTotemReason, shamanWeaponReason, retireTotem, retireUnavailableTotems } from '../classes/totems';
import { summonPetReason } from '../classes/pets';
import { classExecutionReason, deriveActor, spellForActor, talentValue, rogueEnergyEffect, rogueWeaponProjectionReason } from '../classes/resources';
import { snapshotCharacter } from '../classes/creation';
import { gameStateSchema } from '../../domain/state';
import { combatSpellSchema, contentPacketSchema, type Catalog, type CombatSpell, type ContentPacket } from '../../domain/content';
import type { EntityKey } from '../../domain/ids';
import type { ActorState, Checkpoint } from '../../domain/state';
import { requirePlayable, starterCapabilities, validatePlayablePacket } from '../../content/capabilities';
import { cancelAction, scheduleEvent } from '../simulation/queue';
import { SimulationFault, type DispatchContext } from '../simulation/advance';
import { activeAuras, activeCombatAuras, addAura } from './auras';
import { applyEffects, synchronizeActor, type Resolution } from './effects';
import { actorById, targetReason, side, isRangedAttack, petOwnerReason, canApproachHunter } from './positions';
import { chooseAction } from './tactics';

export type CombatAction = { type: 'attack'; actorId: string; targetId: string } | { type: 'flee'; actorId: string; targetId: string } | { type: 'cast'; actorId: string; targetId: string; spellKey: EntityKey };
/** These timing constants are named owned Idle adaptations, never purported source values. */
export const IDLE_COMBAT_RULES = { version: 'idle-combat-v1', decisionImpactDelayMs: 1, spellGcdMs: 1500, attackPowerDivisor: 14, armorDenominator: 100, criticalMultiplier: 2 } as const;
export interface CombatCatalog extends Catalog { readonly packet: ContentPacket; readonly combat: { readonly spells: readonly CombatSpell[] } }
export function createCombatCatalog(input: ContentPacket): CombatCatalog {
  const packet = contentPacketSchema.parse(input);
  const validation = validatePlayablePacket(packet, starterCapabilities);
  if (!validation.ok) throw new Error(`Invalid combat packet: ${JSON.stringify(validation.issues)}`);
  const spells = packet.spells.map(spell => {
    const melee = spell.effects.find(e => e.type === 'next-melee');
    const recipe = packet.recipes.find(r => r.spellKey === spell.key);
    if (!melee && !recipe) throw new Error(`Missing explicit execution timing: ${spell.key}`);
    return combatSpellSchema.parse({ ...spell, castMs: recipe?.durationMs ?? 0, gcdMs: melee ? 0 : IDLE_COMBAT_RULES.spellGcdMs, resourceCost: melee?.resourceCost ?? 0, target: melee ? 'enemy' : 'self' });
  });
  return { packet, combat: { spells }, entities: packet.entities, get: key => packet.entities.find(e => e.key === key), requirePlayable(key) {
    const entity = packet.entities.find(e => e.key === key);
    return entity ? requirePlayable(entity) : { ok: false, error: { code: 'missing-content', message: `Missing entity: ${key}` } };
  } };
}
export function statsFor(actor: ActorState, checkpoint: Checkpoint, catalog?: Catalog) {
  const c=actor.kind==='character'?checkpoint.state.profile.characters.find(c=>c.id===actor.characterId):undefined;
  const reason=classExecutionReason(actor,checkpoint.state,catalog);if(reason)throw Error(reason);
  const stats=c?.classProgress ? deriveActor({...actor,classState:snapshotCharacter(c)},catalog!).stats : actor.kind !== 'character' ? actor.stats : c!.stats;
  const attackPower=stats.attackPower+activeCombatAuras(actor,checkpoint.state,checkpoint.simMs,catalog).reduce((n,a)=>n+(a.effect.type==='buff'?(a.effect.attackPower??0)*a.stacks:0),0);
  return {...stats,attackPower};
}
export function actionReason(checkpoint: Pick<Checkpoint, 'state' | 'simMs'>, action: CombatAction, catalog: Catalog): string | undefined {
  const actor = checkpoint.state.encounter?.actors.find(a => a.id === action.actorId), target = checkpoint.state.encounter?.actors.find(a => a.id === action.targetId);
  if (!actor || !target) return 'missing-actor';
  if (!gameStateSchema.safeParse(checkpoint.state).success) return 'invalid-class-state';
  const classReason=classExecutionReason(actor,checkpoint.state,catalog)??classExecutionReason(target,checkpoint.state,catalog);
  if(classReason)return classReason;
  if(actor.kind==='totem')return 'totem-pulse-only';
  if (action.type === 'flee') return targetReason(actor, actor, checkpoint.state, 'self');
  if (actor.casting) return 'already-casting';
  if (action.type === 'attack') {
    const invalid = targetReason(actor, target, checkpoint.state, 'enemy', !isRangedAttack(actor));
    return (invalid==='out-of-range' && canApproachHunter(actor,target,checkpoint.state)?undefined:invalid) ?? (actor.pendingMelee ? 'next-melee-pending' : actor.nextAttackMs > checkpoint.simMs ? 'attack-not-ready' : undefined);
  }
  const character = actor.kind === 'character' ? checkpoint.state.profile.characters.find(c => c.id === actor.characterId) : undefined;
  if(['forever:spell:8017','forever:spell:8018'].includes(action.spellKey)){const reason=shamanWeaponReason(actor,checkpoint.state,catalog);if(reason)return reason;}
  const baseSpell = catalog.combat?.spells.find(s => s.key === action.spellKey);
  const weaponReason=baseSpell?rogueWeaponProjectionReason(baseSpell,actor,catalog,character):undefined;if(weaponReason)return weaponReason;
  const spell=baseSpell?spellForActor(baseSpell,actor,catalog,checkpoint.simMs,character):undefined;
  if (!spell) return 'unsupported-spell';
  if (!combatSpellSchema.safeParse(spell).success) return 'unsupported-effect';
  const knownSpells=actor.kind==='pet'?actor.knownSpells:character?.knownSpells;
  if (!knownSpells?.includes(spell.key)) return 'unknown-spell';
  if(character && ['forever:class:4','forever:class:5','forever:class:7'].includes(character.classKey) && !catalog.classes?.training.some(t=>t.classKey===character.classKey&&t.spellKey===spell.key))return 'unknown-spell';
  if (character && character.level < spell.minLevel) return 'level-too-low';
  if ((actor.gcdUntilMs ?? 0) > checkpoint.simMs) return 'global-cooldown';
  if (Math.max(actor.cooldowns?.[spell.key] ?? 0, character?.cooldowns[spell.key] ?? 0) > checkpoint.simMs) return 'spell-cooldown';
  if(spell.cooldownGroup && Math.max(actor.cooldowns?.[spell.cooldownGroup]??0,character?.cooldowns[spell.cooldownGroup]??0)>checkpoint.simMs)return 'spell-cooldown';
  if(actor.kind==='pet' && !catalog.classes!.hunterPet.knownSpells.includes(spell.key))return 'unknown-spell';
  if(spell.requiredStances && (!character?.classProgress || !spell.requiredStances.includes(character.classProgress.stance))) return 'wrong-stance';
  if(spell.healthCost!==undefined && actor.health<=spell.healthCost) return 'insufficient-health';
  for(const reagent of spell.reagents??[]) if(!character || character.inventory.filter(s=>s.itemKey===reagent.itemKey).reduce((n,s)=>n+s.quantity,0)<reagent.quantity)return 'missing-reagents';
  if(spell.requiredWeapon && (!character || character.classKey!=='forever:class:4' || character.equipment.mainHand!==undefined || catalog.classes?.rogue.starterMainHand!=='owned-idle-dagger'))return 'unsupported-weapon';
  if(spell.combo==='spender' && (actor.combo?.targetId!==target.id || !actor.combo.points))return 'wrong-combo-target';
  if(spell.blockedByTargetAura && activeAuras(target,checkpoint.simMs).some(a=>a.id===spell.blockedByTargetAura))return 'target-aura-blocked';
  if (actor.resource < spell.resourceCost) return 'insufficient-resource';
  const melee = spell.effects.some(e => e.type === 'next-melee');
  if (melee && spell.effects.length !== 1) return 'unsupported-effect-combination';
  if (melee && actor.pendingMelee) return 'next-melee-pending';
  const invalid = targetReason(actor, target, checkpoint.state, spell.target, melee || spell.meleeRange, spell.sector, spell.rangedRange); if (invalid) return invalid;
  for(const effect of spell.effects)if(effect.type==='summon-totem'){const reason=summonTotemReason(actor,checkpoint.state,catalog,effect.templateId);if(reason)return reason;}
  for(const effect of spell.effects) if(effect.type==='summon-pet') {const reason=summonPetReason(actor,checkpoint,catalog,effect.templateId);if(reason)return reason;}
  if (spell.effects.some(e => e.type === 'create-item')) {
    if(!character) return 'profession-requires-character';
    const recipe = catalog.packet?.recipes.find(r => r.spellKey === spell.key);
    if (!recipe) return 'missing-recipe';
    if (!character.professions.some(p => p.professionKey === recipe.professionKey && p.skill >= recipe.minSkill)) return 'profession-too-low';
    for (const reagent of recipe.reagents) if (character.inventory.filter(s => s.itemKey === reagent.itemKey).reduce((n, s) => n + s.quantity, 0) < reagent.quantity) return 'missing-reagents';
  }
}
export function resolveAction(checkpoint: Checkpoint, action: CombatAction, catalog: Catalog): Resolution {
  const reason = actionReason(checkpoint, action, catalog);
  if (reason) return { ok: false, reason, checkpoint, scheduled: [], outcomes: [] };
  const draft = structuredClone(checkpoint), sequence = draft.nextSequence;
  draft.state.combatTimeMs = draft.simMs;
  const actor = actorById(draft.state, action.actorId);
  const actionId = `action:${actor.id}:${draft.simMs}:${sequence}`;
  if (action.type === 'flee') { draft.state.encounter!.status = 'fled'; return { ok: true, checkpoint: draft, scheduled: [], outcomes: [] }; }
  ensureRogueEnergy(draft,actor,catalog);
  if (action.type === 'attack') {
    // Decisions never insert a same-timestamp earlier-phase impact.
    const closeDistance=canApproachHunter(actor,actorById(draft.state,action.targetId),draft.state);
    const delay=closeDistance?catalog.classes!.rules.hunterApproachMs:IDLE_COMBAT_RULES.decisionImpactDelayMs;
    scheduleEvent(draft, draft.simMs + delay, { type: 'melee-impact', ...(isRangedAttack(actor)?{ranged:true}:{}), ...(closeDistance?{closeDistance:true}:{}), actorId: actor.id, targetId: action.targetId, bonusDamage: 0, threatMultiplierBps: 10000 }, { actionId });
    actor.nextAttackMs = draft.simMs + (closeDistance?delay:0) + statsFor(actor, draft, catalog).attackIntervalMs;
  } else {
    const character = draft.state.profile.characters.find(c => actor.kind === 'character' && c.id === actor.characterId)!;
    const spell = spellForActor(catalog.combat!.spells.find(s => s.key === action.spellKey)!,actor,catalog,draft.simMs,character);
    actor.resource -= spell.resourceCost; actor.gcdUntilMs = draft.simMs + spell.gcdMs;
    actor.cooldowns ??= {}; actor.cooldowns[spell.key] = draft.simMs + spell.cooldownMs;
    if(character) character.cooldowns[spell.key] = actor.cooldowns[spell.key];
    if(spell.cooldownGroup) {actor.cooldowns[spell.cooldownGroup]=actor.cooldowns[spell.key];if(character)character.cooldowns[spell.cooldownGroup]=actor.cooldowns[spell.key];}
    actor.health-=spell.healthCost??0;
    for(const reagent of spell.reagents??[]){let remaining=reagent.quantity;for(const stack of character!.inventory)if(stack.itemKey===reagent.itemKey){const used=Math.min(stack.quantity,remaining);stack.quantity-=used;remaining-=used;}}
    if(character) character.inventory=character.inventory.filter(s=>s.quantity>0);
    const melee = spell.effects.find(e => e.type === 'next-melee');
    if (melee) {
      actor.pendingMelee = { actionId, targetId: action.targetId, bonusDamage: melee.bonusDamage, threatMultiplierBps: melee.threatMultiplierBps };
      const pending = draft.queue.find(e => e.event.type === 'melee-impact' && e.event.actorId === actor.id);
      const atMs = pending?.atMs ?? Math.max(draft.simMs + 1, actor.nextAttackMs);
      if (pending?.actionId) cancelAction(draft, pending.actionId);
      else if (pending) return { ok: false, checkpoint, scheduled: [], outcomes: [], reason: 'unowned-melee-impact' };
      scheduleEvent(draft, atMs, { type: 'melee-impact', actorId: actor.id, targetId: action.targetId, bonusDamage: melee.bonusDamage, threatMultiplierBps: melee.threatMultiplierBps }, { actionId });
      actor.nextAttackMs = pending ? actor.nextAttackMs : atMs + statsFor(actor, draft, catalog).attackIntervalMs;
    } else {
      const recipe = catalog.packet?.recipes.find(r => r.spellKey === spell.key);
      if (recipe) for (const reagent of recipe.reagents) {
        let remaining = reagent.quantity;
        for (const stack of character.inventory) if (stack.itemKey === reagent.itemKey) { const used = Math.min(stack.quantity, remaining); stack.quantity -= used; remaining -= used; }
        character.inventory = character.inventory.filter(s => s.quantity > 0);
      }
      actor.casting = { actionId, spellKey: spell.key, targetId: action.targetId, endsAtMs: draft.simMs + Math.max(1, spell.castMs) };
      scheduleEvent(draft, actor.casting.endsAtMs, { type: 'cast-complete', actorId: actor.id, actionId }, { actionId });
    }
    synchronizeActor(draft, actor);
  }
  return { ok: true, checkpoint: draft, scheduled: draft.queue.filter(e => e.sequence >= sequence), outcomes: [] };
}
/** Replays pure results through the scheduler's guarded scheduling/cancellation boundary. */
function accept(context: DispatchContext, resolution: Resolution): void {
  if (!resolution.ok) throw new Error(resolution.reason);
  const original = context.checkpoint, next = resolution.checkpoint;
  const retainedSequences = new Set(next.queue.map(e => e.sequence));
  // Interrupts remove only action-owned entries; preserve unrelated queue entries.
  for (const event of original.queue) if (!retainedSequences.has(event.sequence) && event.actionId) context.cancel(event.actionId);
  original.state = next.state;
  for (const event of [...resolution.scheduled].sort((a, b) => a.sequence - b.sequence)) context.schedule(event.atMs, event.event, { phase: event.phase, actionId: event.actionId });
}
function scheduleDecision(context: DispatchContext, actor: ActorState, atMs: number): void {
  // Energy wakeups must not multiply pending attack/GCD decision chains over long runs.
  if(actor.classState?.classKey==='forever:class:4' && context.checkpoint.queue.some(e=>e.atMs<=atMs && e.event.type==='combat-decision' && e.event.actorId===actor.id))return;
  context.schedule(atMs,{type:'combat-decision',actorId:actor.id});
}
function resumeDecision(context: DispatchContext, actor: ActorState): void {
  if (actor.health > 0 && context.checkpoint.state.encounter?.status === 'running') scheduleDecision(context,actor,context.checkpoint.simMs + 1);
}
function ensureRogueEnergy(checkpoint: Checkpoint, actor: ActorState, catalog: Catalog): void {
  if(targetReason(actor,actor,checkpoint.state,'self'))return;
  const effect=rogueEnergyEffect(actor,catalog);
  if(effect && !activeAuras(actor,checkpoint.simMs).some(a=>a.id==='idle-rogue-energy'&&a.sourceId===actor.id)) addAura(checkpoint,actor,effect,actor.id);
}
function decide(context: DispatchContext, actor: ActorState): void {
  if(actor.classState?.classKey==='forever:class:4' && !targetReason(actor,actor,context.checkpoint.state,'self')) {
    const reason=classExecutionReason(actor,context.checkpoint.state,context.catalog);if(reason)throw Error(reason);
    if(!activeAuras(actor,context.checkpoint.simMs).some(a=>a.id==='idle-rogue-energy'&&a.sourceId===actor.id)) {
      accept(context,applyEffects(context.checkpoint,[rogueEnergyEffect(actor,context.catalog)!],{actorId:actor.id,targetId:actor.id},context.catalog));
      actor=actorById(context.checkpoint.state,actor.id);
    }
  }
  const choice = chooseAction(actor, context.checkpoint.state, context.catalog);
  if (choice.action) { accept(context, resolveAction(context.checkpoint, choice.action, context.catalog)); return; }
  if (actor.health === 0 || actor.casting || actor.pendingMelee || context.checkpoint.state.encounter?.status !== 'running') return;
  const now = context.checkpoint.simMs;
  const future = [actor.nextAttackMs, actor.gcdUntilMs ?? 0, ...Object.values(actor.cooldowns ?? {})].filter(t => t > now);
  if (future.length) scheduleDecision(context,actor,Math.min(...future));
}
export function dispatchCombat(context: DispatchContext): void {
  const { checkpoint, scheduled, catalog } = context, event = scheduled.event;
  checkpoint.state.combatTimeMs = checkpoint.simMs;
  retireUnavailableTotems(checkpoint);
  switch (event.type) {
    case 'totem-expire': {const totem=actorById(checkpoint.state,event.actorId);if(totem.kind==='totem'&&totem.expiresAtMs<=checkpoint.simMs)retireTotem(checkpoint,totem);return;}
    case 'totem-pulse': {
      const totem=actorById(checkpoint.state,event.actorId);
      if(totem.kind!=='totem' || totem.health===0 || totem.expiresAtMs<=checkpoint.simMs || totem.nextPulseMs!==checkpoint.simMs || targetReason(totem,totem,checkpoint.state,'self'))return;
      const reason=classExecutionReason(totem,checkpoint.state,catalog);if(reason)throw Error(reason);
      const template=catalog.classes!.shaman.totems.find(t=>t.id===totem.templateId)!;
      const kind=template.pulse.type==='damage'?'enemy':'ally';
      const eligible=checkpoint.state.encounter!.actors.filter(a=>a.kind!=='totem'&&!targetReason(totem,a,checkpoint.state,kind)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
      const targets=kind==='enemy'?eligible.slice(0,1):eligible;
      for(const target of targets)accept(context,applyEffects(checkpoint,[template.pulse],{actorId:totem.id,targetId:target.id},catalog));
      const current=actorById(checkpoint.state,totem.id);if(current.kind!=='totem')return;
      current.nextPulseMs=checkpoint.simMs+template.intervalMs;
      if(current.nextPulseMs<current.expiresAtMs)context.schedule(current.nextPulseMs,{type:'totem-pulse',actorId:current.id});
      return;
    }
    case 'attack': {
      const result = resolveAction(checkpoint, { ...event }, catalog);
      if (result.ok) accept(context, result);
      return;
    }
    case 'combat-decision': {
      const actor = actorById(checkpoint.state, event.actorId);
      decide(context, actor);
      return;
    }
    case 'tick': {
      const actor = checkpoint.state.encounter?.actors.find(a => a.kind === 'character' && a.characterId === event.characterId);
      if (!actor) throw new SimulationFault('unhandled-event', 'Combat tick requires an encounter actor');
      decide(context, actor);
      return;
    }
    case 'melee-impact': {
      const actor = actorById(checkpoint.state, event.actorId), target = actorById(checkpoint.state, event.targetId);
      // Established impacts survive a same-phase lethal hit, but not a previous timestamp death/flee/zone departure.
      if (checkpoint.state.encounter?.status !== 'running' || (actor.defeatedAtMs !== undefined && actor.defeatedAtMs < checkpoint.simMs)) return;
      if(event.closeDistance) {
        if(event.ranged || !canApproachHunter(actor,target,checkpoint.state,false)) {resumeDecision(context,actor);return;}
        const reason=classExecutionReason(actor,checkpoint.state,catalog)??classExecutionReason(target,checkpoint.state,catalog);if(reason)throw Error(reason);
        target.position={sector:target.position?.sector??'front',range:'melee'};
        resumeDecision(context,target);
      }
      const invalid = targetReason({ ...actor, health: Math.max(1, actor.health) }, { ...target, health: Math.max(1, target.health) }, checkpoint.state, 'enemy', !event.ranged);
      if (invalid || (target.defeatedAtMs !== undefined && target.defeatedAtMs < checkpoint.simMs)) { delete actor.pendingMelee; resumeDecision(context, actor); return; }
      if(event.ranged && !isRangedAttack(actor)) { resumeDecision(context,actor); return; }
      const parry=!event.ranged?talentValue(target,'hunter-parry',catalog):0;
      if(parry && context.random(1,10000)<=parry) {delete actor.pendingMelee;context.schedule(Math.max(checkpoint.simMs+1,actor.nextAttackMs),{type:'combat-decision',actorId:actor.id});return;}
      const stats = statsFor(actor, checkpoint, catalog);
      const damage = context.random(stats.minDamage, stats.maxDamage) + Math.floor(stats.attackPower * stats.attackIntervalMs / (IDLE_COMBAT_RULES.attackPowerDivisor * 1000)) + event.bonusDamage;
      const critical = context.random(1, 10000) <= stats.critChanceBps;
      delete actor.pendingMelee;
      const imbueThreat=!event.ranged?activeCombatAuras(actor,checkpoint.state,checkpoint.simMs,catalog).reduce((n,a)=>a.effect.type==='buff'?Math.max(n,a.effect.meleeThreatBps??10000):n,10000):10000;
      const effects: import('../../domain/content').Effect[]=[{ type:'damage',amount:damage*(critical?IDLE_COMBAT_RULES.criticalMultiplier:1),school:'physical',threatMultiplierBps:Math.floor(event.threatMultiplierBps*imbueThreat/10000) }];
      const bleed=talentValue(actor,'critical-bleed',catalog);
      if(critical && bleed){const rules=catalog.classes!.rules,ticks=rules.deepWoundsTicks,intervalMs=rules.deepWoundsIntervalMs,total=Math.floor((stats.minDamage+stats.maxDamage)*bleed/20000),amount=Math.floor(total/ticks);effects.push({type:'periodic',auraId:'warrior-deep-wounds',amount,finalAmount:total-amount*(ticks-1),school:'physical',durationMs:intervalMs*ticks+1,intervalMs});}
      accept(context,applyEffects(checkpoint,effects,{actorId:actor.id,targetId:target.id,establishedMeleeImpact:true},catalog));
      const nextAt = Math.max(checkpoint.simMs + 1, actor.nextAttackMs);
      scheduleDecision(context,actor,nextAt);
      return;
    }
    case 'cast-complete': {
      const actor = actorById(checkpoint.state, event.actorId), cast = actor.casting;
      if (!cast || cast.actionId !== event.actionId) return;
      delete actor.casting;
      const character=actor.kind==='character'?checkpoint.state.profile.characters.find(c=>c.id===actor.characterId):undefined;
      const baseSpell=catalog.combat?.spells.find(s=>s.key===cast.spellKey);
      if(baseSpell && rogueWeaponProjectionReason(baseSpell,actor,catalog,character)) {resumeDecision(context,actor);return;}
      const spell=baseSpell?spellForActor(baseSpell,actor,catalog,checkpoint.simMs,character):undefined;
      if (!spell) throw new Error('Casting spell is absent from bound catalog');
      const target = actorById(checkpoint.state, cast.targetId);
      if (targetReason(actor, target, checkpoint.state, spell.target, spell.meleeRange, spell.sector, spell.rangedRange)) { resumeDecision(context, actor); return; }
      if(spell.combo && (!character?.knownSpells.includes(spell.key) || (spell.combo==='spender' && actor.combo?.targetId!==target.id) || (spell.requiredWeapon && character.equipment.mainHand!==undefined))) {resumeDecision(context,actor);return;}
      if(['forever:spell:8017','forever:spell:8018'].includes(spell.key) && shamanWeaponReason(actor,checkpoint.state,catalog)){resumeDecision(context,actor);return;}
      if(['forever:class:5','forever:class:7'].includes(actor.classState?.classKey??'')) {
        if(!character?.knownSpells.includes(spell.key) || !catalog.classes?.training.some(t=>t.classKey===character.classKey && t.spellKey===spell.key)) {resumeDecision(context,actor);return;}
      }
      if(spell.blockedByTargetAura && activeAuras(target,checkpoint.simMs).some(a=>a.id===spell.blockedByTargetAura)) {resumeDecision(context,actor);return;}
      if(actor.classState?.classKey==='forever:class:5' && spell.effects.some(e=>(e.type==='damage'||e.type==='periodic') && e.school==='shadow')) {
        const chance=Math.min(10000,catalog.classes!.priest.shadowHitChanceBps+talentValue(actor,'shadow-focus',catalog));
        const hit=context.random(1,10000)<=chance;
        actor.lastShadowApplicationResult={spellKey:spell.key,targetId:target.id,atMs:checkpoint.simMs,outcome:hit?'hit':'miss'};
        if(!hit) {scheduleDecision(context,actor,checkpoint.simMs);return;}
      }
      const effects=structuredClone(spell.effects);
      if(spell.canCrit && context.random(1,10000)<=statsFor(actor,checkpoint,catalog).critChanceBps) for(const effect of effects) if(effect.type==='damage'||effect.type==='heal')effect.amount*=IDLE_COMBAT_RULES.criticalMultiplier;
      accept(context, applyEffects(checkpoint, effects, { actorId: actor.id, targetId: target.id, actionId: cast.actionId, sourceKey: spell.key },catalog));
      if(spell.combo) {
        const owner=actorById(checkpoint.state,actor.id),victim=actorById(checkpoint.state,target.id);
        if(spell.combo==='spender' || victim.health===0)delete owner.combo;
        else owner.combo={targetId:victim.id,points:Math.min(5,(owner.combo?.targetId===victim.id?owner.combo.points:0)+1)};
      }
      scheduleDecision(context,actor,checkpoint.simMs);
      return;
    }
    case 'damage': case 'heal':
      accept(context, applyEffects(checkpoint, [event.type === 'damage' ? { type: 'damage', amount: event.amount, school: 'physical' } : { type: 'heal', amount: event.amount }], { actorId: event.actorId, targetId: event.targetId },catalog)); return;
    case 'aura-expire': {
      const target = actorById(checkpoint.state, event.targetId),expired=target.auras?.find(a=>a.token===event.token);
      target.auras = (target.auras ?? []).filter(a => a.token !== event.token);
      if(expired?.id==='idle-rogue-energy' && expired.sourceId===target.id && !targetReason(target,target,checkpoint.state,'self')) {
        accept(context,applyEffects(checkpoint,[rogueEnergyEffect(target,catalog)!],{actorId:target.id,targetId:target.id},catalog));
      }
      return;
    }
    case 'aura-tick': {
      const target = actorById(checkpoint.state, event.targetId), aura = activeAuras(target, checkpoint.simMs).find(a => a.token === event.token);
      if(petOwnerReason(target,checkpoint.state) || (aura && petOwnerReason(actorById(checkpoint.state,aura.sourceId),checkpoint.state)))return;
      if (!aura || (aura.effect.type !== 'periodic' && aura.effect.type !== 'periodic-resource' && aura.effect.type !== 'periodic-heal') || target.health === 0) return;
      if((aura.effect.type==='periodic-heal' || aura.id==='priest-pain') && targetReason(actorById(checkpoint.state,aura.sourceId),target,checkpoint.state,aura.effect.type==='periodic-heal'?'ally':'enemy'))return;
      if(aura.id==='rogue-rupture' && targetReason(actorById(checkpoint.state,aura.sourceId),target,checkpoint.state,'enemy'))return;
      if(aura.id==='idle-rogue-energy' && targetReason(target,target,checkpoint.state,'self'))return;
      const next=checkpoint.simMs+aura.effect.intervalMs;
      const amount=next>=aura.expiresAtMs?(aura.effect.finalAmount??aura.effect.amount):aura.effect.amount;
      accept(context, applyEffects(checkpoint, [aura.effect.type==='periodic'?{ type:'damage',amount,school:aura.effect.school }:aura.effect.type==='periodic-heal'?{type:'heal',amount}:{type:'resource',amount}], {actorId:aura.sourceId,targetId:target.id},catalog));
      if (next < aura.expiresAtMs) context.schedule(next, event);
      if(aura.id==='idle-rogue-energy') resumeDecision(context,actorById(checkpoint.state,target.id));
      return;
    }
    case 'death': {
      const actor = actorById(checkpoint.state, event.actorId); if (actor.health > 0 || actor.defeatedAtMs !== undefined) return;
      for(const unit of checkpoint.state.encounter?.actors??[])if(unit.id===event.actorId || unit.combo?.targetId===event.actorId)delete unit.combo;
      actor.defeatedAtMs = checkpoint.simMs;
      if(actor.kind==='totem')retireTotem(checkpoint,actor);
      retireUnavailableTotems(checkpoint);
      if (actor.casting) context.cancel(actor.casting.actionId); if (actor.pendingMelee) context.cancel(actor.pendingMelee.actionId);
      delete actor.casting; delete actor.pendingMelee;
      const encounter = checkpoint.state.encounter!;
      encounter.status = encounter.actors.some(a => a.kind === 'character' && a.health === 0) ? 'lost' : encounter.actors.filter(a => side(a)==='enemy').every(a => a.health === 0) ? 'won' : encounter.status;
      synchronizeActor(checkpoint, actor);
      if (actor.kind === 'character') {
        const character = checkpoint.state.profile.characters.find(c => c.id === actor.characterId)!;
        if (character.activity) { character.activity.consecutiveDefeats = Math.min(2, character.activity.consecutiveDefeats + 1); character.activity.pause = character.activity.consecutiveDefeats >= 2 ? 'consecutive-defeats' : 'death'; }
      }
      return;
    }
    case 'arrival': {
      const character = checkpoint.state.profile.characters.find(c => c.id === event.characterId); if (!character) throw new Error('Unknown arriving character');
      character.locationKey = event.locationKey; retireUnavailableTotems(checkpoint); return;
    }
    default: throw new SimulationFault('unhandled-event', `No simulation handler installed for ${event.type}`);
  }
}
