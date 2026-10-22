/** Closed data reader, not a Lua VM. No eval, dofile, loadstring, or arbitrary calls. */
export type LuaValue = string | number | boolean | LuaTable | undefined;
export interface LuaTable { [key: string]: LuaValue }
export interface Token { text: string; value?: string | number; offset: number }
export function tokenize(text: string, file: string): Token[] {
  const out: Token[] = []; let p=0;
  while(p<text.length) {
    if(/\s/.test(text[p])) {p++;continue;}
    const start=p;
    if(text.startsWith('--',p)) {
      p+=2; const block=/^\[(=*)\[/.exec(text.slice(p));
      if(block) {const end=text.indexOf(`]${block[1]}]`,p+block[0].length); if(end<0) throw Error(`${file}: unterminated comment`); p=end+block[0].length;}
      else {const end=text.indexOf('\n',p);p=end<0?text.length:end;}
      continue;
    }
    const long=/^\[(=*)\[/.exec(text.slice(p));
    if(long) {const end=text.indexOf(`]${long[1]}]`,p+long[0].length);if(end<0)throw Error(`${file}: unterminated string`);out.push({text:'string',value:text.slice(p+long[0].length,end),offset:start});p=end+long[0].length;continue;}
    if(text[p]==='"'||text[p]==="'") {
      const quote=text[p++];let value='';let closed=false;
      while(p<text.length) {let c=text[p++];if(c===quote){closed=true;break;}if(c==='\\') {c=text[p++];if(/[0-9]/.test(c)){let digits=c;while(digits.length<3&&/[0-9]/.test(text[p]??''))digits+=text[p++];value+=String.fromCharCode(Number(digits));continue;}const escapes:Record<string,string>={n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v',a:'\x07','\n':'\n'};value+=escapes[c]??c;}else value+=c;}
      if(!closed)throw Error(`${file}: unterminated string`);out.push({text:'string',value,offset:start});continue;
    }
    const number=/^(?:0x[0-9a-fA-F]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/.exec(text.slice(p));
    if(number) {out.push({text:'number',value:Number(number[0]),offset:start});p+=number[0].length;continue;}
    const word=/^[a-zA-Z_][a-zA-Z_0-9]*/.exec(text.slice(p));
    if(word) {out.push({text:word[0],offset:start});p+=word[0].length;continue;}
    const symbol=['...','==','~=','<=','>=','..'].find(s=>text.startsWith(s,p))??text[p];out.push({text:symbol,offset:start});p+=symbol.length;
  }
  return out;
}
export const isTable = (value: LuaValue): value is LuaTable => typeof value==='object'&&value!==null;
export const truthy=(v:LuaValue)=>v!==undefined&&v!==false;
export class LuaReader {
  p=0;
  constructor(readonly tokens:Token[],readonly file:string,readonly env:LuaTable={}) {}
  fail(operation=this.tokens[this.p]?.text??'EOF'): never {throw Error(`${this.file}:${this.tokens[this.p]?.offset??'EOF'}: unsupported or malformed operation ${operation}`);}
  peek() {return this.tokens[this.p]?.text;}
  take(expected?:string):Token {const token=this.tokens[this.p++];if(!token||(expected&&token.text!==expected))this.fail(`expected ${expected}, got ${token?.text}`);return token;}
  value(min=0):LuaValue {
    let v:LuaValue; const t=this.take();
    if(t.text==='number'||t.text==='string')v=t.value;
    else if(t.text==='l10n' && this.env.__allowEnglishL10n===true) {this.take('(');v=this.take('string').value;this.take(')');}
    else if(t.text==='nil')v=undefined;
    else if(t.text==='true'||t.text==='false')v=t.text==='true';
    else if(t.text==='-') {const n=this.value(5);if(typeof n!=='number')this.fail('unary -');v=-n;}
    else if(t.text==='('){v=this.value();this.take(')');}
    else if(t.text==='{') {
      const table:LuaTable={};let index=1;
      while(this.peek()!=='}') {
        let key:LuaValue,entry:LuaValue;
        if(this.peek()==='[') {this.take();key=this.value();this.take(']');this.take('=');entry=this.value();}
        else if(this.tokens[this.p+1]?.text==='=') {key=this.take().text;this.take('=');entry=this.value();}
        else {key=index++;entry=this.value();}
        if(typeof key!=='string'&&typeof key!=='number')this.fail('table key');
        if(['__proto__','constructor','prototype'].includes(String(key)))this.fail('unsafe table key');
        if(entry!==undefined)table[String(key)]=entry;else delete table[String(key)];
        if(this.peek()!=='}') {if(![',',';'].includes(this.peek()??''))this.fail();this.take();}
      }
      this.take('}');v=table;
    } else if(Object.hasOwn(this.env,t.text)) v=this.env[t.text];
    else this.fail(t.text);
    while(this.peek()==='.'||this.peek()==='[') {
      let key:LuaValue;if(this.peek()==='.') {this.take();key=this.take().text;}else{this.take();key=this.value();this.take(']');}
      if(!isTable(v)||(typeof key!=='string'&&typeof key!=='number'))this.fail('lookup');
      // Class-indexed literal lookup may deliberately yield nil; unknown named enum keys must fail.
      if(!Object.hasOwn(v,String(key))&&t.text!=='(')this.fail(`unknown symbol ${t.text}.${key}`);
      v=v[String(key)];
    }
    if(this.peek()==='('||this.peek()===':')this.fail(`call ${t.text}`);
    const priorities:Record<string,number>={or:1,and:2,'==':3,'~=':3,'+':4,'-':4};
    while((priorities[this.peek()??'']??0)>min) {
      const op=this.take().text;const rhs=this.value(priorities[op]);
      if(op==='or')v=truthy(v)?v:rhs;else if(op==='and')v=truthy(v)?rhs:v;
      else if(op==='==')v=v===rhs;else if(op==='~=')v=v!==rhs;
      else {if(typeof v!=='number'||typeof rhs!=='number')this.fail(op);v=op==='+'?v+rhs:v-rhs;if(!Number.isFinite(v))this.fail('non-finite arithmetic');}
    }
    return v;
  }
}
/** Marker selection is token-based: strings and comments cannot masquerade as assignments. */
export function readerAt(text:string,file:string,env:LuaTable,marker:string):LuaReader {
  const tokens=tokenize(text,file), pattern=tokenize(marker,file);
  const matches:number[]=[];
  for(let i=0;i<=tokens.length-pattern.length;i++)if(pattern.every((t,j)=>t.text===tokens[i+j].text&&(t.value===undefined||t.value===tokens[i+j].value)))matches.push(i+pattern.length);
  if(matches.length!==1)throw Error(`${file}: selector ${marker} has ${matches.length} matches`);
  const reader=new LuaReader(tokens,file,env);reader.p=matches[0];return reader;
}
export function readLuaValue(text:string,file:string,env:LuaTable={},marker?:string):LuaValue {
  const reader=marker?readerAt(text,file,env,marker):new LuaReader(tokenize(text,file),file,env);
  const value=reader.value();if(!marker&&reader.p!==reader.tokens.length)reader.fail();return value;
}
