/** Shapes of the datasets in /data, written by scripts/data/build.mjs from talentsforever.com, LibQuestDB and VMaNGOS. */

export type Role = 'tank' | 'healer' | 'melee' | 'ranged';
export type Faction = 'alliance' | 'horde';

export interface SpecInfo {
  id: number;
  slug: string;
  name: string;
  icon: string;
  role: Role;
}

export interface TalentStats {
  new: number;
  changed: number;
  same: number;
  removed: number;
  moved: number;
  total: number;
}

export interface ClassInfo {
  id: number;
  slug: string;
  name: string;
  color: string;
  resource: string;
  icon: string;
  armor: string[];
  weapons: string[];
  plateAt?: number;
  mailAt?: number;
  specs: SpecInfo[];
  races: string[];
  newRaces: string[];
  talentStats: TalentStats;
  abilityCount: number;
}

export interface Racial {
  id: number;
  name: string;
  icon: string;
  passive: boolean;
  desc: string;
}

export interface RaceInfo {
  id: number;
  slug: string;
  name: string;
  faction: Faction;
  icon: string;
  start: string;
  classes: string[];
  newClasses: string[];
  isNew?: boolean;
  racials: Racial[];
  racialVariants?: Record<string, Racial[]>;
}

export type TalentStatus = 'new' | 'changed' | 'same';

export interface Talent {
  id: number;
  name: string;
  icon: string;
  row: number;
  col: number;
  max: number;
  spells: number[];
  desc: string[];
  req?: { id: number; qty: number };
  status: TalentStatus;
  was?: { max?: number; desc?: string; tree?: string; row?: number; col?: number };
}

export interface TalentTree {
  id: number;
  slug: string;
  name: string;
  icon: string;
  role: Role;
  talents: Talent[];
}

export interface RemovedTalent {
  id: number;
  name: string;
  icon: string;
  tree: string | null;
  max: number;
  desc: string;
}

export interface ClassTalents {
  cls: string;
  trees: TalentTree[];
  removed: RemovedTalent[];
  stats: TalentStats;
}

export type AbilityChange = 'introduced' | 'nowTrainable' | 'changedLevels';

export interface Ability {
  id: number;
  name: string;
  rank: string;
  icon: string;
  level: number;
  desc: string;
  change?: AbilityChange;
}

export interface Build {
  id: string;
  cls: string;
  spec: string;
  name: string;
  kind: 'leveling' | 'raid' | 'dungeon' | 'pvp' | 'tank' | 'heal';
  code: string;
  order: string;
  points: [number, number, number];
  summary: string;
  notes?: string[];
}

/** Compact item record (keys kept short: there are ~9,000 of them). */
export interface Item {
  i: number;
  n: string;
  q: number;
  l: number;
  r: number;
  s: number;
  c: number;
  sc: number;
  ic?: string;
  st?: Record<string, number>;
  ar?: number;
  w?: [number, number, number, number, number];
  du?: number;
  sell?: number;
  src?: number[];
  sm?: { t?: number; id?: number; n?: string; z?: number; s?: number; bd?: number }[];
  ch?: 'n' | 'x' | string[];
  set?: number;
  cls?: number;
  race?: number;
  side?: number;
  uq?: number;
  rep?: [number, number];
  sk?: [number, number];
  pop?: number;
  bag?: number;
  /** Green lines exactly as the Forever client prints them: Equip, Use, Chance on hit, charges. */
  fx?: string[];
  /** Binding line, e.g. "Binds when picked up". */
  b?: string;
  /** Flavor text. */
  f?: string;
  /** Uniqueness as printed: "Unique", "Unique (5)", "Unique-Equipped: Artisan's Tier (1)". */
  u?: string;
  /** White stat lines as printed, in the client's order: "+8 Strength", "9 Block", "Restores +3 mana per 5 sec." */
  wl?: string[];
  /** Label above the item level, e.g. "Sanctified" or "Crafted". */
  lb?: string;
  /** Profession, reputation and rank requirements as printed. */
  rq?: string[];
  /** The item starts a quest. */
  bq?: 1;
  /** No level requirement in the game; r is then the level the item is usually found at. */
  nr?: 1;
  races?: string;
  dur?: string;
  /** Availability: n = new in Forever, c = Classic world item, r = Classic raid drop, e = era item without a confirmed source. */
  av?: 'n' | 'c' | 'r' | 'e';
}

export interface ItemSet {
  id: number;
  n: string;
  q?: number;
  lo?: number;
  hi?: number;
  pieces: number[];
  type?: number;
  pop?: number;
  ch?: 'n' | string[];
  cls?: number;
  bonus?: [number, string][];
  era?: number;
}

export interface Zone {
  id: number;
  n: string;
  cat: number;
  inst: number;
  lo: number;
  hi: number;
  req: number;
  np: number;
  t: number;
  st: 'same' | 'new' | 'updated' | string;
  pop: number;
  lines?: string[];
}

export interface ZonePage {
  elites: string[];
  npcCount: number;
  quests: { id: number; n: string; l?: number; r?: number; side?: number }[];
  questCount: number;
  rewards: number[];
}

export interface Faction2 {
  n: string;
  side?: number;
  new?: boolean;
}

export interface DungeonInfo {
  slug: string;
  name: string;
  kind: 'dungeon' | 'raid' | 'battleground';
  size: number;
  levels: [number, number] | null;
  levelSource: 'beta' | 'announced' | 'classic';
  location: string;
  zoneId?: number;
  isNew: boolean;
  status: string;
  summary: string;
  bosses?: string[];
  bossCount?: number;
  opens?: string;
  art?: string;
  notes?: string[];
}

export interface SpellRecord {
  id: number;
  name: string;
  icon: string;
  rank?: string;
  desc: string;
  kind: 'talent' | 'ability' | 'racial';
  cls?: string;
  talentId?: number;
  level?: number;
}

export interface GuideMeta {
  slug: string;
  title: string;
  description: string;
  category: string;
  cls?: string;
  art?: string;
  icon?: string;
  updated: string;
  readMinutes: number;
  order: number;
}

/* ── Quests, NPCs and loot ───────────────────────────────────────────────────
   Which quests exist in Forever, Forever's quest XP and its own new quests come from LibQuestDB; the quests
   Forever keeps from Classic, with their text, givers, objectives, rewards and the loot tables, come from VMaNGOS (1.12). */

/** One objective: kill an NPC, use an object, collect an item, free text, or reach a reputation. */
export type QuestReq = [kind: 'n' | 'o' | 'i' | 't' | 'r', id: number | null, text: string | null, count: number];

export interface Quest {
  i: number;
  n: string;
  /** Quest level, required level, side (1 Alliance, 2 Horde, 3 both), zone or category, category group */
  l: number;
  r: number;
  s: number;
  z: number;
  c2: number;
  /** 1 group, 21 life, 41 PvP, 62 raid, 81 dungeon, 82 world event */
  ty?: number;
  rc?: number;
  xp?: number;
  m?: number;
  ir?: [number, number][];
  ic?: [number, number][];
  rp?: [number, number][];
  /** n new in Forever, u changed, x unconfirmed, c as in Classic */
  ch: 'n' | 'u' | 'x' | 'c';
  cl?: string[];
  pop?: number;
  o?: string;
  rq?: QuestReq[];
  d?: string;
  pg?: string;
  cp?: string;
  st?: ['n' | 'o' | 'i', number][];
  en?: ['n' | 'o', number][];
  pv?: number;
  nx?: number;
  ex?: number;
  pi?: number;
  rep?: 1;
  sk?: [number, number];
  tl?: number;
  gp?: number;
  rr?: number;
  sp?: number;
  ev?: number;
}

/** name, title, min level, max level, rank (1 elite, 2 rare elite, 3 boss, 4 rare), reaction to Alliance then Horde, zone, NPC flags, creature type */
export type Npc = [name: string, title: string, lo: number, hi: number, rank: number, react: string, zone: number, flags: number, type: number];

/** name, zone, object type */
export type WorldObject = [name: string, zone: number, type: number];

/** Items outside the gear database: quest items, consumables, trade goods, recipes, containers. */
export type MinorItem = [name: string, q: number, icon: string, cls: number, sub: number, ilvl: number, req: number, buy: number, stack: number, startQuest: number];

/** Where an item comes from: n NPC, o object, i container item, p pickpocketing, s skinning, f fishing in a zone. */
/** observed: 1 when the chance was measured in Forever rather than read from Classic's loot tables (none are yet). */
export type DropSource = [kind: 'n' | 'o' | 'i' | 'p' | 's' | 'f', id: number, pct: number, quest: 0 | 1, observed?: 1];

export interface Drops {
  /** Every source, even the ones not listed */
  t: number;
  s: DropSource[];
}

/** A Legacy perk: one rank per point, in a 4 by 4 grid (row and col from 1). */
export interface LegacyPerk {
  id: string;
  /** One character in plan links. */
  code: string;
  name: string;
  max: number;
  row: number;
  col: number;
  icon: string;
  /** Points this tree needs in perks with a lower gate before the first point here. */
  gate: number;
  /** The perk that must be at full rank first. */
  req?: string;
  /** Tooltip text of each rank, rank 1 first. */
  ranks: string[];
  /** For a perk you cast: its cast time and cooldown. */
  active?: string[];
}

export interface LegacyTree {
  id: number;
  name: string;
  slug: string;
  icon: string;
  perks: LegacyPerk[];
  /** Slots the game marks "To be added in a future update". */
  slots: { row: number; col: number }[];
}

export interface LegacyFactionPair {
  alliance: { name: string; id?: number };
  horde: { name: string; id?: number };
}

export interface LegacyChallenge {
  key: string;
  name: string;
  desc: string;
  points: number;
  group: 'classes' | 'crafting' | 'pvp' | 'dungeons' | 'other';
  /** Challenges of one kind reached in order: ticking a step ticks the steps before it. */
  ladder?: string;
  step?: number;
  cls?: string;
  level?: number;
  prof?: string;
  profName?: string;
  skill?: number;
  skillLine?: number;
  icon?: string;
  rank?: number;
  week?: number;
  bg?: string;
  bgName?: string;
  factions?: LegacyFactionPair;
  band?: string;
  dungeons?: { slug?: string; either?: string[]; parts?: string }[];
  raid?: string;
}

export interface LegacyData {
  /** Points each character can spend at launch. */
  points: number;
  /** Points the account can earn. */
  total: number;
  source: string;
  trees: LegacyTree[];
  groups: { id: LegacyChallenge['group']; name: string; count: number }[];
  challenges: LegacyChallenge[];
}
