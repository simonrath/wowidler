import { readFileSync, mkdtempSync, existsSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { importQuestie, readQuestieInputs } from '../../tools/content/questiedb';
import { readLuaValue } from '../../tools/content/questiedb-lua';
import { patchField } from '../../tools/content/questiedb-patch';
import { packageCatalog, packageBytes, writeCatalogPackage } from '../../tools/content/package';
import { normalize } from '../../tools/content/normalize';
import type { RawEntity, CatalogBuildContext, SourceGraphReference } from '../../src/domain/content';
import { resolveReferences } from '../../tools/content/resolve';
import expected from '../fixtures/content/questiedb/expected.json';
import lock from '../../content/sources/lock.json';
import { sourceLockSchema } from '../../tools/content/schema';
const sourceLock = sourceLockSchema.parse(lock);
const inputsFor=(persona: Parameters<typeof readQuestieInputs>[1]) => ({...readQuestieInputs(sourceLock,persona),includeKeys:['forever:quest:2','forever:quest:5','forever:quest:7','forever:quest:299','forever:quest:465','forever:quest:8315','forever:quest:78124','forever:quest:97277','forever:npc:300','forever:npc:352','forever:item:910','forever:item:1307','forever:object:167']});
const snapshot={id:sourceLock.snapshotId,branch:'forever' as const,referenceDate:'2026-10-21',sourceVersions:{questiedb:sourceLock.sources[0].commit!},categories:[]};
const lua = (text: string) => readLuaValue(text, 'fixture.lua');

describe('effective QuestieDB', () => {
  it('preserves nil holes and masks above 32 bits without executing Lua', () => {
    expect(lua('{nil,{630696},4294967373}')).toEqual({'2':{'1':630696},'3':4294967373});
    expect(() => lua('{evil()}')).toThrow(/fixture.lua.*evil/);
  });
  it('uses independent upstream shape literals and normalized atomic equality', () => {
    const shapes = readLuaValue(readFileSync('content/sources/vendor/QuestieDB/tools/validation/table-correction-cases.lua','utf8'), 'upstream-cases', {}, 'local shapes =');
    for (const entry of Object.values(shapes as Record<string, any>)) {
      expect(patchField(entry.shape, undefined, entry.a, undefined), entry.shape).toEqual(entry.a);
      expect(patchField(entry.shape, entry.a, entry.a, undefined)).toEqual(entry.a);
      expect(patchField(entry.shape, entry.a, undefined, entry.b)).toEqual(entry.a);
      expect(patchField(entry.shape, entry.a, undefined, entry.a)).toEqual(entry.empty);
      expect(patchField(entry.shape, entry.a, lua('{}'), undefined)).toEqual(entry.a);
      if (entry.combined) expect(patchField(entry.shape, entry.a, entry.b, undefined)).toEqual(entry.combined);
      else expect(() => patchField(entry.shape, entry.a, entry.b, undefined)).toThrow(/atomic/);
    }
    expect(patchField('objectives',lua('{{{11}}}'),undefined,lua('{{{11,nil,0}}}'))).toEqual({});
    expect(patchField('spawnlist',lua('{[12]={{1,2,0}}}'),undefined,lua('{[12]={{1,2}}}'))).toBeUndefined();
    expect(() => patchField('idarray',lua('{1}'),lua('{2}'),lua('{2}'))).toThrow(/conflict/);
    expect(() => patchField('number',1,lua('{2}'),undefined)).toThrow(/scalar/);
    expect(() => patchField('idarray',undefined,lua('{[2]=2}'),undefined)).toThrow(/dense/);
  });
  it('appliesCorrectionsInDocumentedOrder', () => {
    const result = importQuestie(inputsFor({faction:'Horde',playerClass:'WARRIOR'}),sourceLock);
    const field = (kind:string,id:number,name:string) => result.entities.find(e=>e.key===`forever:${kind}:${id}`)!.fields[`questie.${name}`]?.value;
    expect(field('quest',5,'requiredRaces')).toBe(expected.raw.quest5RaceMask);
    expect(field('npc',352,'spawns')).toEqual(expected.effective.npc352Spawns);
    expect(field('quest',299,'questLevel')).toBe(expected.effective.quest299Level);
    expect(field('quest',465,'finishedBy')).toEqual({'2':{'1':1609,'2':expected.effective.quest465ObjectFinisher}});
    expect(field('quest',8315,'nextQuestInChain')).toBe(8316);
    expect(result.entities.find(e=>e.key==='forever:npc:352')!.fields['combat.maxHealth'].status).toBe('missing');
    expect(field('npc',352,'minLevelHealth')).toBe(0);
    expect(field('npc',352,'maxLevelHealth')).toBe(1);
    expect(result.entities.every(e=>e.fields.relationships.status==='missing'&&e.fields.prerequisites.status==='missing')).toBe(true);
    expect(result.buildContext.referenceGraph.some(r=>r.resolution==='missing-entity')).toBe(true);
    const selectedKeys=new Set(result.entities.map(e=>e.key as string));
    expect(result.buildContext.referenceGraph.every(r=>selectedKeys.has(r.from))).toBe(true);
    expect(result.buildContext.annotations.every(a=>selectedKeys.has(a.key))).toBe(true);
    const omittedFinisher=result.buildContext.referenceGraph.find(r=>r.from==='forever:quest:465'&&r.target==='forever:object:1609');
    expect(omittedFinisher?.resolution).toBe('missing-entity');
    for(const [name,value] of Object.entries(expected.authoredDynamic.Horde))expect(field('quest',78124,name)).toEqual(value);
    expect(result.buildContext.annotations.find(a=>a.key==='forever:quest:97277')?.value).toBe(true);
    expect(field('quest',5,'deObjectivesText')).toEqual({'1':'Sprecht mit Küchenchef Grual.'});
    expect(result.buildContext.referenceGraph.some(r=>r.from==='forever:quest:465'&&r.target==='forever:object:630696')).toBe(true);
    const evidence=(kind:string,id:number,field:string) => result.entities.find(e=>e.key===`forever:${kind}:${id}`)!.fields[`questie.${field}`].candidates[0];
    const legacyValue=(kind:string,id:number,field:string,file:string) => {const candidate=evidence(kind,id,field);return candidate.source.path.endsWith(file)?candidate.value:candidate.corrections.find(c=>c.source.path.endsWith(file))!.after;};
    const authored=evidence('quest',78124,'startedBy').corrections.at(-1)!;
    expect(authored.before).toEqual({'1':{'1':211022,'2':211033},'2':{'1':409496}});
    expect(authored.source.path).toBe('src/corrections/Forever/foreverQuestFixes.lua');
    expect(authored.source.selector).toBe('LoadDynamic()[78124][2]');
    expect(authored.reason).toBe('dynamic ForeverQuestFixes:LoadDynamic');
    const resolvedSelection=resolveReferences(result.entities);if(!resolvedSelection.ok)throw Error(resolvedSelection.error.message);
    expect(packageCatalog({...resolvedSelection.value,buildContext:result.buildContext},snapshot).references.total).toBe(result.buildContext.referenceGraph.length);
    expect(legacyValue('quest',5,'breadcrumbs','classicQuestFixes.lua')).toEqual({'1':expected.legacy.quest5Breadcrumb});
    expect(legacyValue('npc',300,'minLevel','classicNPCFixes.lua')).toBe(expected.legacy.npc300Level);
    expect(legacyValue('item',910,'objectDrops','classicItemFixes.lua')).toEqual({'1':expected.legacy.item910ObjectDrop});
    expect(legacyValue('object',167,'zoneID','classicObjectFixes.lua')).toBe(expected.legacy.object167Zone);
    expect(legacyValue('quest',2,'reputationReward','classicQuestReputationFixes.lua')).toEqual(expected.legacy.quest2Reputation);
    // itemStartFixes uses noOverwrites/noNewEntries: raw 1307 already asserts quest 123.
    expect(field('item',1307,'startQuest')).toBe(expected.legacy.item1307Start);
    expect(evidence('item',1307,'startQuest').corrections.some(c=>c.source.path.endsWith('itemStartFixes.lua'))).toBe(false);
    expect(result.layers.filter(l=>l.phase==='static').length).toBe(18);
    expect(result.layers.at(-1)?.phase).toBe('dynamic');
    expect(result.coverage.expectedCount).toBeNull();
    expect(result.entities.every(e=>e.fields.implementation.value!=='playable')).toBe(true);
    const quest = result.entities.find(e=>e.key==='forever:quest:465')!;
    expect(quest.fields['questie.finishedBy'].candidates[0].corrections.map(c=>c.source.path)).toContain('src/corrections/Forever/traces/foreverQuestTraces.lua');
  },120000);
  it('applies the literal authored Alliance dynamic result', () => {
    const result=importQuestie(inputsFor({faction:'Alliance',playerClass:'WARRIOR'}),sourceLock);
    const quest=result.entities.find(e=>e.key==='forever:quest:78124')!;
    for(const [name,value] of Object.entries(expected.authoredDynamic.Alliance))expect(quest.fields[`questie.${name}`].value).toEqual(value);
  },120000);
  it('validates every source reference before staging and preserves the evidence pointer', () => {
    const makeRaw=(kind:'item'|'quest',id:number):RawEntity=>{
      const path=`data/Forever/forever${kind==='item'?'Item':'Quest'}DB.lua`;
      const identitySource={sourceId:'questiedb',path,sha256:sourceLock.files.find(f=>f.path===path)!.sha256,selector:`${kind}Data/return[${id}]`};
      return {key:`forever:${kind}:${id}`,branch:'forever',kind,originalId:id,identitySource,fields:kind==='item'?{'questie.startQuest':[{value:123,status:'verified',source:{...identitySource,selector:`${identitySource.selector}[5]`},corrections:[]}]}:{}};
    };
    const entities=normalize([makeRaw('item',1307),makeRaw('quest',123)],sourceLock);
    const resolved=resolveReferences(entities);if(!resolved.ok)throw Error(resolved.error.message);
    const edge:SourceGraphReference={from:'forever:item:1307',field:'questie.startQuest',selector:'',target:'forever:quest:123',originalId:123,resolution:'captured'};
    const buildContext:CatalogBuildContext={purpose:'source-evidence',persona:{faction:'Alliance',playerClass:'WARRIOR'},annotations:[],dependencies:[],referenceGraph:[edge]};
    const catalog={...resolved.value,buildContext};
    const output=mkdtempSync(join(tmpdir(),'questie-source-graph-'));
    try {
      writeCatalogPackage(catalog,snapshot,output);
      const pointer=readFileSync(join(output,'evidence-active.json'),'utf8'),files=readdirSync(output).sort();
      expect(()=>packageCatalog(resolved.value,snapshot)).toThrow(/Questie source evidence requires.*context/);
      expect(()=>writeCatalogPackage(resolved.value,snapshot,output)).toThrow(/Questie source evidence requires.*context/);
      expect(readFileSync(join(output,'evidence-active.json'),'utf8')).toBe(pointer);
      expect(readdirSync(output).sort()).toEqual(files);
      // Identity-only Questie evidence still needs context, even when it has no outgoing edges.
      expect(()=>packageCatalog({...resolved.value,entities:entities.filter(e=>e.kind==='quest')},snapshot)).toThrow(/Questie source evidence requires.*context/);
      const invalidGraphs:SourceGraphReference[][]=[
        [{...edge,from:'forever:item:999999'}],
        [{...edge,target:'forever:quest:999999',originalId:999999}],
        [{...edge,resolution:'missing-entity'}],
        [{...edge,resolution:'external-domain'}],
        [{...edge,originalId:124}],
        [{...edge,selector:'[1]'}],
        [{...edge,target:'forever:npc:123'}],
        [{...edge,field:'questie.sourceItemId'}],[],[edge,edge],
      ];
      for(const referenceGraph of invalidGraphs) {
        expect(()=>writeCatalogPackage({...catalog,buildContext:{...buildContext,referenceGraph}},snapshot,output),JSON.stringify(referenceGraph)).toThrow(/Source reference graph/);
        expect(readFileSync(join(output,'evidence-active.json'),'utf8')).toBe(pointer);
        expect(readdirSync(output).sort()).toEqual(files);
      }
      const partial={...catalog,entities:entities.filter(e=>e.kind==='item'),buildContext:{...buildContext,referenceGraph:[{...edge,resolution:'missing-entity' as const}]}};
      const saved=writeCatalogPackage(partial,snapshot,output);
      expect(saved.manifest.references).toEqual({total:1,missingEntities:1,externalDomains:0});
      expect(JSON.parse(readFileSync(join(saved.directory,'source-references.json'),'utf8'))).toEqual(partial.buildContext.referenceGraph);
      expect(saved.manifest.gameplayReady).toBe(false);
      expect(existsSync(join(output,'active.json'))).toBe(false);
      // A generic normalized catalog with an unrelated source remains context-optional.
      const genericLock=structuredClone(sourceLock),genericRaw=makeRaw('quest',123);
      genericLock.sources[0].id='fixture';
      for(const file of genericLock.files)if(file.sourceId==='questiedb')file.sourceId='fixture';
      genericRaw.identitySource.sourceId='fixture';
      const generic=resolveReferences(normalize([genericRaw],genericLock));if(!generic.ok)throw Error(generic.error.message);
      expect(packageCatalog(generic.value,{...snapshot,sourceVersions:{fixture:'synthetic'}}).references.total).toBe(0);
    } finally {rmSync(output,{recursive:true,force:true});}
  });
  it('rejectsUnknownCorrection and changed source bytes', () => {
    const inputs=inputsFor({faction:'Alliance',playerClass:'MAGE'});
    const file='src/corrections/Forever/foreverQuestFixes.lua';
    inputs.files[file]=Buffer.from('return evil()');
    expect(()=>importQuestie(inputs,sourceLock)).toThrow(/hash|lock|bytes/i);
  });
  it('rejects unknown functional operations after successful byte admission with file context', () => {
    const inputs=inputsFor({faction:'Alliance',playerClass:'MAGE'});
    const changed=structuredClone(sourceLock),path='src/corrections/Forever/legacy/classicQuestFixes.lua';
    const bytes=Buffer.from(Buffer.from(inputs.files[path]).toString('utf8').replace('return {','return unsupportedTransform()'));
    inputs.files[path]=bytes;
    const file=changed.files.find(f=>f.path===path)!;file.bytes=bytes.length;
    file.sha256=createHash('sha256').update(bytes).digest('hex');file.blobSha=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    expect(()=>importQuestie(inputs,changed)).toThrow(/classicQuestFixes.lua:.*unsupportedTransform/);
  },30000);
  it('validates skipped new rows and preserves an explicit deletion under noOverwrites', () => {
    const persona={faction:'Alliance' as const,playerClass:'MAGE'};
    const rewrite=(path:string,transform:(text:string)=>string)=>{
      const inputs=inputsFor(persona),changed=structuredClone(sourceLock);
      const bytes=Buffer.from(transform(Buffer.from(inputs.files[path]).toString('utf8')));inputs.files[path]=bytes;
      const file=changed.files.find(f=>f.path===path)!;file.bytes=bytes.length;
      file.sha256=createHash('sha256').update(bytes).digest('hex');file.blobSha=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      return {inputs,changed};
    };
    const invalid=rewrite('src/corrections/Forever/legacy/itemStartFixes.lua',text=>text.replace('return {','return { [99999999] = {[9999] = {}},'));
    expect(()=>importQuestie(invalid.inputs,invalid.changed)).toThrow(/itemStartFixes.lua.*operation 9999/);
    const deleted=rewrite('src/corrections/Forever/legacy/classicItemFixes.lua',text=>text.replace('return {','return { [1307] = {[itemKeys.startQuest] = {}},'));
    const result=importQuestie(deleted.inputs,deleted.changed);
    const field=result.entities.find(e=>e.key==='forever:item:1307')!.fields['questie.startQuest'];
    expect(field.value).toBeNull();
    expect(field.candidates[0].corrections.some(c=>c.source.path.endsWith('itemStartFixes.lua'))).toBe(false);
  },120000);
  it('rejects malformed shapes, atomic conflicts and respects empty operations', () => {
    expect(()=>patchField('spawnlist',undefined,lua('{[12]={{1,2,0,99}}}'),undefined)).toThrow(/slot/);
    expect(()=>patchField('pair',lua('{164,75}'),lua('{164,150}'),lua('{164,75}'))).toThrow(/atomic/);
    expect(()=>patchField('number',5,lua('{}'),undefined)).toThrow(/scalar/);
    expect(patchField('idarray','invalid-backend',lua('{}'),undefined)).toBe('invalid-backend');
    expect(patchField('objectives',lua('{[4]={72,3000}}'),lua('{[4]={72,9000}}'),lua('{[4]={72,3000}}'))).toEqual(lua('{[4]={72,9000}}'));
    expect(patchField('spawnlist',lua('{[12]={{-1,-1,9}}}'),undefined,lua('{[12]={{-1,-1}}}'))).toBeUndefined();
    expect(patchField('extraobjectives',lua('{{nil,3,"x"}}'),undefined,lua('{{nil,3,"x",0}}'))).toBeUndefined();
  });
  it('sameInputsProduceSameBytes and packages are validated before activation', () => {
    const inputs=inputsFor({faction:'Horde',playerClass:'DRUID'});
    const a=importQuestie(inputs,sourceLock), b=importQuestie(inputs,sourceLock);
    expect(a.entities.find(e=>e.key==='forever:quest:8315')!.fields['questie.nextQuestInChain'].value).toBe(8382);
    expect(a.fingerprint).toBe(b.fingerprint);
    const resolved=resolveReferences(a.entities);
    if(!resolved.ok) throw Error(resolved.error.message);
    const snapshot={id:sourceLock.snapshotId,branch:'forever' as const,referenceDate:'2026-10-21',sourceVersions:{questiedb:sourceLock.sources[0].commit!},categories:[]};
    const resolvedB=resolveReferences(b.entities);if(!resolvedB.ok)throw Error(resolvedB.error.message);
    const catalogA={...resolved.value,buildContext:a.buildContext},catalogB={...resolvedB.value,buildContext:b.buildContext};
    expect(packageBytes(packageCatalog(catalogA,snapshot))).toBe(packageBytes(packageCatalog(catalogB,snapshot)));
    const output=mkdtempSync(join(tmpdir(),'questie-package-'));
    try {
      const saved=writeCatalogPackage(catalogA,snapshot,output);
      expect(saved.manifest.gameplayReady).toBe(false);
      expect(saved.manifest.admission).toBe('validated-source-evidence');
      expect(existsSync(join(output,'active.json'))).toBe(false);
      const pointer=readFileSync(join(output,'evidence-active.json'),'utf8');
      const broken=structuredClone(a.entities[0]);broken.fingerprint='0'.repeat(64);
      expect(()=>writeCatalogPackage({...catalogA,entities:[broken]},snapshot,output)).toThrow(/fingerprint/);
      expect(readFileSync(join(output,'evidence-active.json'),'utf8')).toBe(pointer);
      for(const file of saved.manifest.contents)expect(createHash('sha256').update(readFileSync(join(saved.directory,file.path))).digest('hex')).toBe(file.sha256);
      writeFileSync(join(saved.directory,saved.manifest.contents[0].path),'corrupt');
      expect(()=>writeCatalogPackage(catalogA,snapshot,output)).toThrow(/corrupted/);
      expect(readFileSync(join(output,'evidence-active.json'),'utf8')).toBe(pointer);
    } finally {rmSync(output,{recursive:true,force:true});}
  },120000);
});
