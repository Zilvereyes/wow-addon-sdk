/** Approved graph tooling preflight and lexical paths. No filesystem or source execution. */
export const GRAPH_LIMITS=Object.freeze({sourceNodes:10000,analysisRecords:50000,referenceOccurrences:50000,
  occurrences:50000,graphDepth:256,directoryDepth:64,directoryEntries:100000,readBytes:1024*1024*1024,
  textCacheBytes:128*1024*1024,retainedRecords:1000000,retainedStringUnits:64*1024*1024,pathUnits:4096,
  operationMilliseconds:15*60*1000});
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fold=value=>value.replace(/[A-Z]/gu,character=>character.toLowerCase());
const tokenName=value=>typeof value==='string'&&value.length<=64&&/^\[[A-Za-z][A-Za-z0-9_]*\]$/u.test(value);
function scalar(value){
  for(let i=0;i<value.length;i++){
    const unit=value.charCodeAt(i);
    if(unit>=0xD800&&unit<=0xDBFF){const next=value.charCodeAt(++i);if(!(next>=0xDC00&&next<=0xDFFF))return false;}
    else if(unit>=0xDC00&&unit<=0xDFFF)return false;
  }
  return true;
}
function component(value){
  return typeof value==='string'&&value.length>0&&scalar(value)&&!/[\\/\u0000-\u001F<>:"|?*]/u.test(value)&&
    !/[. ]$/u.test(value)&&! /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/u.test(fold(value));
}
const replacement=value=>component(value)&&value.length<=255&&!/[$\[\]]/u.test(value);
const rooted=value=>/^[\\/]/u.test(value)||/^[A-Za-z]:/u.test(value);

/** Lookup components only; original spellings/source labels are retained by callers separately. */
export function normalizeGraphPath(input,base=[],options={}){
  const maximum=options.maximumUnits??GRAPH_LIMITS.pathUnits;
  if(typeof input!=='string'||!input||!Array.isArray(base))return{status:'blocked',reason:'invalid'};
  if(!Number.isSafeInteger(maximum)||maximum<1||input.length>maximum)return{status:'budget',reason:'path-units'};
  if(rooted(input))return{status:'blocked',reason:'rooted'};
  const allowDirectory=options.allowDirectory,baseLength=base.length;
  if(!Number.isSafeInteger(baseLength)||baseLength<0)return{status:'blocked',reason:'invalid'};
  if(baseLength>maximum)return{status:'budget',reason:'path-units'};
  if(!allowDirectory&&/[\\/]$/u.test(input))return{status:'blocked',reason:'directory'};
  const parts=[];
  for(let i=0;i<baseLength;i++){
    if(!Object.hasOwn(base,i))return{status:'blocked',reason:'invalid'};
    const part=base[i];
    if(!component(part))return{status:'blocked',reason:'invalid'};
    parts.push(part);
  }
  for(const part of input.split(/[\\/]/u)){
    if(part===''||part==='.')continue;
    if(part==='..'){if(!parts.length)return{status:'blocked',reason:'escape'};parts.pop();continue;}
    if(!component(part))return{status:'blocked',reason:'invalid'};
    parts.push(part);
  }
  if(!allowDirectory&&!parts.length)return{status:'blocked',reason:'directory'};
  if(parts.join('/').length>maximum)return{status:'budget',reason:'path-units'};
  return{status:'ready',components:parts};
}

/** Exact, nonrecursive caller tokens. Invalid/unknown variables never become file paths. */
export function expandGraphTarget(input,tokens,maximum=GRAPH_LIMITS.pathUnits){
  if(typeof input!=='string'||!Number.isSafeInteger(maximum)||maximum<1||input.length>maximum)return{status:'budget'};
  if(rooted(input))return{status:'blocked'};
  if(input.includes('$')||!Array.isArray(tokens))return{status:'unsupported'};
  const table=new Map();
  try{
    const length=tokens.length;
    if(!Number.isSafeInteger(length)||length<0||length>32)return{status:'unsupported'};
    for(let i=0;i<length;i++){
      if(!Object.hasOwn(tokens,i))return{status:'unsupported'};
      const row=tokens[i];if(!record(row))return{status:'unsupported'};
      const {token,replacement:value}=row;
      if(!tokenName(token)||!replacement(value)||table.has(token))return{status:'unsupported'};
      table.set(token,value);
    }
  }catch{return{status:'unsupported'};}
  let expandedTarget='';
  for(let cursor=0;cursor<input.length;){
    let part;
    if(input[cursor]===']')return{status:'unsupported'};
    if(input[cursor]==='['){
      const close=input.indexOf(']',cursor+1);if(close<0)return{status:'unsupported'};
      const token=input.slice(cursor,close+1);
      if(!tokenName(token)||!table.has(token))return{status:'unsupported'};
      part=table.get(token);cursor=close+1;
    }else{part=input[cursor];cursor++;}
    if(expandedTarget.length+part.length>maximum)return{status:'budget'};
    expandedTarget+=part;
  }
  return{status:'ready',expandedTarget};
}

class GraphProfileError extends Error{
  constructor(){super('Invalid selected-source graph profile.');this.code='SGRAPH0001';}
}
const requireValue=value=>{if(!value)throw new GraphProfileError();};
function fields(value,required,optional=[]){
  requireValue(record(value));
  const allowed=new Set([...required,...optional]);
  requireValue(Reflect.ownKeys(value).every(key=>allowed.has(key))&&required.every(key=>Object.hasOwn(value,key)));
  const copy=Object.create(null);
  for(const key of allowed)if(Object.hasOwn(value,key))copy[key]=value[key];
  return copy;
}
function cells(value,maximum,nonempty=false){
  requireValue(Array.isArray(value));const length=value.length;
  requireValue(Number.isSafeInteger(length)&&length<=maximum&&(!nonempty||length>0));
  const copy=[];
  for(let i=0;i<length;i++){requireValue(Object.hasOwn(value,i));copy.push(value[i]);}
  return copy;
}

/** Snapshot documented own fields once. Native getters remain caller code, never a sandbox. */
export function validateGraphProfile(input){
  try{
    const supplied=fields(input,['schemaVersion','id','pathPolicy','addons'],['limits']);
    requireValue(supplied.schemaVersion===1);
    let stringUnits=0;
    const text=(value,maximum=1024*1024)=>{
      requireValue(typeof value==='string'&&value.length>0&&value.length<=maximum);
      stringUnits+=value.length;requireValue(stringUnits<=1024*1024);return value;
    };
    const id=text(supplied.id);
    const rawPath=fields(supplied.pathPolicy,['separators','caseComparison','containment','links','variables']);
    const separators=text(rawPath.separators),caseComparison=text(rawPath.caseComparison),containment=text(rawPath.containment),links=text(rawPath.links);
    requireValue(separators==='slash-and-backslash'&&['exact','ascii-insensitive-unique'].includes(caseComparison)&&containment==='addons-root'&&links==='reject');
    const variables=fields(rawPath.variables,['kind','tokens']);requireValue(text(variables.kind)==='explicit-tokens');
    const seenTokens=new Set();
    const tokens=cells(variables.tokens,32).map(value=>{
      const row=fields(value,['token','replacement']),token=text(row.token,64),valueText=text(row.replacement,255);
      requireValue(tokenName(token)&&replacement(valueText)&&!seenTokens.has(token));seenTokens.add(token);
      return{token,replacement:valueText};
    });
    const limits={...GRAPH_LIMITS};
    if(Object.hasOwn(supplied,'limits')){
      const rawLimits=fields(supplied.limits,[],Object.keys(GRAPH_LIMITS));
      for(const key of Object.keys(rawLimits)){
        const value=rawLimits[key];requireValue(Number.isSafeInteger(value)&&value>0&&value<=GRAPH_LIMITS[key]);limits[key]=value;
      }
    }
    const seenIds=new Set();let candidateRows=0;
    const addons=cells(supplied.addons,1024,true).map(value=>{
      const row=fields(value,['logicalAddonId','directory','addonBaseName','tocPaths']);
      const logicalAddonId=text(row.logicalAddonId),directory=text(row.directory,limits.pathUnits),addonBaseName=text(row.addonBaseName);
      requireValue(!seenIds.has(logicalAddonId)&&component(addonBaseName));seenIds.add(logicalAddonId);
      const base=normalizeGraphPath(directory,[],{allowDirectory:true,maximumUnits:limits.pathUnits});requireValue(base.status==='ready');
      const tocPaths=cells(row.tocPaths,128,true).map(value=>{
        const tocPath=text(value,limits.pathUnits),normalized=normalizeGraphPath(tocPath,[],{maximumUnits:limits.pathUnits});
        requireValue(normalized.status==='ready'&&fold(normalized.components.at(-1)).endsWith('.toc'));
        const compare=caseComparison==='exact'?value=>value:fold;
        requireValue(base.components.every((part,index)=>normalized.components[index]!==undefined&&compare(part)===compare(normalized.components[index]))&&normalized.components.length>base.components.length);
        requireValue(++candidateRows<=10000);return tocPath;
      });
      return{logicalAddonId,directory,addonBaseName,tocPaths};
    });
    return{profile:{schemaVersion:1,id,pathPolicy:{separators,caseComparison,containment,links,
      variables:{kind:'explicit-tokens',tokens}},addons,limits},stringUnits};
  }catch{throw new GraphProfileError();}
}
