/** Fixed stock-PowerShell read-only attribute transport. Not configurable by profile/CLI data. */
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';

const helper=fileURLToPath(new URL('./Inspect-SelectedSourcePath.ps1',import.meta.url));
const cap=1024*1024;
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
export function createWindowsPathInspector({spawnProcess=spawn,timeoutMs=10000,now=()=>performance.now()}={}){
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw Error('graph-attributes-input');
  const executable=path.win32.join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  if(!/^[A-Za-z]:\\/u.test(executable))throw Error('graph-attributes-runtime');
  let active=null,closed=false,sequence=0,restarting=false;
  const children=new Set();
  function invalidate(state,code){
    if(active===state)active=null;
    const pending=state.pending;state.pending=null;
    if(pending){clearTimeout(pending.timer);pending.reject(Error(code));}
    if(state.child.exitCode===null&&state.child.signalCode===null)state.child.kill('SIGKILL');
  }
  function start(){
    const registration=JSON.parse(fs.readFileSync(new URL('../docs/workbench/selected-source-path.registration.json',import.meta.url),'utf8'));
    if(createHash('sha256').update(fs.readFileSync(helper)).digest('hex')!==registration.sha256)throw Error('graph-attributes-source');
    const child=spawnProcess(executable,['-NoLogo','-NoProfile','-NonInteractive','-File',helper],
      {stdio:['pipe','pipe','pipe'],shell:false,windowsHide:true});
    const state={child,pending:null,buffer:Buffer.alloc(0),bytes:0,done:null};children.add(state);
    state.done=new Promise(resolve=>child.once('close',()=>{children.delete(state);resolve();}));
    child.stderr.resume();
    child.stdout.on('data',chunk=>{
      if(active!==state)return;
      if(state.pending&&now()>=state.pending.deadline){invalidate(state,'graph-attributes-timeout');return;}
      state.bytes+=chunk.length;
      if(state.bytes>cap){invalidate(state,'graph-attributes-output-limit');return;}
      state.buffer=Buffer.concat([state.buffer,chunk]);
      const end=state.buffer.indexOf(10);if(end<0)return;
      if(!state.pending||end!==state.buffer.length-1){invalidate(state,'graph-attributes-protocol');return;}
      let response;
      try{response=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(state.buffer.subarray(0,end)));}
      catch{invalidate(state,'graph-attributes-protocol');return;}
      if(!exact(response,['id','rows'])||response.id!==state.pending.id||!Array.isArray(response.rows)||
        response.rows.length!==state.pending.rows||!response.rows.every(row=>exact(row,['ok','reparsePoint'])&&
          typeof row.ok==='boolean'&&typeof row.reparsePoint==='boolean')){
        invalidate(state,'graph-attributes-protocol');return;
      }
      const pending=state.pending;state.pending=null;state.buffer=Buffer.alloc(0);state.bytes=0;
      clearTimeout(pending.timer);pending.resolve(response.rows);
    });
    child.on('error',()=>invalidate(state,'graph-attributes-start'));
    child.stdin.on('error',()=>invalidate(state,'graph-attributes-write'));
    child.on('exit',()=>invalidate(state,'graph-attributes-exit'));
    return state;
  }
  return{
    inspect:async function inspect(paths,remainingMilliseconds=10000){
      if(closed)throw Error('graph-attributes-closed');
      if(restarting||active?.pending)throw Error('graph-attributes-busy');
      let owned=[];
      try{
        if(!Array.isArray(paths))throw Error();const length=paths.length;
        if(!Number.isSafeInteger(length)||length<1||length>128)throw Error();
        for(let i=0;i<length;i++){
          if(!Object.hasOwn(paths,i))throw Error();const value=paths[i];
          if(typeof value!=='string'||value.length>32767)throw Error();owned.push(value);
        }
      }catch{throw Error('graph-attributes-input');}
      if(!Number.isFinite(remainingMilliseconds)||remainingMilliseconds<=0)throw Error('graph-attributes-timeout');
      const deadline=now()+Math.min(timeoutMs,remainingMilliseconds);
      const id=++sequence,payload=JSON.stringify({id,paths:owned})+'\n';
      if(Buffer.byteLength(payload)>cap)throw Error('graph-attributes-input');
      if(!active&&children.size){
        restarting=true;let timer;
        try{await Promise.race([Promise.all([...children].map(state=>state.done)),new Promise((_,reject)=>{
          timer=setTimeout(()=>reject(Error('graph-attributes-timeout')),Math.max(0,deadline-now()));
        })]);}finally{clearTimeout(timer);restarting=false;}
      }
      if(closed)throw Error('graph-attributes-closed');
      if(deadline-now()<=0)throw Error('graph-attributes-timeout');
      try{active??=start();}catch{throw Error('graph-attributes-start');}
      const state=active;
      const remaining=deadline-now();
      if(remaining<=0){invalidate(state,'graph-attributes-timeout');throw Error('graph-attributes-timeout');}
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>invalidate(state,'graph-attributes-timeout'),remaining);
        state.pending={id,rows:owned.length,timer,resolve,reject,deadline};
        try{state.child.stdin.write(payload,issue=>{if(issue)invalidate(state,'graph-attributes-write');});}
        catch{invalidate(state,'graph-attributes-write');}
      });
    },
    async close(){
      closed=true;const states=[...children];
      for(const state of states)invalidate(state,'graph-attributes-closed');
      let timer;
      try{await Promise.race([Promise.all(states.map(state=>state.done)),new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(Error('graph-attributes-reap')),timeoutMs);
      })]);}finally{clearTimeout(timer);}
    },
  };
}
