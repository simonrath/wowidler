import type { Catalog } from '../../domain/content';
import type { ActorState, GameState } from '../../domain/state';
import { actionReason, type CombatAction } from './attack';
import { highestThreatTarget } from './threat';
import { targetReason, isRangedAttack, canApproachHunter } from './positions';
export interface ActionChoice { action?: CombatAction; rejected: { ruleId: string; reason: string }[] }
export function chooseAction(actor: ActorState, state: GameState, catalog: Catalog): ActionChoice {
  const result: ActionChoice = { rejected: [] };
  if(actor.kind==='totem')return result;
  const character = actor.kind === 'character' ? state.profile.characters.find(c => c.id === actor.characterId) : undefined;
  const rules = actor.kind==='pet'?actor.rules:character?.rules ?? [];
  if (rules.length > 12) throw new Error('At most 12 tactic rules are allowed');
  const fallbackTarget = highestThreatTarget(actor, state);
  const now = state.combatTimeMs ?? 0;
  const check = (action: CombatAction) => actionReason({ state, simMs: now }, action, catalog);
  const priorities = rules.length ? rules : [{ id: 'basic-attack', enabled: true, conditions: [], action: { type: 'attack' as const } }];
  for (const rule of priorities) {
    if (!rule.enabled) { result.rejected.push({ ruleId: rule.id, reason: 'disabled' }); continue; }
    const ruleAction = rule.action;
    const spell = ruleAction.type === 'cast' ? catalog.combat?.spells.find(s => s.key === ruleAction.spellKey) : undefined;
    const summon=spell?.effects.find(e=>e.type==='summon-totem');
    if(summon?.type==='summon-totem' && state.encounter?.actors.some(a=>a.kind==='totem'&&a.ownerActorId===actor.id&&a.templateId===summon.templateId&&a.health>0&&a.expiresAtMs>now)){result.rejected.push({ruleId:rule.id,reason:'totem-already-active'});continue;}
    const selectsAlly = spell?.target==='ally' && spell.effects.some(e=>e.type==='heal'||e.type==='periodic-heal'||e.type==='absorb');
    const avoidsAura = (candidate: ActorState) => 'avoidActiveAura' in rule && !!rule.avoidActiveAura && candidate.auras?.some(a=>a.id===rule.avoidActiveAura && a.sourceId===actor.id && a.expiresAtMs>now);
    const melee = (ruleAction.type === 'attack' && !isRangedAttack(actor)) || !!spell?.meleeRange || !!spell?.effects.some(effect => effect.type === 'next-melee');
    const target = highestThreatTarget(actor, state, candidate => !targetReason(actor, candidate, state, 'enemy', melee, spell?.sector, spell?.rangedRange) || (ruleAction.type==='attack' && canApproachHunter(actor,candidate,state))) ?? fallbackTarget;
    const ally = state.encounter?.actors.filter(candidate=>!targetReason(actor,candidate,state,'ally',!!spell?.meleeRange,spell?.sector) && !(spell?.blockedByTargetAura && candidate.auras?.some(a=>a.id===spell.blockedByTargetAura && a.expiresAtMs>now)) && !(selectsAlly && avoidsAura(candidate))).sort((a,b)=>a.health*b.maxHealth-b.health*a.maxHealth || (a.id<b.id?-1:a.id>b.id?1:0))[0];
    if (rule.conditions.some(condition => {
      const unit = condition.subject === 'targetHealth' ? target : condition.subject==='allyHealth' ? ally : actor;
      if (!unit) return true;
      const current = condition.subject === 'comboPoints' ? (actor.combo?.targetId===target?.id?actor.combo?.points??0:0) : condition.subject === 'selfResource' ? unit.resource : unit.health, max = condition.subject === 'comboPoints' ? 5 : condition.subject === 'selfResource' ? unit.maxResource : unit.maxHealth;
      return max === 0 || !(condition.operator === 'below' ? current * 10000 < max * condition.thresholdBps : current * 10000 > max * condition.thresholdBps);
    })) { result.rejected.push({ ruleId: rule.id, reason: 'condition-not-met' }); continue; }
    if (rule.action.type === 'useItem') { result.rejected.push({ ruleId: rule.id, reason: 'unsupported-item' }); continue; }
    const recipient = selectsAlly ? ally : spell && spell.target !== 'enemy' || rule.action.type === 'flee' ? actor : target;
    if (recipient && avoidsAura(recipient)) { result.rejected.push({ruleId:rule.id,reason:'aura-already-active'});continue; }
    if (!recipient) { result.rejected.push({ ruleId: rule.id, reason: 'no-target' }); continue; }
    const action = { ...rule.action, actorId: actor.id, targetId: recipient.id } as CombatAction;
    const reason = check(action);
    if (reason) result.rejected.push({ ruleId: rule.id, reason });
    else { result.action = action; break; }
  }
  return result;
}
