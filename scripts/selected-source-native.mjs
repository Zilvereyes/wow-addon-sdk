/** Stable-installation read-only file port. Not atomic hostile-filesystem containment or an analysis engine. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {getGraphRequest} from './selected-source-context.mjs';
import {normalizeGraphPath} from './selected-source-profile.mjs';
import {readBoundedFile} from './read-bounded-file.mjs';
import {createWindowsPathInspector} from './selected-source-windows.mjs';
import {requireGraphBudget} from './selected-source-budget.mjs';

const fail=kind=>{throw Object.assign(Error('graph-native-'+kind),{code:'graph-native-'+kind});};
const fold=value=>value.replace(/[A-Z]/gu,c=>c.toLowerCase());
const identity=s=>[s.dev,s.ino,s.isDirectory(),s.isFile()].map(String).join(':');
const stamp=s=>[identity(s),s.size,s.mtimeNs,s.ctimeNs].map(String).join(':');
const hash=value=>createHash('sha256').update(value).digest('hex');

/** io/clock/inspectorFactory are trusted test ports, never profile or CLI fields. */
export async function createGraphFileHost(rootInput,context,{io=fs,now=()=>performance.now(),inspectorFactory=process.platform==='win32'?createWindowsPathInspector:null,budget=null,transientHandoffs=false}={}){
  const request=getGraphRequest(context),limits=request.profile.limits;
  if(budget)requireGraphBudget(budget,context);
  const shared=run=>{try{return run();}catch{fail('budget');}};
  if(typeof rootInput!=='string'||!path.isAbsolute(rootInput)||/^(?:[\\/]{2}|[A-Za-z]+:\/\/)/u.test(rootInput)||
    (process.platform==='win32'&&!/^[A-Za-z]:[\\/]/u.test(rootInput))||rootInput.includes('\0'))fail('root');
  const root=path.resolve(rootInput),started=now(),inspector=inspectorFactory?inspectorFactory():null;
  const directories=new Map(),sources=new Map(),invalidDirectories=new Set(),invalidSources=new Set(),ancestors=[];
  const handoffs=transientHandoffs?new WeakMap():null;
  let closed=false,busy=false,canonicalRoot,entriesSeen=0,records=0,stringUnits=0,chargedReadBytes=0,consumedReadBytes=0;
  function check(){if(closed)fail('closed');if(budget)shared(()=>budget.check());if(now()-started>=limits.operationMilliseconds)fail('budget');}
  const remaining=()=>budget?shared(()=>budget.remaining()):limits.operationMilliseconds-(now()-started);
  function retain(count,units){
    check();if(records+count>limits.retainedRecords||stringUnits+units>limits.retainedStringUnits)fail('budget');
    if(budget)shared(()=>budget.retain(count,units));
    records+=count;stringUnits+=units;
  }
  function release(count,units){
    if(budget){budget.release('retainedRecords',count);budget.release('retainedStringUnits',units);}
    records-=count;stringUnits-=units;
  }
  function releaseSince(initialRecords,initialUnits){release(records-initialRecords,stringUnits-initialUnits);}
  function issue(makeResult,count,units,track){
    const registry=track?handoffs:null;
    const charged=count+(registry?2:0); // The weak registration and its charge record.
    retain(charged,units);
    try{
      const result=makeResult();
      if(registry)registry.set(result,{count:charged,units});
      return result;
    }catch(error){release(charged,units);throw error;}
  }
  function releaseHandoff(result){
    const charge=handoffs?.get(result);
    if(!charge)return;
    // Preserve the ownership deltas of an in-flight native operation.
    if(busy)fail('busy');
    handoffs.delete(result);
    release(charge.count,charge.units);
  }
  async function statChecked(absolute,previous){
    check();const stat=io.lstatSync(absolute,{bigint:true});if(stat.isSymbolicLink())fail('link');
    if(inspector&&(previous===undefined||stamp(previous)!==stamp(stat))){
      let row;
      try{[row]=await inspector.inspect([absolute],remaining());}catch{check();fail('attributes');}
      if(!row.ok)fail('attributes');if(row.reparsePoint)fail('link');
    }
    check();return stat;
  }
  function inside(absolute){
    const relative=path.relative(canonicalRoot,io.realpathSync(absolute));
    if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))fail('containment');
  }
  async function rootCheck(){
    check();let stat;
    for(const row of ancestors){
      stat=await statChecked(row.absolute);
      if(identity(stat)!==row.identity)fail('changed');
    }
    if(io.realpathSync(root)!==canonicalRoot)fail('changed');
    return stat;
  }
  async function verifyCached(key,recentRoot){
    if(invalidDirectories.has(key))fail('changed');
    const snapshot=directories.get(key);if(!snapshot)return;
    // Reuse only the immediately preceding root attribute observation. Always
    // take a new lstat, and inspect again when any part of its stamp differs.
    const absolute=path.join(root,key),stat=await statChecked(absolute,key===''?recentRoot:undefined);inside(absolute);
    if(stamp(stat)!==snapshot.stamp){invalidDirectories.add(key);fail('changed');}
  }
  async function scan(key){
    const initialRecords=records,initialUnits=stringUnits;
    try{
    const absolute=path.join(root,key),before=await statChecked(absolute);if(!before.isDirectory())fail('directory');inside(absolute);
    retain(2,0); // Snapshot and entry-array containers, including empty directories.
    const entries=[],dir=io.opendirSync(absolute,{encoding:'buffer',bufferSize:1});
    try{
      for(let row;(row=dir.readSync())!==null;){
        check();if(entriesSeen+1>limits.directoryEntries)fail('budget');
        if(budget)shared(()=>budget.use('directoryEntries',1));entriesSeen++;
        let name;try{name=new TextDecoder('utf-8',{fatal:true}).decode(row.name);}catch{fail('encoding');}
        const scalar=normalizeGraphPath(name,[],{maximumUnits:limits.pathUnits});
        const kind=row.isSymbolicLink()?'link':row.isDirectory()?'directory':row.isFile()?'file':'unsupported';
        retain(1,name.length);entries.push({name,kind:scalar.status==='ready'&&scalar.components.length===1?kind:'unsupported',reparsePoint:kind==='link'});
      }
    }finally{dir.closeSync();}
    if(inspector)for(let i=0;i<entries.length;i+=128){
      const batch=entries.slice(i,i+128);let rows;
      try{rows=await inspector.inspect(batch.map(row=>path.join(absolute,row.name)),remaining());}
      catch{check();fail('attributes');}
      for(let j=0;j<rows.length;j++){
        if(!rows[j].ok)fail('changed');
        if(rows[j].reparsePoint){batch[j].reparsePoint=true;batch[j].kind='link';}
      }
    }
    const after=await statChecked(absolute);inside(absolute);if(stamp(before)!==stamp(after))fail('changed');
    entries.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
    const snapshot={stamp:stamp(after),entries,fingerprint:hash(JSON.stringify([stamp(after),entries]))};
    retain(0,snapshot.stamp.length+snapshot.fingerprint.length);
    return snapshot;
    }catch(error){releaseSince(initialRecords,initialUnits);throw error;}
  }
  async function listing(key,recentRoot){
    await verifyCached(key,recentRoot);
    if(!directories.has(key)){
      const initialRecords=records,initialUnits=stringUnits;
      try{const snapshot=await scan(key);retain(1,key.length);directories.set(key,snapshot);}
      catch(error){releaseSince(initialRecords,initialUnits);throw error;}
    }
    return directories.get(key);
  }
  async function resolve(relative,directory=false){
    const recentRoot=await rootCheck();
    const normalized=directory&&relative===''?{status:'ready',components:[]}:
      normalizeGraphPath(relative,[],{maximumUnits:limits.pathUnits,allowDirectory:directory});
    if(normalized.status!=='ready')return{status:normalized.status==='budget'?'budget':'blocked'};
    if(normalized.components.length-(directory?0:1)>limits.directoryDepth)fail('budget');
    const actual=[],visited=[];
    for(let index=0;index<normalized.components.length;index++){
      const key=actual.join(path.sep),snapshot=await listing(key,index===0?recentRoot:undefined);visited.push(key);
      const wanted=normalized.components[index],equivalent=snapshot.entries.filter(row=>fold(row.name)===fold(wanted));
      if(equivalent.length>1)return{status:'ambiguous'};
      const match=equivalent[0];if(!match||(request.profile.pathPolicy.caseComparison==='exact'&&match.name!==wanted))return{status:'missing'};
      if(match.kind==='link'||match.reparsePoint)return{status:'blocked'};
      if(match.kind==='unsupported')return{status:'unsupported'};
      const last=index===normalized.components.length-1;
      if(match.kind!==((last&&!directory)?'file':'directory'))return{status:'blocked'};
      actual.push(match.name);const absolute=path.join(root,...actual),stat=await statChecked(absolute);inside(absolute);
      if((last&&!directory)?!stat.isFile():!stat.isDirectory())fail('changed');
    }
    return{status:'ready',sourcePath:actual.join(path.sep),visited};
  }
  async function read(sourcePath,maximumBytes,track=false){
    const extension=path.extname(sourcePath).toLowerCase();
    const cap=extension==='.toc'?8*1024*1024:extension==='.xml'?4*1024*1024:
      extension==='.lua'?(request.luaInputProfile==='corpus-files'?128:4)*1024*1024:0;
    if(!Number.isSafeInteger(maximumBytes)||maximumBytes<1||maximumBytes>cap)fail('input');
    if(invalidSources.has(sourcePath))fail('changed');
    const resolved=await resolve(sourcePath);
    if(resolved.status!=='ready'||resolved.sourcePath!==sourcePath)fail(resolved.status==='ready'?'identity':resolved.status);
    const absolute=path.join(root,sourcePath),before=await statChecked(absolute);inside(absolute);
    if(before.size<0n||before.size>BigInt(maximumBytes))fail('input');
    const bound=Math.min(maximumBytes,Math.max(1,Number(before.size))),reservation=bound+1;
    if(chargedReadBytes+reservation>limits.readBytes)fail('budget');
    if(budget)shared(()=>budget.use('readBytes',reservation));chargedReadBytes+=reservation;
    let consumed=0;
    const observed={...io,readSync(...args){
      const count=io.readSync(...args);if(!Number.isSafeInteger(count)||count<0||count>args[3])fail('read');
      consumed+=count;consumedReadBytes+=count;return count;
    }};
    let bytes;
    try{
      bytes=readBoundedFile(absolute,bound,{io:observed});
      if(stamp(before)!==stamp(await statChecked(absolute)))fail('changed');inside(absolute);
      const recentRoot=await rootCheck();
      for(const key of resolved.visited)await verifyCached(key,recentRoot);
      const fingerprint=hash(stamp(before)+':'+hash(bytes));
      if(sources.has(sourcePath)&&sources.get(sourcePath)!==fingerprint){invalidSources.add(sourcePath);fail('changed');}
      if(!sources.has(sourcePath)){retain(1,sourcePath.length+fingerprint.length);sources.set(sourcePath,fingerprint);}
      const result=issue(()=>({bytes,fingerprint}),2,fingerprint.length,track);
      // Refund only verified returned I/O counts. A failed/unknown read retains its full reservation.
      chargedReadBytes-=reservation-consumed;
      if(budget)budget.release('readBytes',reservation-consumed);
      return result;
    }catch(error){
      if(error?.code?.startsWith('graph-native-'))throw error;
      fail(error?.code==='bounded-read-changed'?'changed':'read');
    }
  }
  async function exclusive(run){
    if(busy)fail('busy');busy=true;
    try{check();return await run();}catch(error){
      if(typeof error?.code==='string'&&error.code.startsWith('graph-native-'))throw error;
      fail('io');
    }finally{busy=false;}
  }
  try{
    const anchor=path.parse(root).root;let absolute=anchor;
    for(const part of ['',...root.slice(anchor.length).split(path.sep).filter(Boolean)]){
      if(part)absolute=path.join(absolute,part);
      const stat=await statChecked(absolute);if(!stat.isDirectory())fail('root');
      retain(1,absolute.length+identity(stat).length);
      ancestors.push({absolute,identity:identity(stat)});
    }
    canonicalRoot=io.realpathSync(root);
  }catch(error){await inspector?.close();if(error?.code?.startsWith('graph-native-'))throw error;fail('root');}
  return{
    resolvePath:async(relative,options={})=>{
      try{return await exclusive(async()=>{
        const r=await resolve(relative,options.directory===true);return r.status==='ready'?{status:r.status,sourcePath:r.sourcePath}:{status:r.status};
      });}catch(error){return{status:error?.code==='graph-native-budget'?'budget':'blocked'};}
    },
    listDirectory:sourceDirectory=>exclusive(async()=>{
      const r=await resolve(sourceDirectory,true);if(r.status!=='ready')fail(r.status);
      const s=await listing(r.sourcePath);
      return issue(()=>({fingerprint:s.fingerprint,entries:s.entries.map(row=>({...row}))}),
        s.entries.length+2,s.fingerprint.length+s.entries.reduce((sum,row)=>sum+row.name.length,0),true);
    }),
    verifyDirectory:(sourceDirectory,fingerprint)=>exclusive(async()=>{
      if(!directories.has(sourceDirectory)||directories.get(sourceDirectory).fingerprint!==fingerprint)return false;
      const initialRecords=records,initialUnits=stringUnits;
      try{
        const r=await resolve(sourceDirectory,true);if(r.status==='budget')fail('budget');if(r.status!=='ready')return false;
        const actual=await scan(r.sourcePath),valid=actual.fingerprint===fingerprint;
        if(!valid)invalidDirectories.add(r.sourcePath);return valid;
      }catch(error){invalidDirectories.add(sourceDirectory);if(error?.code==='graph-native-budget')throw error;return false;}
      finally{releaseSince(initialRecords,initialUnits);} // The issued cache already exists; fresh verification owns no persistent result.
    }),
    readSource:(sourcePath,maximumBytes)=>exclusive(()=>read(sourcePath,maximumBytes,true)),
    verifySource:(sourcePath,fingerprint,maximumBytes)=>exclusive(async()=>{
      if(!sources.has(sourcePath)||sources.get(sourcePath)!==fingerprint)return false;
      const initialRecords=records,initialUnits=stringUnits;
      try{const current=await read(sourcePath,maximumBytes),valid=current.fingerprint===fingerprint;
        if(!valid)invalidSources.add(sourcePath);return valid;
      }catch(error){invalidSources.add(sourcePath);if(error?.code==='graph-native-budget')throw error;return false;}
      finally{releaseSince(initialRecords,initialUnits);} // A boolean verification never hands off its temporary buffer/fingerprint.
    }),
    ...(handoffs?{releaseHandoff}:{}),
    metrics:()=>({directoryEntries:entriesSeen,chargedReadBytes,consumedReadBytes,retainedRecords:records,retainedStringUnits:stringUnits}),
    async close(){closed=true;await inspector?.close();},
  };
}
