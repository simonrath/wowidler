import { hunterPetStats } from './pets';
import defaults from '../../../content/authoring/class-defaults.json';
import { classCatalogSchema } from './contracts';
import { characterCreationSchema, type Catalog } from '../../domain/content';
import { characterStateSchema, type CharacterState, type ActorState, type GameState } from '../../domain/state';
import { idSchema, type EntityKey } from '../../domain/ids';
import type { Result } from '../../domain/result';
export interface CreateCharacterInput { id: string; name: string; combinationKey: EntityKey; raceKey: EntityKey; classKey: EntityKey; factionKey: EntityKey }
export function createClassCatalog(base: Catalog): Catalog & { classes: ReturnType<typeof classCatalogSchema.parse> } {
  const classes = classCatalogSchema.parse(defaults);
  // The explicitly authored class package supersedes starter execution for identical ranks.
  const keys = new Set(classes.spells.map(s=>s.key));
  return { ...base, classes, combat: { spells: [...(base.combat?.spells ?? []).filter(s=>!keys.has(s.key)), ...classes.spells] } };
}
export function createCharacter(input: CreateCharacterInput, catalog: Catalog): Result<CharacterState> {
  const classes = catalog.classes;
  if (!classes) return {ok:false,error:{code:'missing-content',message:'Klassenkatalog fehlt.'}};
  const parsed = characterCreationSchema.safeParse({name:input.name,combinationKey:input.combinationKey,raceKey:input.raceKey,classKey:input.classKey,factionKey:input.factionKey,allowedCombinations:classes.combinations});
  if (!parsed.success || !idSchema.safeParse(input.id).success) return {ok:false,error:{code:'invalid',message:'Ungültige Charakterkombination.'}};
  const combination = classes.combinations.find(c=>c.key===input.combinationKey)!;
  const definition = classes.definitions.find(c=>c.key===input.classKey);
  if (!definition) return {ok:false,error:{code:'missing-content',message:'Klassenwerte fehlen.'}};
  const playable = definition.mechanics==='playable';
  const profile = classes.profiles.find(p=>p.classKey===definition.key);
  if(playable && !profile) return {ok:false,error:{code:'missing-content',message:'Klassenprofil fehlt.'}};
  const initialSpells = classes.initialSpells.filter(key=>classes.training.some(t=>t.spellKey===key && t.classKey===definition.key));
  return {ok:true,value:characterStateSchema.parse({id:input.id,name:parsed.data.name,combinationKey:combination.key,raceKey:combination.raceKey,classKey:combination.classKey,factionKey:combination.factionKey,locationKey:combination.startLocationKey,level:1,experience:0,moneyCopper:0,stats:definition.stats,health:definition.stats.maxHealth,resource:definition.initialResource,dead:false,inventory:[],equipment:{},quests:[],pendingRewards:[],knownSpells:playable?initialSpells:[],cooldowns:{},talents:{},professions:[],reputation:{},rules:playable?profile!.rules:[],activityPlan:[],activity:null,...(playable?{classProgress:{stance:'battle',stanceReadyAtMs:0,activeSpec:0,specs:[{profileId:profile!.id,allocation:{}},null]}}:{})})};
}
export function snapshotCharacter(character: CharacterState) {
  if (!character.classProgress) throw Error('Class progress is required');
  return {classKey:character.classKey,level:character.level,stats:structuredClone(character.stats),talents:{...character.talents},knownSpells:[...character.knownSpells],stance:character.classProgress.stance};
}
export function materializeCharacterActor(character: CharacterState): ActorState {
  return {kind:'character',id:character.id,characterId:character.id,health:character.health,maxHealth:character.stats.maxHealth,resource:character.resource,maxResource:character.stats.maxResource,nextAttackMs:0,...(character.classKey==='forever:class:3'&&character.classProgress?{position:{range:character.classProgress.specs[character.classProgress.activeSpec]?.profileId==='hunter-survival'?'melee' as const:'ranged' as const,sector:'front' as const}}:{}),...(character.classKey==='forever:class:4'&&character.classProgress?{position:{range:'melee' as const,sector:character.classProgress.specs[character.classProgress.activeSpec]?.profileId==='rogue-subtlety'?'rear' as const:'front' as const}}:{}),...(character.classProgress?{classState:snapshotCharacter(character)}:{})};
}
export function refreshClassActors(state: GameState, character: CharacterState, catalog?: Catalog): void {
  for (const actor of state.encounter?.actors ?? []) {
    if(actor.kind==='character' && actor.characterId===character.id && character.classProgress) {
      actor.classState=snapshotCharacter(character);
      if(['forever:class:3','forever:class:4'].includes(character.classKey)) actor.position=materializeCharacterActor(character).position;
    }
    if(actor.kind==='pet' && catalog && state.encounter?.actors.some(a=>a.kind==='character'&&a.id===actor.ownerActorId&&a.characterId===character.id)) {
      const stats=hunterPetStats(character,catalog);
      actor.health=Math.floor(actor.health*stats.maxHealth/actor.maxHealth);actor.maxHealth=stats.maxHealth;actor.stats=stats;
      actor.maxResource=stats.maxResource;actor.resource=Math.min(actor.resource,actor.maxResource);
    }
  }
}
