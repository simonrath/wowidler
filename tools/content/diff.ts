import type { NormalizedEntity } from '../../src/domain/content';
export function diffCatalog(before:readonly NormalizedEntity[],after:readonly NormalizedEntity[]) {
  const a=new Map(before.map(e=>[e.key,e.fingerprint])),b=new Map(after.map(e=>[e.key,e.fingerprint]));
  return {added:[...b.keys()].filter(k=>!a.has(k)).sort(),removed:[...a.keys()].filter(k=>!b.has(k)).sort(),changed:[...b.keys()].filter(k=>a.has(k)&&a.get(k)!==b.get(k)).sort()};
}
