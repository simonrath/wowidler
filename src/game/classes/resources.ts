import { totemStateReason } from './totems';
import { hunterPetStats } from './pets';
import type { Catalog, CombatSpell } from '../../domain/content';
import { activeAuras } from '../combat/auras';
import type { ActorState, CharacterState, GameState } from '../../domain/state';
function supportsClass(classKey: string, catalog?: Catalog): boolean {
  return catalog?.classes?.definitions.some(d=>d.key===classKey && d.mechanics==='playable') ?? false;
}
/** Persistent class ownership requires its execution package, including for incoming effects. */
export function classExecutionReason(actor: ActorState, state: GameState, catalog?: Catalog): string | undefined {
  if(actor.kind==='totem')return totemStateReason(actor,state,catalog);
  const owner=actor.kind==='pet'?state.encounter?.actors.find(a=>a.id===actor.ownerActorId):actor;
  const character=owner?.kind==='character'?state.profile.characters.find(c=>c.id===owner.characterId):undefined;
  if(actor.kind==='pet' && (!character?.classProgress || !catalog?.classes?.hunterPet || catalog.classes.hunterPet.id!==actor.templateId)) return 'missing-class-package';
  if(character?.classProgress && character.classKey==='forever:class:7' && !catalog?.classes?.shaman)return 'missing-class-package';
  if(character?.classProgress && character.classKey==='forever:class:5' && !catalog?.classes?.priest)return 'missing-class-package';
  if(character?.classProgress && character.classKey==='forever:class:4' && !catalog?.classes?.rogue)return 'missing-class-package';
  if(character?.classProgress && !supportsClass(character.classKey,catalog)) return 'missing-class-package';
  if(actor.kind==='pet' && character && catalog?.classes) {
    const expected=hunterPetStats(character,catalog),definition=catalog.classes.hunterPet;
    if(actor.sourceSpellKey!==definition.sourceSpellKey || actor.knownSpells.length!==definition.knownSpells.length || new Set(actor.knownSpells).size!==actor.knownSpells.length || definition.knownSpells.some(key=>!actor.knownSpells.includes(key)) || actor.maxHealth!==expected.maxHealth || actor.maxResource!==expected.maxResource || (Object.keys(expected) as (keyof typeof expected)[]).some(key=>actor.stats[key]!==expected[key])) return 'invalid-pet-state';
  }
}
function requireActorClassCatalog(actor: ActorState, catalog?: Catalog) {
  if(!actor.classState || (actor.classState.classKey==='forever:class:7' && !catalog?.classes?.shaman) || !supportsClass(actor.classState.classKey,catalog) || (actor.classState.classKey==='forever:class:4' && !catalog?.classes?.rogue) || (actor.classState.classKey==='forever:class:5' && !catalog?.classes?.priest)) throw Error('Missing supported class execution package');
  return catalog!.classes!;
}
export interface DerivedActor { stats: import('../../domain/state').CharacterState['stats']; damageBps: number; takenBps: number; threatBps: number; reachedMilestones: Record<string,number[]> }
export function talentValue(actor: ActorState, handler: string, catalog: Catalog): number {
  if (!actor.classState) return 0;
  const classes=requireActorClassCatalog(actor,catalog);
  const talent = classes.talents.find(t=>t.classKey===actor.classState!.classKey && t.handler===handler);
  const rank = talent ? actor.classState.talents[talent.key] ?? 0 : 0;
  return rank && talent ? talent.values[rank-1] : 0;
}
export function deriveActor(actor: ActorState, catalog: Catalog): DerivedActor {
  if(actor.kind==='totem' && (!supportsClass('forever:class:7',catalog)||!catalog.classes?.shaman?.totems.some(t=>t.id===actor.templateId)))throw Error('Missing supported totem execution package');
  if(actor.kind==='pet' && (!supportsClass('forever:class:3',catalog)||catalog.classes?.hunterPet.id!==actor.templateId))throw Error('Missing supported pet execution package');
  if (actor.kind!=='character') return {stats:{...actor.stats},damageBps:10000,takenBps:10000,threatBps:10000,reachedMilestones:{}};
  const c=requireActorClassCatalog(actor,catalog),s=actor.classState!;
  const totals: Record<string,number> = {};
  for(const t of c.talents) totals[t.treeId]=(totals[t.treeId]??0)+(s.talents[t.key]??0);
  const reachedMilestones=Object.fromEntries(Object.entries(totals).map(([id,total])=>[id,c.rules.milestones.filter(p=>total>=p)]));
  if(s.classKey==='forever:class:7') return {stats:{...s.stats,critChanceBps:Math.min(10000,s.stats.critChanceBps+talentValue(actor,'thundering-strikes',catalog))},damageBps:10000,takenBps:10000,threatBps:10000,reachedMilestones};
  if(s.classKey==='forever:class:5') return {stats:{...s.stats},damageBps:10000,takenBps:10000,threatBps:10000,reachedMilestones};
  if(s.classKey==='forever:class:4') return {stats:{...s.stats,critChanceBps:Math.min(10000,s.stats.critChanceBps+talentValue(actor,'rogue-crit',catalog))},damageBps:10000,takenBps:10000,threatBps:10000,reachedMilestones};
  if(s.classKey==='forever:class:3') return {stats:{...s.stats,critChanceBps:Math.min(10000,s.stats.critChanceBps+talentValue(actor,'hunter-crit',catalog))},damageBps:10000,takenBps:10000,threatBps:10000,reachedMilestones};
  if(s.classKey==='forever:class:2') return {stats:{...s.stats,attackPower:Math.floor(s.stats.attackPower*(10000+talentValue(actor,'divine-strength',catalog))/10000),armor:Math.floor(s.stats.armor*(10000+talentValue(actor,'toughness',catalog))/10000)},damageBps:10000,takenBps:10000,threatBps:10000,reachedMilestones};
  return {stats:{...s.stats,critChanceBps:Math.min(10000,s.stats.critChanceBps+c.rules.critBps[s.stance]+talentValue(actor,'melee-crit',catalog))},damageBps:c.rules.damageBps[s.stance],takenBps:c.rules.takenBps[s.stance],threatBps:c.rules.threatBps[s.stance],reachedMilestones};
}
/** Current mainhand authority is persistent character equipment, never the actor snapshot. */
export function rogueWeaponProjectionReason(spell: CombatSpell, actor: ActorState, catalog: Catalog, character?: CharacterState): string | undefined {
  if(!['forever:spell:1752','forever:spell:53'].includes(spell.key))return;
  if(actor.kind!=='character' || actor.classState?.classKey!=='forever:class:4' || character?.id!==actor.characterId || character.classKey!=='forever:class:4' || !character.classProgress || character.equipment.mainHand!==undefined || catalog.classes?.rogue?.starterMainHand!=='owned-idle-dagger')return 'unsupported-weapon';
}
export function spellForActor(spell: CombatSpell, actor: ActorState, catalog: Catalog, now=0, character?: CharacterState): CombatSpell {
  const weaponReason=rogueWeaponProjectionReason(spell,actor,catalog,character);if(weaponReason)throw Error(weaponReason);
  if(!actor.classState) return spell;
  requireActorClassCatalog(actor,catalog);
  const next=structuredClone(spell);
  if(actor.classState.classKey==='forever:class:7') {
    if(['forever:spell:403','forever:spell:529','forever:spell:548','forever:spell:915'].includes(next.key))next.resourceCost=Math.floor(next.resourceCost*(10000-talentValue(actor,'convection',catalog))/10000);
    if(['forever:spell:331','forever:spell:332'].includes(next.key))next.castMs=Math.max(0,next.castMs-talentValue(actor,'improved-healing-wave',catalog));
  }
  if(actor.classState.classKey==='forever:class:5') {
    const twin=next.castMs===0?talentValue(actor,'twin-disciplines',catalog):0;
    for(const effect of next.effects) {
      if(effect.type==='damage' || effect.type==='heal')effect.amount=Math.floor(effect.amount*(10000+twin)/10000);
      if(effect.type==='periodic' || effect.type==='periodic-heal') {
        const ticks=Math.floor((effect.durationMs-1)/effect.intervalMs);
        const base=effect.amount*(ticks-1)+(effect.finalAmount??effect.amount);
        const renew=effect.type==='periodic-heal' && effect.auraId==='priest-renew'?talentValue(actor,'improved-renew',catalog):0;
        const total=Math.floor(base*(10000+twin)*(10000+renew)/100000000);
        effect.amount=Math.floor(total/ticks);effect.finalAmount=total-effect.amount*(ticks-1);
      }
    }
  }
  if(actor.classState.classKey==='forever:class:4') {
    const rules=catalog.classes!.rogue,stats=deriveActor(actor,catalog).stats,points=actor.combo?.points??1;
    const power=stats.attackPower+activeAuras(actor,now).reduce((n,a)=>n+(a.effect.type==='buff'?(a.effect.attackPower??0)*a.stacks:0),0);
    const weapon=Math.floor((stats.minDamage+stats.maxDamage)/2)+Math.floor(power*stats.attackIntervalMs/rules.weaponPowerDivisor);
    if(next.key==='forever:spell:1752') next.resourceCost-=talentValue(actor,'sinister-cost',catalog);
    for(const effect of next.effects) {
      if(effect.type==='damage') {
        if(next.key==='forever:spell:1752') effect.amount+=weapon;
        if(next.key==='forever:spell:53') effect.amount=Math.floor((effect.amount+Math.floor(weapon*15000/10000))*(10000+talentValue(actor,'opportunity',catalog))/10000);
        if(next.key==='forever:spell:2098') effect.amount=Math.floor((rules.eviscerateBaseDamage[points-1]+Math.floor(power*points*rules.eviscerateAttackPowerBpsPerPoint/10000))*(10000+talentValue(actor,'eviscerate-damage',catalog))/10000);
      }
      if(effect.type==='periodic' && next.key==='forever:spell:1943') {
        const total=rules.ruptureBaseDamage[points-1]+Math.floor(power*points*rules.ruptureAttackPowerBpsPerPoint/10000);
        const duration=rules.ruptureDurationsMs[points-1],ticks=duration/rules.ruptureIntervalMs;
        effect.intervalMs=rules.ruptureIntervalMs;effect.durationMs=duration+1;effect.amount=Math.floor(total/ticks);effect.finalAmount=total-effect.amount*(ticks-1);
      }
    }
  }
  if(actor.classState.classKey==='forever:class:2') {
    if(next.resourceCostBps!==undefined) next.resourceCost=Math.floor(actor.classState.stats.maxResource*next.resourceCostBps/10000);
    if(next.castMs===0) next.resourceCost=Math.floor(next.resourceCost*(10000-talentValue(actor,'benediction',catalog))/10000);
    for(const effect of next.effects) {
      if(effect.type==='heal' && ['forever:spell:635','forever:spell:639'].includes(next.key)) effect.amount=Math.floor(effect.amount*(10000+talentValue(actor,'healing-light',catalog))/10000);
      if(effect.type==='damage' && next.key==='forever:spell:679') {
        const stats=deriveActor(actor,catalog).stats;
        const power=stats.attackPower+activeAuras(actor,now).reduce((n,a)=>n+(a.effect.type==='buff'?(a.effect.attackPower??0)*a.stacks:0),0);
        // Owned deterministic weapon projection; current 70425 Holy Strike specifies 25% weapon damage plus 2..4.
        const weapon=Math.floor((stats.minDamage+stats.maxDamage)/2)+Math.floor(power*stats.attackIntervalMs/14000);
        effect.amount+=Math.floor(weapon*2500/10000);
      }
    }
  }
  if (['forever:spell:78','forever:spell:284'].includes(spell.key)) next.resourceCost=Math.max(0,next.resourceCost-talentValue(actor,'heroic-cost',catalog));
  for(const effect of next.effects) {
    if(spell.key==='forever:spell:772' && effect.type==='periodic') scalePeriodic(effect,talentValue(actor,'rend-damage',catalog));
    if(spell.key==='forever:spell:2687' && effect.type==='resource') effect.amount=Math.floor(effect.amount*(10000+talentValue(actor,'bloodrage-resource',catalog))/10000);
    if(spell.key==='forever:spell:2687' && effect.type==='periodic-resource') scalePeriodic(effect,talentValue(actor,'bloodrage-resource',catalog));
  }
  return next;
}
export function gainDamageRage(actor: ActorState, amount: number, received: boolean, catalog?: Catalog): void {
  if(!actor.classState) return;
  const classes=requireActorClassCatalog(actor,catalog);
  if(actor.classState.classKey!=='forever:class:1' || actor.health===0) return;
  const divisor=received?classes.rules.rageDamageTakenDivisor:classes.rules.rageDamageDealtDivisor;
  actor.resource=Math.min(actor.maxResource,actor.resource+Math.floor(amount/divisor));
}

function scalePeriodic(effect: {amount:number;finalAmount?:number;durationMs:number;intervalMs:number},bonusBps:number):void {
  const ticks=Math.floor((effect.durationMs-1)/effect.intervalMs);
  const total=Math.floor(effect.amount*ticks*(10000+bonusBps)/10000);
  effect.amount=Math.floor(total/ticks);effect.finalAmount=total-effect.amount*(ticks-1);
}

/** Renewable, encounter-owned energy clock; all numbers come from the locked adaptation. */
export function rogueEnergyEffect(actor: ActorState, catalog: Catalog): import('../../domain/content').Effect | undefined {
  if(actor.classState?.classKey!=='forever:class:4')return;
  const rules=requireActorClassCatalog(actor,catalog).rogue;
  return {type:'periodic-resource',auraId:'idle-rogue-energy',amount:rules.energyPerTick,intervalMs:rules.energyIntervalMs,durationMs:rules.energyCycleMs};
}
