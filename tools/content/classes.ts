/** Node-only compiler. Browser code imports the generated JSON, never this file. */
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { classCatalogSchema, type ClassCatalog } from '../../src/game/classes/contracts';
import { sourceLockSchema } from './schema';
import { verifyCaptured } from './client-tables';
import type { EntityKey } from '../../src/domain/ids';
const key = (kind: string, id: number) => `forever:${kind}:${id}` as EntityKey;
export function buildClassDefaults(): ClassCatalog {
  const lock = sourceLockSchema.parse(JSON.parse(readFileSync('content/sources/lock.json','utf8')));
  const used: typeof lock.files = [];
  const read = (localPath: string) => {
    const file = lock.files.find(f => f.localPath === localPath); if (!file) throw Error(`Unadmitted class source ${localPath}`);
    const bytes = readFileSync(localPath); verifyCaptured({ file, bytes }, lock); used.push(file);
    return JSON.parse(bytes.toString('utf8'));
  };
  const p = 'content/sources/vendor/grimoire/data/';
  const classes = z.array(z.object({ id: z.number().int().positive(), slug: z.string(), name: z.string(), resource: z.string(), races: z.array(z.string()), specs: z.array(z.object({id:z.number(),slug:z.string(),name:z.string(),role:z.string()})) })).parse(read(p+'classes.json'));
  const races = z.array(z.object({id:z.number().int().positive(),slug:z.string(),faction:z.enum(['alliance','horde']),start:z.string(),classes:z.array(z.string()),racials:z.array(z.object({id:z.number(),name:z.string(),desc:z.string(),passive:z.boolean()})),racialVariants:z.object({priest:z.array(z.object({id:z.number(),name:z.string(),desc:z.string(),passive:z.boolean()}))}).optional()})).parse(read(p+'races.json'));
  const zones = z.array(z.object({id:z.number(),n:z.string()})).parse(read(p+'zones.json'));
  const talentSource = z.record(z.object({ trees: z.array(z.object({id:z.number(),slug:z.string(),talents:z.array(z.object({id:z.number(),name:z.string(),row:z.number(),col:z.number(),status:z.enum(['new','changed','same']),max:z.number(),spells:z.array(z.number()),desc:z.array(z.string()),req:z.object({id:z.number(),qty:z.number()}).optional()}))})) })).parse(read(p+'talents.json'));
  const abilitySource = z.record(z.array(z.object({id:z.number(),level:z.number(),name:z.string(),desc:z.string()}))).parse(read(p+'abilities.json'));
  const supportedClasses=classes.filter(c=>['warrior','paladin','hunter','rogue','priest','shaman'].includes(c.slug));
  const abilities=supportedClasses.flatMap(c=>abilitySource[c.slug].map((a,i)=>({...a,classKey:key('class',c.id),selector:`/${c.slug}/${i}`})));
  const quests = z.array(z.object({i:z.number(),n:z.string()})).parse(read(p+'quests.json'));
  const rules = read('content/adaptations/classes-idle-v1.json');
  const primary = read('content/sources/evidence/class-rules.json');
  if (primary.captureKind !== 'paraphrased-fact-extract') throw Error('Expected transparent primary extract');
  const shamanPrimary=read('content/sources/evidence/shaman-rules.json');
  if(shamanPrimary.captureKind!=='paraphrased-fact-extract')throw Error('Expected transparent Shaman primary extract');
  for(const spell of rules.spells.filter((s:{effects:{type:string}[]})=>s.effects.some(e=>e.type==='summon-totem')))if(spell.gcdMs!==shamanPrimary.claims.totemGlobalCooldownMs)throw Error('Totem GCD differs from admitted primary');
  for(const template of rules.shaman.totems)if(template.pulse.type!=='damage' && template.durationMs!==shamanPrimary.claims.persistentBuffTotemDurationMs)throw Error('Persistent totem duration differs from primary');
  for(const spell of rules.spells)for(const effect of spell.effects)if(effect.auraId==='shaman-rockbiter' && effect.durationMs!==shamanPrimary.claims.weaponImbueDurationMs)throw Error('Imbue duration differs from primary');
  const combinations = races.flatMap(r => r.classes.map(slug => {
    const c = classes.find(c => c.slug===slug); if (!c?.races.includes(r.slug)) throw Error('Race/class matrix disagrees');
    const starts = zones.filter(z => z.n===r.start); if(starts.length!==1) throw Error('Unresolved start zone');
    return {key:key('raceClass',r.id*100+c.id),raceKey:key('race',r.id),classKey:key('class',c.id),factionKey:key('faction',r.faction==='alliance'?1:2),startLocationKey:key('location',starts[0].id),playable:true};
  }));
  for (const c of classes) for (const slug of c.races) if (!races.find(r=>r.slug===slug)?.classes.includes(c.slug)) throw Error('Reverse matrix disagrees');
  for (const offer of rules.training) {
    const ability = abilities.find(a=>key('spell',a.id)===offer.spellKey && a.classKey===offer.classKey);
    if (!ability || ability.level!==offer.level) throw Error('Unverified training rank/level');
    if (offer.questKey && !quests.some(q=>key('quest',q.i)===offer.questKey)) throw Error('Missing authored quest link identity');
  }
  const talents = supportedClasses.flatMap(c=>talentSource[c.slug].trees.flatMap((tree,ti)=>tree.talents.map((talent,i)=> {
    const supported = rules.supportedTalents[talent.id];
    if(talent.desc.length!==talent.max || talent.spells.length!==talent.max || (supported && supported.values.length!==talent.max)) throw Error('Incomplete talent ranks');
    return {key:key('talent',talent.id),classKey:key('class',c.id),treeId:tree.id,name:talent.name,row:talent.row,column:talent.col,status:talent.status,max:talent.max,spells:talent.spells,descriptions:talent.desc,prerequisite:talent.req?{key:key('talent',talent.req.id),rank:talent.req.qty}:null,handler:supported?.handler??null,values:supported?.values??[],gap:supported?[]:[`T23: implement and verify ${talent.name} semantics: ${talent.desc[talent.desc.length-1]}`, 'Required primitive: '+primitive(talent.name,c.slug)],sourceSelector:`/${c.slug}/trees/${ti}/talents/${i}`};
  })));
  return classCatalogSchema.parse({version:rules.version,authenticServerCombat:false,combinations,definitions:classes.map(c=>({key:key('class',c.id),slug:c.slug,name:c.name,resource:c.resource,specs:c.specs,mechanics:supportedClasses.includes(c)?'playable':'unsupported',...rules.classSeeds[c.slug]})),racials:races.flatMap(r=>[...r.racials.map(a=>({raceKey:key('race',r.id),classKey:null,originalId:a.id,name:a.name,description:a.desc,passive:a.passive,implementation:'unsupported'})),...(r.racialVariants?.priest??[]).map(a=>({raceKey:key('race',r.id),classKey:key('class',5),originalId:a.id,name:a.name,description:a.desc,passive:a.passive,implementation:'unsupported'}))]),abilityEvidence:abilities.flatMap(a=>(rules.training.some((t:{spellKey:string})=>t.spellKey===key('spell',a.id)) || rules.hunterPet.knownSpells.includes(key('spell',a.id)))?[{key:key('spell',a.id),name:a.name,description:a.desc,level:a.level,selector:a.selector}]:[]),talents,profiles:rules.profiles,shaman:rules.shaman,priest:rules.priest,rogue:rules.rogue,hunterPet:rules.hunterPet,spells:rules.spells,training:rules.training,trainers:rules.trainers,initialSpells:rules.initialSpells,rules:{...rules.rules,talentsUnlockLevel:primary.claims.talentsUnlockLevel,milestones:primary.claims.milestonePoints,dualLevel:primary.claims.dualSpecializationUnlockLevel},evidence:used.map(f=>({target:'class-package/'+f.localPath,policy:f.kind==='authored-file'?'owned-idle':f.localPath.endsWith('/quests.json')?'adopted-original112':'captured-forever',sources:[{sourceId:f.sourceId,path:f.path,sha256:f.sha256,selector:'/'}],reason:f.kind==='authored-file'?rules.policy:f.kind==='primary-extract'?'Paraphrased primary fact extract; hash is not original HTML.':'Captured identity/description, not server-executable effect proof.'})),gaps:['T23 Shaman47 unsupported talent primitives, air totems, full rank/trainer/class-quest/tool integration, elemental shields, shocks, chains, dispel/resurrection, mana regeneration, Call spells, projection and beta-bugged Recall remain required. All50 talents retained; three supported talents.','T23 Hunter full talent execution, persistent bonding/taming/revival, ammunition and equipment, remaining ranks and class quests remain required. Inspect each retained talent gap; three talents executable.', 'T23 Rogue remaining 49 talent effects, poison/stealth/CC lifecycle, full ranks, class quests and racial effects remain required; all 53 current talents retained. T09 real inventory weapon integration must replace the explicit owned starter dagger projection.', 'T08 later three class packages remain required and unsupported.','T23 Priest remaining talents, all twelve racial variants, full ranks/class quests, mana regeneration, damage cast pushback, dispel, resurrection, Holy/Shadow form and proc interactions remain required. Every current talent retains its own primitive backlog; three talents executable.','T23 full Paladin tree execution: inspect per-talent gap list; 50 imported, 4 executable. Remaining 46 talents remain in product scope.', 'T23 Paladin Devotion Aura party propagation, seals/judgements, full ranks and class quests remain required. Current Devotion execution is self-only.', 'T23 full Warrior tree execution: inspect per-talent gap list; 52 imported, 6 executable.','Current racial identities/descriptions captured; racial execution remains required by T23.','Full trainer, quest, reagent and rank catalog remains required by T23; selected curriculum is owned Idle.','Milestone point thresholds retained; full milestone ability unlock semantics remain required by T23.',...rules.interpretations]});
}
function primitive(name: string, slug: string): string {
  if(slug==='shaman') {
    if(/Totem|Call/.test(name))return 'full four-element group/loadout controls, area/party rules, totem-specific modifiers and source-backed pulse/proc interactions';
    if(/Shield|Reincarnation|Ghost|Warding|Resolve/.test(name))return 'typed elemental shield charges, incoming/critical triggers, resurrection, movement/control and school-specific mitigation';
    if(/Weapon|Dual|Flurry|Storm|Farseer|Maelstrom/.test(name))return 'real mainhand/offhand metadata, weapon procs, extra attacks, stacking instant-cast charges and haste';
    if(/Focus|Knowledge|Mindfulness|Reverberation|Guidance/.test(name))return 'full named spell/rank cost/cooldown consumers, typed attributes, mana-regeneration suppression and hit mechanics';
    if(/Heal|Tidal|Purification|Riptide|Swiftness/.test(name))return 'full healing ranks, area/chained target selection, critical healing procs, pushback and consumable instant-cast permissions';
    return 'source-described Shaman spell/critical/proc/target modifier and full named ability/rank consumer';
  }
  if(slug==='priest') {
    if(/Shield|Warding|Hope|Aegis/.test(name)) return 'named shield rank modifiers, critical-heal shield generation/caps and Weakened Soul interactions';
    if(/Spirit|Mental|Meditation|Tap|Litany|Inspiration/.test(name)) return 'typed primary attributes, casting-aware mana regeneration, death/kill or distinct-heal triggers and party propagation';
    if(/Focus|Resolve|Martyrdom|Blackout|Scream|Silence/.test(name)) return 'cast pushback, school hit/critical checks, typed control immunity/durations and conditional procs';
    if(/Penance|Nova|Binding|Mending|Infusion/.test(name)) return 'talent-learned channels, area/dual/self-plus-ally targets, jumping charges and temporary spell multipliers';
    if(/Flay|Weaving|Contagion|Embrace|form/.test(name)) return 'channel ticks, stacking caster-owned damage procs, party leech, spreading afflictions or mutually restricted form actions';
    if(/Wand/.test(name)) return 'equipped wand category, ranged wand attacks and damage modifiers';
    if(/Fire|Fury|Healing|Reach|Agility|Burn|Blast|Pain|Darkness|Demise|Light|Precision/.test(name)) return 'full named ability/rank cast/cost/range/duration modifiers, charges, conditional damage/critical procs and school multipliers';
    return 'source-described Priest trigger, attribute or named spell modifier and complete executable consumer';
  }
  if(slug==='rogue') {
    if(/Poison|Vile|Master Poisoner|Venom|Envenom/.test(name)) return 'typed applied poisons, charges, proc/critical damage and poison-specific modifiers';
    if(/Camouflage|Deception|Ambush|Initiative|Cutthroat|Senses|Distract/.test(name)) return 'stealth/detection, movement, opener requirements and temporary triggered permissions';
    if(/Gouge|Sap|Blind|Tricks|Deeds|Elusiveness|Nerves|Sprint|Kick/.test(name)) return 'typed breakable crowd control, facing, stealth requirements and named duration/cost/cooldown modifiers';
    if(/Premeditation|Relentless|Ruthlessness|Seal Fate|Setup|Remorseless/.test(name)) return 'kill/dodge/critical/finisher triggers, conditional extra combo points and expiring proc charges';
    if(/Blade|Weapon|Dual Wield|Precision|Hack|Reflexes|Deflection/.test(name)) return 'typed weapons/offhand/hit/dodge/parry and attack-triggered extra strikes';
    if(/Rush|Preparation|Ghostly|Hemorrhage|Thousand/.test(name)) return 'talent-learned actions, cooldown reset, temporary regeneration/dodge and caster-owned bleed interactions';
    if(/Lethality|Murder|Vigor|Aggression|Sliced|Slice|Expose|Quietus/.test(name)) return 'named ability/target predicates, critical multipliers, maximum energy, attack haste or armor debuffs';
    return 'source-described Rogue modifier and full named ability/proc consumer';
  }
  if(slug==='hunter') {
    if(/Tracking/.test(name)) return 'creature types, tracking selection and conditional damage';
    if(/Aspect|Pathfinding/.test(name)) return 'exclusive aspects, movement/haste/dodge procs and shared pet bonuses';
    if(/Revive|Mend/.test(name)) return 'persistent pet death/revival, channeled healing and periodic cleanse';
    if(/Focused Fire|Lone Wolf|Unleashed|Ferocity|Frenzy|Wrath|Intimidation|Spirit Bond|Discipline|Swiftness|Hawk/.test(name)) return 'owner/pet active-state predicates, named cooldowns, proc/haste/CC lifecycle, periodic regeneration or hawk actor groups';
    if(/Concussive|Scatter|Wing Clip|Entrapment|Deterrence|Counterattack/.test(name)) return 'typed movement/control immunity and parry-triggered actions with source prerequisites';
    if(/Trap|Survival Tactics|Resourcefulness/.test(name)) return 'placed area traps, activation/hit table, duration and casting-mana rules';
    if(/Careful Aim|Lightning|Survivalist$/.test(name)) return 'typed primary attributes/maximum health and atomic derived vital refresh';
    if(/Mortal|Savage|Predator/.test(name)) return 'ability-category critical modifiers and offhand weapon resolution';
    if(/Sting|Efficiency|Arcane Shot|Barrage|Weapon Specialization/.test(name)) return 'full named ability/rank/cost/duration/cooldown and weapon-category consumers';
    if(/Rapid|Expose|Lacerating/.test(name)) return 'kill/critical/mark procs, conditional mana regeneration and bleed triggers';
    if(/Trueshot/.test(name)) return 'party ranged AP aura propagation and party membership';
    if(/Sniper|Strider/.test(name)) return 'talent-learned attacks, finite ranged charges and movement buffs';
    if(/Surefooted/.test(name)) return 'hit resolution and movement-impairing duration reduction';
    return 'source-described Hunter ability/target/owner modifier and its executable combat consumer';
  }
  if(slug==='paladin') {
  if (/Intellect|Stamina|Sacred Duty/.test(name)) return 'typed primary attributes, derived maximum vitals, ability cooldown modifiers and atomic vital refresh';
  if (/Guardian/.test(name)) return 'named Blessing cooldown/duration modifiers and typed Forbearance/movement immunity';
  if (/Illumination|Infusion|Favor|Holy Power/.test(name)) return 'healing/spell critical rolls, triggered cast modifiers and mana refunds';
  if (/Seal|Judgement|Twist|Arbiter/.test(name)) return 'exclusive seal lifecycle, melee-triggered Holy effects, judgement effects and per-target refresh';
  if (/Focus|Faith|Voice|Repentance/.test(name)) return 'typed crowd control, cast pushback, duration and immunity';
  if (/Reverence/.test(name)) return 'base mana regeneration and casting suppression';
  if (/Purifying|Conduit/.test(name)) return 'cleanse/dispel, named spell cost and cooldown consumers';
  if (/Holy Shock|Vigil|Consecrated/.test(name)) return 'dual enemy/ally spell payloads, area membership and party healing';
  if (/Deflection|Anticipation|Precision/.test(name)) return 'typed parry/defense/hit resolution';
  if (/Vengeance|Vindication|Eye for an Eye|Reckoning/.test(name)) return 'critical/block triggered stacking proc, retaliation and extra attacks';
  if (/Pursuit/.test(name)) return 'travel/mounted movement speed and non-stacking modifiers';
  if (/Champion/.test(name)) return 'Intellect-derived spell power and coefficient consumers';
  if (/Instrument|Iron Creed/.test(name)) return 'named spell casting, aura-conditional threat and mitigation procs';
  if (/Redoubt/.test(name)) return 'shield equipment, probabilistic block buffs, duration and consumed block charges';
  }
  if (/Shield|Block/.test(name)) return 'shield equipment, block resolution and block-triggered resource/procs';
  if (/Weapon|Precision/.test(name)) return 'weapon categories, off-hand hit table and weapon-specific procs';
  if (/Shout|Voice/.test(name)) return 'shout area targeting and duration/cost modifiers';
  if (/Hamstring|Iron Will|Concussion|Disarm/.test(name)) return 'typed crowd control, immunity, duration and resistance';
  if (/Rage|Wrath|Enrage|Flurry|Blood Craze/.test(name)) return 'conditional resource/critical-triggered proc lifecycle';
  return 'source-described ability/defense modifier and its executable combat consumer';
}
