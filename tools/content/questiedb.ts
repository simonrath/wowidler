/** Build-time adapter. Source bytes and this module never enter a runtime bundle. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { NormalizedEntity, RawEntity, RawFieldCandidate, SourceSelection, CatalogBuildContext, SourceGraphReference } from '../../src/domain/content';
import { canonical } from '../../src/content/provenance';
import { normalize } from './normalize';
import { verifySourceFile } from './lock';
import { sourceLockSchema, type SourceLock, type SourceFile } from './schema';
import { isTable, LuaReader, readerAt, readLuaValue, tokenize, type LuaTable, type LuaValue } from './questiedb-lua';
import { normalizeShape, patchField, validateShape } from './questiedb-patch';
import rules from './questiedb-corrections.json';
export interface Persona { faction:'Alliance'|'Horde'; playerClass:string }
export interface QuestieInputs { files:Record<string,Uint8Array>; persona:Persona; includeKeys?:string[] }
export interface ImportResult { buildContext:CatalogBuildContext; entities:NormalizedEntity[]; fingerprint:string; layers:{path:string;method:string;phase:'static'|'dynamic';rows:number}[]; coverage:{expectedCount:null;captured:number;complete:false}; limitations:string[]; persona:Persona }
interface Meta {keys:LuaTable;names:LuaTable;types:LuaTable;structures:LuaTable;zeroPairIsNil:LuaTable;constantValues?:LuaTable;normalize:LuaTable}
interface Provider {file:string;module:string;datatype:string;static?:LuaTable;dynamic?:LuaTable;options?:LuaTable}
const types=['Quest','Npc','Item','Object'] as const;
const classes=['WARRIOR','PALADIN','HUNTER','ROGUE','PRIEST','SHAMAN','MAGE','WARLOCK','DRUID'];
const asTable=(v:LuaValue,context:string):LuaTable=>{if(!isTable(v))throw Error(`${context}: expected table`);return v;};
export function readQuestieInputs(lock:SourceLock,persona:Persona,root='.'):QuestieInputs {return {persona,files:Object.fromEntries(lock.files.filter(f=>f.sourceId==='questiedb').map(f=>[f.path,readFileSync(`${root}/${f.localPath}`)]))};}
export function importQuestie(input:QuestieInputs,inputLock:SourceLock):ImportResult {
  const lock=sourceLockSchema.parse(inputLock);
  if(!classes.includes(input.persona.playerClass)||!['Horde','Alliance'].includes(input.persona.faction))throw Error('Explicit supported faction/class persona required');
  if(lock.sources.find(s=>s.id==='questiedb')?.commit!==rules.commit)throw Error('Questie adapter requires its reviewed source pin');
  const files=new Map<string,SourceFile>();const texts=new Map<string,string>();
  for(const file of lock.files.filter(f=>f.sourceId==='questiedb')) {
    const bytes=input.files[file.path];if(!bytes||!verifySourceFile(bytes,file).ok)throw Error(`${file.path}: bytes/hash differ from source lock`);
    files.set(file.path,file);texts.set(file.path,Buffer.from(bytes).toString('utf8'));
  }
  const text=(path:string)=>{const value=texts.get(path);if(value===undefined)throw Error(`Missing locked dependency ${path}`);return value;};
  for(const dependency of ['docs/api.md','docs/adr/0016-table-correction-operations.md','src/corrections/tablePatch.lua','src/corrections/registry.lua','src/corrections/manifest.lua','src/meta/normalize.lua'])text(dependency);
  const select=(path:string,selector:string):SourceSelection=>({sourceId:'questiedb',path,sha256:files.get(path)!.sha256,selector});
  const env:LuaTable={};const constants:LuaTable={};const meta:Record<string,Meta>={};
  const expansions='src/corrections/enum/expansions.lua';
  env.raceMaskById=readLuaValue(text(expansions),expansions,{},'constants.raceMaskById =');
  for(const name of ['classicAlliance','classicHorde','tbcAlliance','tbcHorde','cataAlliance','cataHorde'])env[name]=readLuaValue(text(expansions),expansions,env,`local ${name} =`);
  const byExpansion=asTable(readLuaValue(text(expansions),expansions,env,'constants.byExpansion ='),expansions);
  Object.assign(constants,asTable(byExpansion.Classic,expansions),asTable(byExpansion.Forever,expansions));
  for(const path of [...files.keys()].filter(p=>p.startsWith('src/corrections/enum/')&&!p.endsWith('constants.lua')&&!p.endsWith('expansions.lua'))) {
    const tokens=tokenize(text(path),path);
    for(let i=0;i<tokens.length-3;i++)if(tokens[i].text==='constants'&&tokens[i+1].text==='.'&&tokens[i+3].text==='=') {
      const r=new LuaReader(tokens,path,{constants});r.p=i+4;constants[tokens[i+2].text]=r.value();i=r.p-1;
    }
  }
  for(const type of types) {
    const path=`src/meta/${type.toLowerCase()}Meta.lua`;
    meta[type]=readLuaValue(text(path),path,{},'local meta =') as unknown as Meta;
    const keys:LuaTable={...meta[type].keys};for(const [name,index] of Object.entries(keys)){keys[name+'_add']=Number(index)+1000;keys[name+'_remove']=Number(index)-1000;}
    constants[type.toLowerCase()+'Keys']=keys;
  }
  env.__allowEnglishL10n=true;env.Questie=constants.iconTypes;env.QuestieDB=constants;env.ZoneDB={zoneIDs:constants.zoneIDs};env.Phasing={phases:constants.phases};env.QuestieProfessions={professionKeys:constants.professionKeys,specializationKeys:constants.specializationKeys,rankNames:constants.rankNames};
  const configPath='src/config.lua';const inventory=asTable(readLuaValue(text(configPath),configPath,{},'config.ownedCorrections ='),configPath);
  const providers=Object.values(inventory).map(v=>v as unknown as Provider).filter(p=>(p as unknown as LuaTable).owned==='Forever');
  if(providers.length!==18)throw Error('Unsupported Forever provider inventory');
  const annotations:CatalogBuildContext['annotations']=[];
  for(const provider of providers) {
    const path='src/corrections/'+provider.file,r=new LuaReader(tokenize(text(path),path),path);
    while(r.peek()!=='function') {
      if(r.peek()==='local') {
        r.take();const binding=r.take().text;r.take('=');r.take('QuestieLoader');r.take(':');const operation=r.take().text;
        if(!['CreateModule','ImportModule'].includes(operation))r.fail(operation);
        r.take('(');const name=r.take('string').value;r.take(')');if(r.peek()===';')r.take();
        if(name!==binding||(operation==='CreateModule'&&name!==provider.module))r.fail('module binding');
      } else if(r.peek()==='QuestieCorrections') {
        r.take();r.take('.');const field=r.take().text;
        if(!['itemObjectiveFirst','killCreditObjectiveFirst'].includes(field))r.fail(field);
        r.take('[');const id=r.take('number').value;r.take(']');r.take('=');r.take('true');
        annotations.push({key:`forever:quest:${id}` as RawEntity['key'],field:`questie.${field}`,value:true,source:select(path,`QuestieCorrections.${field}[${id}]`)});
      } else r.fail();
    }
    const allowed=new Set([...Object.values(provider.static??{}),...Object.values(provider.dynamic??{})]);
    for(let i=r.p;i<r.tokens.length;i++)if(r.tokens[i].text==='function') {
      if(r.tokens[i+1]?.text!==provider.module||r.tokens[i+2]?.text!==':'||!allowed.has(r.tokens[i+3]?.text))r.fail(`undeclared function ${r.tokens[i+1]?.text}`);
    }
  }
  const records=new Map<string,RawEntity>();const layers:ImportResult['layers']=[];
  function ensure(type:string,id:string,path:string,selector:string):RawEntity {
    if(!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id)))throw Error(`${path}: invalid entity ID ${id}`);
    const kind=type.toLowerCase() as RawEntity['kind'];const key=`forever:${kind}:${id}` as RawEntity['key'];
    let entity=records.get(key);if(!entity){entity={key,kind,branch:'forever',originalId:Number(id),identitySource:select(path,selector),fields:{}};records.set(key,entity);}return entity;
  }
  function set(entity:RawEntity,field:string,value:LuaValue,path:string,selector:string,reason:string) {
    const source=select(path,selector);const next=value??null;const candidate=entity.fields[field]?.[0];
    if(candidate) {const before=candidate.corrections.length?candidate.corrections.at(-1)!.after:candidate.value;candidate.corrections.push({before,after:structuredClone(next),reason,source});}
    else entity.fields[field]=[{value:structuredClone(next),source,status:'verified',corrections:[]}];
  }
  function effective(entity:RawEntity,field:string):LuaValue {const c=entity.fields[field]?.[0];const v=c?.corrections.length?c.corrections.at(-1)!.after:c?.value;return v===null?undefined:v as LuaValue;}
  for(const type of types) {
    const path=`data/Forever/forever${type}DB.lua`,marker=`QuestieDB.${type.toLowerCase()}Data =`;
    const payload=readLuaValue(text(path),path,{},marker);if(typeof payload!=='string')throw Error(`${path}: raw payload not a string`);
    const rows=asTable(readLuaValue(payload,path,{},'return'),path);
    for(const [id,row] of Object.entries(rows)) {
      const entity=ensure(type,id,path,`${marker}/return[${id}]`);
      for(const [index,value] of Object.entries(asTable(row,path))) {
        const name=meta[type].names[index];if(typeof name!=='string')throw Error(`${path}: unknown raw field ${index}`);
        set(entity,`questie.${name}`,value,path,`${marker}/return[${id}][${index}]`,'raw');
      }
    }
  }
  function providerRows(provider:Provider,method:string):LuaTable {
    const path='src/corrections/'+provider.file;
    const r=readerAt(text(path),path,{...env},`function ${provider.module}:${method}()`);
    while(r.peek()==='local') {
      r.take();const name=r.take().text;r.take('=');
      if(r.peek()==='UnitClassBase') {r.take();r.take('(');if(r.take('string').value!=='player')r.fail('UnitClassBase argument');r.take(')');r.env[name]=input.persona.playerClass;}
      else r.env[name]=r.value();
    }
    let value:LuaValue;
    if(r.peek()==='return') {r.take();value=r.value();r.take('end');}
    else if(r.peek()==='if') {
      r.take('if');r.take('UnitFactionGroup');r.take('(');if(r.take('string').value!=='Player')r.fail('faction argument');r.take(')');r.take('==');if(r.take('string').value!=='Horde')r.fail('faction comparison');r.take('then');r.take('return');const h=r.value();r.take('else');r.take('return');const a=r.value();r.take('end');r.take('end');value=input.persona.faction==='Horde'?h:a;
    }else r.fail();
    if(r.peek()==='return'){r.take();r.take(provider.module);}
    if(r.p<r.tokens.length&&r.peek()!=='function')r.fail('trailing provider code');
    return asTable(value,path);
  }
  for(const phase of ['static','dynamic'] as const)for(const provider of providers)for(const method of Object.values(provider[phase]??{})) {
    if(typeof method!=='string')throw Error('Invalid provider method');const path='src/corrections/'+provider.file;
    const rows=providerRows(provider,method);layers.push({path,method,phase,rows:Object.keys(rows).length});
    for(const [id,row] of Object.entries(rows)) {
      const key=`forever:${provider.datatype.toLowerCase()}:${id}`;
      const m=meta[provider.datatype];
      const fields=new Map<number,{replace?:LuaValue;add?:LuaValue;remove?:LuaValue;selectors:string[]}>();
      for(const [encoded,value] of Object.entries(asTable(row,path))) {
        const n=Number(encoded),op=n>1000?'add':n<0?'remove':'replace',index=op==='add'?n-1000:op==='remove'?n+1000:n;
        if(!Number.isInteger(n)||typeof m.names[index]!=='string')throw Error(`${path}: unknown correction operation ${encoded}`);
        const entry=fields.get(index)??{selectors:[]};entry[op]=value;entry.selectors.push(`${method}()[${id}][${encoded}]`);fields.set(index,entry);
      }
      // Validate even empty aliases. Empty operations acquire no ownership or entity membership.
      for(const [index,entry] of fields)for(const operand of [entry.add,entry.remove])if(operand!==undefined){
        try {validateShape(String(m.structures[index]??m.types[index]),operand);if(entry.replace!==undefined)throw Error('replacement/operation conflict');}
        catch(error){throw Error(`${path}: operation ${m.names[index]}: ${(error as Error).message}`);}
      }
      if(provider.options?.noNewEntries&&!records.has(key))continue;
      const acts=(entry:{replace?:LuaValue;add?:LuaValue;remove?:LuaValue})=>entry.replace!==undefined||[entry.add,entry.remove].some(v=>isTable(v)&&Object.keys(v).length>0);
      if(![...fields.values()].some(acts))continue;
      const entity=ensure(provider.datatype,id,path,`${method}()[${id}]`);
      for(const [index,entry] of fields) {
        if(!acts(entry))continue;
        const name=String(m.names[index]),field=`questie.${name}`,base=effective(entity,field);
        if(provider.options?.noOverwrites&&entity.fields[field]?.length)continue;
        try {
          let value:LuaValue;
          if(entry.replace!==undefined) {
            if(entry.add!==undefined||entry.remove!==undefined)throw Error('replacement/operation conflict');
            value=entry.replace;if(isTable(value)&&!Object.keys(value).length)value=undefined;
            if(value!==undefined&&typeof value!==(m.types[index]==='table'?'object':m.types[index]))throw Error(`replacement type ${name}`);
          }else value=patchField(String(m.structures[index]??m.types[index]),base,entry.add,entry.remove,m.zeroPairIsNil[index]===true);
          set(entity,field,value,path,entry.selectors.join(' + '),`${phase} ${provider.module}:${method}`);
        }catch(error){throw Error(`${path}: operation ${name}: ${(error as Error).message}`);}
      }
    }
  }
  for(const annotation of annotations){const entity=records.get(annotation.key);if(entity)set(entity,annotation.field,annotation.value,annotation.source.path,annotation.source.selector,'source objective display ordering annotation');}
  for(const entity of records.values()) {
    const type=types.find(t=>t.toLowerCase()===entity.kind)!;const m=meta[type];
    for(const [index,name] of Object.entries(m.names)) {
      const field=`questie.${name}`;let value=effective(entity,field);if(value===undefined){
        if(entity.fields[field]&&['questgivers','objectives'].includes(String(m.structures[index])))set(entity,field,{},'src/meta/normalize.lua',`normalize.neverNilStructures/${type}[${index}]`,'explicitly deleted never-nil table');
        continue;
      }
      const normalized=normalizeShape(String(m.structures[index]),value);
      if(m.constantValues?.[index]!==undefined){set(entity,field,m.constantValues[index],`src/meta/${type.toLowerCase()}Meta.lua`,`meta.constantValues[${index}]`,'deprecated compatibility placeholder; not gameplay health');continue;}
      if(m.normalize[index]==='faction'){value=value===''?undefined:value==='A'||value==='H'?value:'AH';if(value!==effective(entity,field))set(entity,field,value,'src/meta/normalize.lua','normalize.faction','documented faction read normalization');continue;}
      if(m.normalize[index]!==undefined)throw Error(`Unknown normalizer ${m.normalize[index]}`);
      if(m.zeroPairIsNil[index]&&isTable(normalized)&&(normalized[1]??0)===0&&(normalized[2]??0)===0)value=undefined;else value=isTable(normalized)&&!Object.keys(normalized).length&&!['questgivers','objectives'].includes(String(m.structures[index]))?undefined:normalized;
      if(canonical(value??null)!==canonical(effective(entity,field)??null))set(entity,field,value,'src/meta/normalize.lua',`normalize.field/${type}[${index}]`,'documented read normalization');
    }
    const name=entity.fields['questie.name'];if(name)entity.fields['name.en']=structuredClone(name);
  }
  for(const type of types) {
    const path=`l10n/Forever/lookup${type==='Npc'?'Npcs':type+'s'}/deDE.lua`;
    const tokens=tokenize(text(path),path);const strings=tokens.filter(t=>t.text==='string'&&typeof t.value==='string'&&t.value.startsWith('return {'));
    if(strings.length!==1)throw Error(`${path}: expected one locale payload`);
    const rows=asTable(readLuaValue(String(strings[0].value),path,{},'return'),path);
    for(const [id,row] of Object.entries(rows)) {
      const entity=records.get(`forever:${type.toLowerCase()}:${id}`);if(!entity)continue;
      const value=isTable(row)?row[1]:row;if(typeof value==='string'&&value.length) set(entity,'name.de',value,path,`deDE/return[${id}]${isTable(row)?'[1]':''}`,'localization');
      if(isTable(row)&&row[2]!==undefined&&['Quest','Npc'].includes(type))set(entity,type==='Quest'?'questie.deObjectivesText':'questie.deSubName',row[2],path,`deDE/return[${id}][2]`,'localization');
    }
  }
  const selectedKeys=input.includeKeys?new Set(input.includeKeys):undefined;
  const entities=normalize([...records.values()].filter(e=>!selectedKeys||selectedKeys.has(e.key)).sort((a,b)=>a.key.localeCompare(b.key)),lock);
  const buildContext:CatalogBuildContext={purpose:'source-evidence',annotations:annotations.filter(a=>!selectedKeys||selectedKeys.has(a.key)),persona:{...input.persona},dependencies:[...files.values()].map(f=>({sourceId:f.sourceId,path:f.path,sha256:f.sha256})).sort((a,b)=>a.path.localeCompare(b.path)),referenceGraph:questieReferenceGraph(entities)};
  return {buildContext,entities,layers,persona:{...input.persona},fingerprint:createHash('sha256').update(canonical({persona:input.persona,entities:entities.map(e=>e.fingerprint),layers})).digest('hex'),coverage:{expectedCount:null,captured:entities.length,complete:false},limitations:rules.limitations};
}

/** Derive every outgoing typed source reference from the packaged evidence itself.
 * Selected packages retain omitted targets as gaps; captured means present in this package.
 * This source graph preserves groups/selectors and is not a gameplay relationship assertion.
 */
export function questieReferenceGraph(entities:readonly NormalizedEntity[]):SourceGraphReference[] {
  const keys=new Set<string>(entities.map(entity=>entity.key));
  const referenceGraph:SourceGraphReference[]=[];
  for(const entity of entities) {
    const add=(field:string,domain:string,id:LuaValue,selector='')=>{
      if(typeof id!=='number'||id===0)return;
      if(!domain||!Number.isSafeInteger(id))throw Error(`Invalid reference ${entity.key}/${field}`);
      const target=`${entity.branch}:${domain}:${id}`;
      referenceGraph.push({from:entity.key,field:`questie.${field}`,selector,target,originalId:id,resolution:!['quest','npc','item','object'].includes(domain)||id<0?'external-domain':keys.has(target)?'captured':'missing-entity'});
    };
    const values=(v:LuaValue)=>isTable(v)?Object.entries(v):[];
    const get=(field:string):LuaValue=>entity.fields[`questie.${field}`]?.value as LuaValue ?? undefined;
    const many=(field:string,domain:string)=>{for(const [slot,id] of values(get(field)))add(field,domain,id,`[${slot}]`);};
    const single=(field:string,domain:string)=>add(field,domain,get(field));
    for(const field of ['questStarts','questEnds','questRewards','relatedQuests','preQuestGroup','preQuestSingle','childQuests','inGroupWith','exclusiveTo','breadcrumbs'])many(field,'quest');
    for(const field of ['nextQuestInChain','parentQuest','breadcrumbForQuestId','availableUntilCompleted','availableStartingWith','disabledByQuest','startQuest'])single(field,'quest');
    for(const field of ['npcDrops','vendors'])many(field,'npc');
    many('objectDrops','object');many('itemDrops','item');many('requiredSourceItems','item');single('sourceItemId','item');
    single('requiredSpell','spell');single('teachesSpell','spell');single('zoneID','zone');
    const zone=get('zoneOrSort');add('zoneOrSort',typeof zone==='number'&&zone<0?'quest-sort':'zone',zone);
    if(entity.kind==='npc')single('factionID','faction-template');
    for(const field of ['startedBy','finishedBy'])for(const [group,ids] of values(get(field)))for(const [slot,id] of values(ids))add(field,({'1':'npc','2':'object','3':'item'} as Record<string,string>)[group],id,`[${group}][${slot}]`);
    for(const [group,rows] of values(get('objectives'))) {
      if(group==='4'){if(isTable(rows))add('objectives','faction',rows[1],'[4][1]');continue;}
      for(const [slot,row] of values(rows))if(isTable(row)) {
        if(group==='5'){for(const [i,id] of values(row[1]))add('objectives','npc',id,`[5][${slot}][1][${i}]`);add('objectives','npc',row[2],`[5][${slot}][2]`);}
        else {add('objectives',({'1':'npc','2':'object','3':'item','6':'spell'} as Record<string,string>)[group],row[1],`[${group}][${slot}][1]`);if(group==='6')add('objectives','item',row[3],`[6][${slot}][3]`);}
      }
    }
    const spawnRefs=(field:string,value:LuaValue,prefix='')=>{for(const [zone,rows] of values(value)){add(field,'zone',Number(zone),`${prefix}[${zone}]`);for(const [i,row] of values(rows))if(isTable(row))add(field,'phase',row[3],`${prefix}[${zone}][${i}][3]`);}};
    spawnRefs('spawns',get('spawns'));
    for(const [zone] of values(get('waypoints')))add('waypoints','zone',Number(zone),`[${zone}]`);
    const trigger=get('triggerEnd');if(isTable(trigger))spawnRefs('triggerEnd',trigger[2],'[2]');
    for(const [slot,row] of values(get('extraObjectives')))if(isTable(row)){spawnRefs('extraObjectives',row[1],`[${slot}][1]`);for(const [i,ref] of values(row[5]))if(isTable(ref))add('extraObjectives',ref[1]==='monster'?'npc':String(ref[1]),ref[2],`[${slot}][5][${i}][2]`);}
    for(const field of ['requiredMinRep','requiredMaxRep','requiredSkill']) {const pair=get(field);if(isTable(pair))add(field,field==='requiredSkill'?'skill':'faction',pair[1],'[1]');}
    for(const field of ['reputationReward','requiredRanks'])for(const [slot,pair] of values(get(field)))if(isTable(pair))add(field,field==='requiredRanks'?'skill':'faction',pair[1],`[${slot}][1]`);
    single('requiredSpecialization','specialization');
  }
  referenceGraph.sort((a,b)=>`${a.from}/${a.field}/${a.selector}`.localeCompare(`${b.from}/${b.field}/${b.selector}`));
  return referenceGraph;
}
