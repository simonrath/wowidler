import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, renameSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { entitySchema, snapshotSpecSchema, type Catalog, type SnapshotSpec, type CatalogBuildContext } from '../../src/domain/content';
import { canonical, isNormalized } from '../../src/content/provenance';
import { contentFingerprint } from './normalize';
import { resolveReferences } from './resolve';
import { questieReferenceGraph } from './questiedb';
import { requirePlayable } from '../../src/content/capabilities';
import rules from './questiedb-corrections.json';
export interface PackageManifest {
  snapshot:SnapshotSpec; buildContext?:Omit<CatalogBuildContext,'referenceGraph'>; admission:'validated-source-evidence'|'validated-gameplay'; gameplayReady:boolean; references:{total:number;missingEntities:number;externalDomains:number}; schemaVersion:1;adapterVersion:string;rulesVersion:string;
  dependencies:{sourceId:string;path:string;sha256:string}[];
  contents:{path:string;kind:string;sha256:string;bytes:number;count:number}[];
}
const digest=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function partitions(catalog:Catalog):Map<string,string> {
  const groups=new Map<string,unknown[]>();for(const entity of [...catalog.entities].sort((a,b)=>a.key.localeCompare(b.key))){const group=groups.get(entity.kind)??[];group.push(entity);groups.set(entity.kind,group);}
  if(catalog.buildContext)groups.set('source-references',catalog.buildContext.referenceGraph);
  return new Map([...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([kind,entities])=>[kind,canonical(entities)+'\n']));
}
export function packageCatalog(catalog:Catalog,snapshot:SnapshotSpec):PackageManifest {
  snapshot=snapshotSpecSchema.parse(snapshot);const keys=new Set();const dependencies=new Map<string,PackageManifest['dependencies'][number]>();
  for(const entity of catalog.entities) {
    if(keys.has(entity.key)||entity.branch!==snapshot.branch)throw Error('Package duplicate key or branch mismatch');keys.add(entity.key);
    if(isNormalized(entity)) {
      const {fingerprint,...payload}=entity;
      if(entity.snapshotId!==snapshot.id||fingerprint!==contentFingerprint(payload))throw Error('Package evidence fingerprint/snapshot mismatch');
      for(const evidence of Object.values(entity.fields))for(const candidate of evidence.candidates)for(const source of [candidate.source,...candidate.corrections.map(c=>c.source)]) {
        const dependency={sourceId:source.sourceId,path:source.path,sha256:source.sha256};
        if(!snapshot.sourceVersions[source.sourceId])throw Error('Package dependency has no version');dependencies.set(`${source.sourceId}:${source.path}:${source.sha256}`,dependency);
      }
    }else entitySchema.parse(entity);
  }
  if([...dependencies.values()].some(source=>source.sourceId==='questiedb')&&catalog.buildContext?.purpose!=='source-evidence')throw Error('Questie source evidence requires its source graph context');
  for(const dependency of catalog.buildContext?.dependencies??[]){if(!snapshot.sourceVersions[dependency.sourceId])throw Error('Package build dependency has no version');dependencies.set(`${dependency.sourceId}:${dependency.path}:${dependency.sha256}`,dependency);}
  const normalized=catalog.entities.filter(isNormalized);
  if(normalized.length===catalog.entities.length&&!resolveReferences(normalized).ok)throw Error('Package graph invalid');
  if(catalog.buildContext) {
    // Never certify a caller-supplied graph merely because canonical gameplay fields are missing.
    // Re-derivation checks origin scope, typed targets, IDs, selectors, resolution and completeness.
    const actual=catalog.buildContext.referenceGraph,expected=questieReferenceGraph(normalized);
    if(!Array.isArray(actual)||actual.length!==expected.length)throw Error('Source reference graph does not match packaged evidence');
    for(let i=0;i<expected.length;i++)if(canonical(actual[i])!==canonical(expected[i]))throw Error(`Source reference graph does not match packaged evidence at ${expected[i].from}/${expected[i].field}/${expected[i].selector}`);
  }
  const gameplayReady=catalog.buildContext?.purpose!=='source-evidence'&&catalog.entities.length>0&&catalog.entities.every(e=>requirePlayable(e).ok);
  const graph=catalog.buildContext?.referenceGraph??[];
  const {referenceGraph: _graph,...context}=catalog.buildContext??{};
  return {snapshot,...(catalog.buildContext?{buildContext:context as Omit<CatalogBuildContext,'referenceGraph'>}:{}),admission:gameplayReady?'validated-gameplay':'validated-source-evidence',gameplayReady,references:{total:graph.length,missingEntities:graph.filter(r=>r.resolution==='missing-entity').length,externalDomains:graph.filter(r=>r.resolution==='external-domain').length},schemaVersion:1,adapterVersion:rules.adapterVersion,rulesVersion:rules.rulesVersion,dependencies:[...dependencies.values()].sort((a,b)=>a.path.localeCompare(b.path)),contents:[...partitions(catalog)].map(([kind,bytes])=>({path:`${kind}.json`,kind,sha256:digest(bytes),bytes:Buffer.byteLength(bytes),count:kind==='source-references'?graph.length:catalog.entities.filter(e=>e.kind===kind).length}))};
}
export const packageBytes=(manifest:PackageManifest)=>canonical(manifest)+'\n';
/** All files are staged and checksum-verified before an atomic active pointer is replaced. */
export function writeCatalogPackage(catalog:Catalog,snapshot:SnapshotSpec,output:string):{manifest:PackageManifest;directory:string} {
  const manifest=packageCatalog(catalog,snapshot),manifestBytes=packageBytes(manifest),id=digest(manifestBytes);
  mkdirSync(output,{recursive:true});const staging=join(output,`.staging-${id}`),directory=join(output,id);
  mkdirSync(staging,{recursive:true});
  for(const [kind,bytes] of partitions(catalog))writeFileSync(join(staging,`${kind}.json`),bytes);
  writeFileSync(join(staging,'manifest.json'),manifestBytes);
  for(const file of manifest.contents) {const bytes=readFileSync(join(staging,file.path));if(bytes.length!==file.bytes||digest(bytes)!==file.sha256)throw Error(`Staged checksum failed: ${file.path}`);}
  if(digest(readFileSync(join(staging,'manifest.json')))!==id)throw Error('Staged manifest checksum failed');
  if(existsSync(directory)) {for(const file of [...manifest.contents,{path:'manifest.json',sha256:id}])if(digest(readFileSync(join(directory,file.path)))!==file.sha256)throw Error('Existing package corrupted');rmSync(staging,{recursive:true});}
  else renameSync(staging,directory);
  const pointer=manifest.gameplayReady?'active.json':'evidence-active.json';
  writeFileSync(join(output,`.${pointer}.tmp`),canonical({package:id,manifestSha256:id,gameplayReady:manifest.gameplayReady})+'\n');renameSync(join(output,`.${pointer}.tmp`),join(output,pointer));
  return {manifest,directory};
}
