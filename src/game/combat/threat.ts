import type { ActorState, GameState } from '../../domain/state';
import { side } from './positions';
/** Owned Idle rule: floor(actual damage * basis-point multiplier / 10000). */
export function addThreat(enemy: ActorState, sourceId: string, amount: number, multiplierBps = 10000): void {
  if (enemy.kind === 'character' || amount === 0) return;
  enemy.threat ??= {}; enemy.threat[sourceId] = (enemy.threat[sourceId] ?? 0) + Math.floor(amount * multiplierBps / 10000);
}
export function highestThreatTarget(enemy: ActorState, state: GameState, eligible: (actor: ActorState) => boolean = () => true): ActorState | undefined {
  return state.encounter?.actors.filter(a => side(a) !== side(enemy) && a.health > 0 && eligible(a)).sort((a, b) => (enemy.threat?.[b.id] ?? 0) - (enemy.threat?.[a.id] ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
}
