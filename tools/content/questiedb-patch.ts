import { canonical } from '../../src/content/provenance';
import { isTable, type LuaTable, type LuaValue } from './questiedb-lua';
const empty=(v:LuaValue)=>v===undefined||(isTable(v)&&!Object.keys(v).length);
function table(v:LuaValue):LuaTable {if(!isTable(v))throw Error('operation requires table');return v;}
function integer(v:LuaValue) {if(typeof v!=='number'||!Number.isSafeInteger(v))throw Error('expected safe integer');}
function number(v:LuaValue) {if(typeof v!=='number'||!Number.isFinite(v))throw Error('expected finite number');}
function string(v:LuaValue) {if(typeof v!=='string')throw Error('expected string');}
function slots(t:LuaTable,max:number) {if(Object.keys(t).some(k=>!/^\d+$/.test(k)||Number(k)<1||Number(k)>max))throw Error('unknown tuple slot');}
function list(v:LuaValue,entry:(v:LuaValue)=>void):LuaTable {const t=table(v);if(Object.keys(t).some(k=>!/^\d+$/.test(k)||Number(k)<1||Number(k)>Object.keys(t).length))throw Error('list must be dense');Object.values(t).forEach(entry);return t;}
function pair(v:LuaValue) {const t=table(v);slots(t,2);if(t[1]!==undefined)integer(t[1]);if(t[2]!==undefined)integer(t[2]);}
function coord(v:LuaValue) {const t=table(v);slots(t,3);number(t[1]);number(t[2]);if(t[3]!==undefined)integer(t[3]);}
function spawn(v:LuaValue) {for(const [k,x] of Object.entries(table(v))) {if(!Number.isSafeInteger(Number(k)))throw Error('invalid zone');list(x,coord);}}
function objective(v:LuaValue,group:number) {const t=table(v);slots(t,group===5?4:3);if(t[1]!==undefined){if(group===5)list(t[1],integer);else integer(t[1]);}if(group===5&&t[2]!==undefined)integer(t[2]);const text=group===5?3:2,icon=text+1;if(t[text]!==undefined)string(t[text]);if(t[icon]!==undefined)integer(t[icon]);}
function extra(v:LuaValue) {const t=table(v);slots(t,5);if(t[1]!==undefined)spawn(t[1]);if(t[2]!==undefined)integer(t[2]);if(t[3]!==undefined)string(t[3]);if(t[4]!==undefined)integer(t[4]);if(t[5]!==undefined)list(t[5],ref=>{const r=table(ref);slots(r,2);if(r[1]!==undefined&&!['monster','object','item'].includes(String(r[1])))throw Error('invalid reference kind');if(r[2]!==undefined)integer(r[2]);});}
export function validateShape(shape:string,value:LuaValue):void {
  switch(shape) {
    case 'idarray':list(value,integer);break;
    case 'stringarray':list(value,string);break;
    case 'pair':pair(value);break;
    case 'pairs':list(value,pair);break;
    case 'questgivers': {const t=table(value);slots(t,3);Object.values(t).forEach(v=>list(v,integer));break;}
    case 'objectives': {const t=table(value);slots(t,6);for(const [k,v] of Object.entries(t)) {if(k==='4')pair(v);else list(v,x=>objective(x,Number(k)));}break;}
    case 'spawnlist':spawn(value);break;
    case 'waypointlist':for(const [k,v] of Object.entries(table(value))){if(!Number.isSafeInteger(Number(k)))throw Error('invalid zone');list(v,path=>list(path,coord));}break;
    case 'trigger': {const t=table(value);slots(t,2);if(t[1]!==undefined)string(t[1]);if(t[2]!==undefined)spawn(t[2]);break;}
    case 'extraobjectives':list(value,extra);break;
    default:throw Error(`scalar or unsupported shape ${shape}`);
  }
}
/** Only the documented tuple normalizations; never generic recursive merging. */
export function normalizeShape(shape:string,value:LuaValue):LuaValue {
  if(!isTable(value))return value;
  const out=structuredClone(value);
  const coords=(spawns:LuaValue,waypoint=false)=>{if(!isTable(spawns))return;for(const zone of Object.values(spawns)){if(!isTable(zone))continue;for(const pointOrPath of Object.values(zone)){if(!isTable(pointOrPath))continue;for(const point of waypoint?Object.values(pointOrPath):[pointOrPath])if(isTable(point)&&(waypoint||point[3]===0||(point[1]===-1&&point[2]===-1)))delete point[3];}}};
  if(shape==='spawnlist')coords(out);
  if(shape==='waypointlist')coords(out,true);
  if(shape==='trigger')coords(out[2]);
  if(shape==='objectives')for(const [g,rows] of Object.entries(out))if(g!=='4'&&isTable(rows))for(const row of Object.values(rows))if(isTable(row))row[g==='5'?4:3]??=0;
  if(shape==='extraobjectives')for(const row of Object.values(out))if(isTable(row)){coords(row[1]);row[4]??=0;}
  return out;
}
const equal=(a:LuaValue,b:LuaValue)=>a===undefined||b===undefined?a===b:canonical(a)===canonical(b);
function union(base:LuaValue,add:LuaValue,remove:LuaValue,atomic:boolean):LuaValue {
  if(atomic) {
    if(!empty(add)&&!empty(remove)&&equal(add,remove))throw Error('conflicting add/remove');
    let value=empty(base)?undefined:base;
    if(!empty(remove)&&equal(value,remove))value=undefined;
    if(!empty(add)){if(value!==undefined&&!equal(value,add))throw Error('different atomic value already exists');value=add;}
    return value;
  }
  const additions=Object.values((add??{}) as LuaTable),removals=Object.values((remove??{}) as LuaTable);
  if(additions.some(a=>removals.some(r=>equal(a,r))))throw Error('conflicting add/remove');
  const values=Object.values((base??{}) as LuaTable).filter(v=>!removals.some(r=>equal(v,r)));
  for(const item of additions)if(!values.some(v=>equal(v,item)))values.push(item);
  return Object.fromEntries(values.map((v,i)=>[String(i+1),v]));
}
export function patchField(shape:string,base:LuaValue,add:LuaValue,remove:LuaValue,zeroPairIsNil=false):LuaValue {
  // Empty operands must not read/validate even an invalid backend value.
  for(const value of [add,remove])if(value!==undefined)validateShape(shape,value);
  if(empty(add)&&empty(remove))return structuredClone(base);
  const normalized=(v:LuaValue)=>zeroPairIsNil&&isTable(v)&&(v[1]??0)===0&&(v[2]??0)===0?undefined:normalizeShape(shape,v);
  add=normalized(add);remove=normalized(remove);
  if(empty(add)&&empty(remove))return structuredClone(base);
  if(!empty(base))validateShape(shape,base);
  base=normalized(base);
  if(shape==='pair'||shape==='trigger') {
    if(!empty(add)&&!empty(remove))throw Error('conflicting atomic operations');
    return union(base,add,remove,true);
  }
  if(['questgivers','objectives','spawnlist','waypointlist'].includes(shape)) {
    const out:LuaTable=structuredClone((base??{}) as LuaTable),a=(add??{}) as LuaTable,r=(remove??{}) as LuaTable;
    for(const key of new Set([...Object.keys(a),...Object.keys(r)])) {
      const result=union(out[key],a[key],r[key],shape==='objectives'&&key==='4');
      if(empty(result))delete out[key];else out[key]=result;
    }
    return !Object.keys(out).length&&!['questgivers','objectives'].includes(shape)?undefined:out;
  }
  if(!['idarray','stringarray','pairs','extraobjectives'].includes(shape))throw Error(`scalar or unsupported shape ${shape}`);
  const result=union(base,add,remove,false);return empty(result)?undefined:result;
}
