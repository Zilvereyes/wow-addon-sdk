import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createWindowsPathInspector} from '../scripts/selected-source-windows.mjs';

function fake(answer,{automaticClose=true}={}){
  const launches=[],children=[];
  const spawnProcess=(executable,args,options)=>{
    launches.push({executable,args,options});
    const child=new EventEmitter();children.push(child);
    child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();
    child.exitCode=null;child.signalCode=null;
    child.kill=()=>{if(automaticClose)queueMicrotask(()=>{child.signalCode='SIGKILL';child.emit('close');});return true;};
    child.stdin.on('data',data=>answer(child,JSON.parse(data.toString())));
    return child;
  };
  return{spawnProcess,launches,children};
}
const reply=(child,request)=>child.stdout.write(JSON.stringify({id:request.id,rows:request.paths.map(()=>({ok:true,reparsePoint:false}))})+'\n');

test('fixed Windows helper uses literal argv, exact correlation and one owned request at a time',async()=>{
  const f=fake(reply),inspector=createWindowsPathInspector({spawnProcess:f.spawnProcess});
  try{
    assert.deepEqual(await inspector.inspect(['C:\\Authored\\literal$(x).lua']),[{ok:true,reparsePoint:false}]);
    assert.deepEqual(await inspector.inspect(['C:\\Authored\\other.lua']),[{ok:true,reparsePoint:false}]);
    assert.equal(f.launches.length,1);const launch=f.launches[0];
    assert.ok(path.win32.isAbsolute(launch.executable));assert.ok(launch.executable.endsWith('\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'));
    assert.ok(launch.args.includes('-NoProfile')&&launch.args.includes('-NonInteractive'));
    assert.equal(launch.args.some(v=>/bypass|executionpolicy/iu.test(v)),false);
    assert.equal(launch.options.shell,false);assert.equal(launch.options.windowsHide,true);
    assert.equal(launch.args.at(-1),path.resolve('scripts/Inspect-SelectedSourcePath.ps1'));
  }finally{await inspector.close();}
});

test('malformed/corrupt/oversized helper output fails closed and replacement waits for close',async()=>{
  for(const answer of [(c,r)=>c.stdout.write(JSON.stringify({id:r.id+1,rows:[]})+'\n'),
    (c,r)=>c.stdout.write(JSON.stringify({id:r.id,rows:[{ok:true,reparsePoint:'false'}]})+'\n'),
    c=>c.stdout.write(Buffer.from([0xFF,10])),c=>c.stdout.write('x'.repeat(1024*1024+1))]){
    const f=fake(answer),i=createWindowsPathInspector({spawnProcess:f.spawnProcess});
    try{await assert.rejects(i.inspect(['C:\\Fixture']),/graph-attributes-(protocol|output-limit)/u);}finally{await i.close();}
  }
  const f=fake((c,r)=>{if(f.children.length===1)c.stdout.write('{}\n');else reply(c,r);},{automaticClose:false});
  const i=createWindowsPathInspector({spawnProcess:f.spawnProcess});
  await assert.rejects(i.inspect(['C:\\Fixture']),/graph-attributes-protocol/u);
  const replacement=i.inspect(['C:\\Fixture']);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.launches.length,1);f.children[0].emit('close');await replacement;
  const closing=i.close();f.children[1].emit('close');await closing;
});

test('helper input bounds, overlapping requests, deadlines and closure are explicit failures',async()=>{
  const f=fake(()=>{}),i=createWindowsPathInspector({spawnProcess:f.spawnProcess,timeoutMs:30});
  for(const paths of [[],Array(129).fill('C:\\Fixture'),['x'.repeat(1048577)]])await assert.rejects(i.inspect(paths),/graph-attributes-input/u);
  assert.equal(f.launches.length,0);
  const pending=i.inspect(['C:\\Fixture']);await assert.rejects(i.inspect(['C:\\Fixture']),/graph-attributes-busy/u);
  await assert.rejects(pending,/graph-attributes-timeout/u);await i.close();
  await assert.rejects(i.inspect(['C:\\Fixture']),/graph-attributes-closed/u);
});

test('replacement consumes the original monotonic deadline before any new helper is launched',async()=>{
  let now=0;const f=fake((child,request)=>{if(f.children.length===1)child.stdout.write('{}\n');else reply(child,request);},{automaticClose:false});
  const i=createWindowsPathInspector({spawnProcess:f.spawnProcess,timeoutMs:1000,now:()=>now});
  await assert.rejects(i.inspect(['C:\\Fixture']),/graph-attributes-protocol/u);
  const replacement=i.inspect(['C:\\Fixture']);now=1001;f.children[0].emit('close');
  try{await assert.rejects(replacement,/graph-attributes-timeout/u);assert.equal(f.launches.length,1);}
  finally{const closing=i.close();for(const child of f.children)child.emit('close');await closing;}
});

test('an unreaped helper yields a bounded timeout without launching a duplicate',async()=>{
  const f=fake(child=>child.stdout.write('{}\n'),{automaticClose:false});
  const i=createWindowsPathInspector({spawnProcess:f.spawnProcess,timeoutMs:25});
  await assert.rejects(i.inspect(['C:\\Fixture']),/graph-attributes-protocol/u);
  const replacement=i.inspect(['C:\\Fixture']);
  try{
    const result=await Promise.race([replacement.then(()=> 'opened',error=>error.message),new Promise(resolve=>setTimeout(()=>resolve('still-pending'),100))]);
    assert.equal(result,'graph-attributes-timeout');assert.equal(f.launches.length,1);
  }finally{for(const child of f.children)child.emit('close');await Promise.allSettled([replacement]);await i.close();}
});

test('close reports unreaped ownership within its bound and still waits for actual acknowledgement',async()=>{
  const f=fake(child=>child.stdout.write('{}\n'),{automaticClose:false});
  const i=createWindowsPathInspector({spawnProcess:f.spawnProcess,timeoutMs:25});
  await assert.rejects(i.inspect(['C:\\Fixture']),/graph-attributes-protocol/u);
  const closing=i.close();
  try{assert.equal(await Promise.race([closing.then(()=> 'closed',e=>e.message),new Promise(resolve=>setTimeout(()=>resolve('still-closing'),100))]),'graph-attributes-reap');}
  finally{for(const child of f.children)child.emit('close');await Promise.allSettled([closing]);await i.close();}
});

test('helper startup, exit, write errors and trailing frames produce fixed errors',async()=>{
  const starting=createWindowsPathInspector({spawnProcess(){throw Error('private startup path');}});
  await assert.rejects(starting.inspect(['C:\\Fixture']),error=>error.message==='graph-attributes-start');await starting.close();
  for(const [answer,expected] of [[child=>queueMicrotask(()=>child.emit('exit')),'graph-attributes-exit'],
    [child=>queueMicrotask(()=>child.stdin.emit('error',Error('private write path'))),'graph-attributes-write'],
    [(child,r)=>child.stdout.write(JSON.stringify({id:r.id,rows:[{ok:true,reparsePoint:false}]})+'\nextra\n'),'graph-attributes-protocol']]){
    const f=fake(answer),i=createWindowsPathInspector({spawnProcess:f.spawnProcess});
    try{await assert.rejects(i.inspect(['C:\\Fixture']),error=>error.message===expected);}finally{await i.close();}
  }
});

for(const pipe of ['stdout','stderr']){
  test('helper '+pipe+' errors reject the inspection and wait for close before replacement',async()=>{
    const f=fake((child,request)=>{if(f.children.length>1)reply(child,request);},{automaticClose:false});
    const inspector=createWindowsPathInspector({spawnProcess:f.spawnProcess});
    const paths=['C:\\Fixture'];
    try{
      const pending=inspector.inspect(paths);
      pending.catch(()=>{});
      assert.doesNotThrow(()=>f.children[0][pipe].emit('error',Error('Private pipe error')));
      await assert.rejects(pending,{message:'graph-attributes-exit'});
      const replacement=inspector.inspect(paths);
      await new Promise(resolve=>setImmediate(resolve));
      assert.equal(f.launches.length,1);
      f.children[0].emit('close');
      assert.deepEqual(await replacement,[{ok:true,reparsePoint:false}]);
      assert.equal(f.launches.length,2);
    }finally{
      const closing=inspector.close();
      for(const child of f.children)child.emit('close');
      await closing;
    }
  });
}

test('expired synchronous startup and late correlated responses never gain attribute credit',async()=>{
  for(const phase of ['startup','response']){
    let now=0;const f=fake((child,request)=>{if(phase==='response')now=101;reply(child,request);});
    const spawnProcess=(...args)=>{const child=f.spawnProcess(...args);if(phase==='startup')now=101;return child;};
    const i=createWindowsPathInspector({spawnProcess,timeoutMs:100,now:()=>now});
    try{await assert.rejects(i.inspect(['C:\\Fixture']),/graph-attributes-timeout/u);}finally{await i.close();}
  }
  const f=fake(reply),control=createWindowsPathInspector({spawnProcess:f.spawnProcess,timeoutMs:100,now:()=>0});
  try{assert.deepEqual(await control.inspect(['C:\\Fixture']),[{ok:true,reparsePoint:false}]);}finally{await control.close();}
});

test('approved thirty-second inspect cap is exact and the remaining operation budget still clamps it',async()=>{
  assert.throws(()=>createWindowsPathInspector({timeoutMs:30001}),/graph-attributes-input/u);
  for(const [remaining,arrives,accepted] of [[30000,29999,true],[30000,30000,false],[12000,11999,true],[12000,12000,false]]){
    let now=0,next=0;const timers=new Map(),scheduled=[];
    const setTimer=(fn,ms)=>{scheduled.push(ms);timers.set(++next,fn);return next;},clearTimer=id=>timers.delete(id);
    const f=fake((child,request)=>{now=arrives;reply(child,request);});
    const i=createWindowsPathInspector({spawnProcess:f.spawnProcess,now:()=>now,setTimer,clearTimer});
    try{
      const result=i.inspect(['C:\\Fixture'],remaining);
      if(accepted)assert.deepEqual(await result,[{ok:true,reparsePoint:false}]);
      else await assert.rejects(result,/graph-attributes-timeout/u);
      assert.equal(scheduled[0],remaining);assert.equal(timers.size,0);
    }finally{await i.close();}
  }
});

test('thirty-second requests keep a separate ten-second bounded reap with no replacement',async()=>{
  let next=0;const timers=new Map(),scheduled=[];
  const setTimer=(fn,ms)=>{scheduled.push(ms);timers.set(++next,{fn,ms});return next;},clearTimer=id=>timers.delete(id);
  const f=fake(child=>child.stdout.write('{}\n'),{automaticClose:false});
  const i=createWindowsPathInspector({spawnProcess:f.spawnProcess,now:()=>0,setTimer,clearTimer});
  await assert.rejects(i.inspect(['C:\\Fixture']),/graph-attributes-protocol/u);
  assert.equal(scheduled[0],30000);
  const closing=i.close();
  assert.deepEqual([...timers.values()].map(value=>value.ms),[10000]);
  [...timers.values()][0].fn();
  try{await assert.rejects(closing,/graph-attributes-reap/u);assert.equal(f.launches.length,1);}
  finally{for(const child of f.children)child.emit('close');await i.close();}
});

test('replacement reaping also has a separate ten-second cap and preserves the remaining inspect budget',async()=>{
  for(const timely of [false,true]){
    let now=0,next=0;const timers=new Map(),scheduled=[];
    const setTimer=(fn,ms)=>{scheduled.push(ms);timers.set(++next,{fn,ms});return next;},clearTimer=id=>timers.delete(id);
    const f=fake((child,request)=>{if(f.children.length===1)child.stdout.write('{}\n');else{now=29999;reply(child,request);}},{automaticClose:false});
    const i=createWindowsPathInspector({spawnProcess:f.spawnProcess,now:()=>now,setTimer,clearTimer});
    await assert.rejects(i.inspect(['C:\\Fixture']),/graph-attributes-protocol/u);
    const replacement=i.inspect(['C:\\Fixture']);
    try{
      assert.deepEqual([...timers.values()].map(value=>value.ms),[10000]);
      if(timely){
        now=9000;f.children[0].emit('close');
        assert.deepEqual(await replacement,[{ok:true,reparsePoint:false}]);
        assert.equal(f.launches.length,2);assert.equal(scheduled.at(-1),21000);
      }else{
        [...timers.values()][0].fn();await assert.rejects(replacement,/graph-attributes-reap/u);
        assert.equal(f.launches.length,1);
      }
    }finally{
      for(const child of f.children)child.emit('close');await Promise.allSettled([replacement]);
      const closing=i.close();for(const child of f.children)child.emit('close');await closing;
    }
  }
});

test('late close acknowledgements cannot beat an overdue independent reap timer',async()=>{
  for(const phase of ['replacement','close']){
    let now=0,next=0;const timers=new Map();
    const setTimer=(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimer=id=>timers.delete(id);
    const f=fake((child,request)=>{if(f.children.length===1)child.stdout.write('{}\n');else reply(child,request);},{automaticClose:false});
    const i=createWindowsPathInspector({spawnProcess:f.spawnProcess,now:()=>now,setTimer,clearTimer});
    await assert.rejects(i.inspect(['C:\\Fixture']),/graph-attributes-protocol/u);
    const pending=phase==='replacement'?i.inspect(['C:\\Fixture']):i.close();
    now=11000;f.children[0].emit('close');
    try{await assert.rejects(pending,/graph-attributes-reap/u);assert.equal(f.launches.length,1);}
    finally{
      for(const child of f.children)child.emit('close');await Promise.allSettled([pending]);
      const closing=i.close();for(const child of f.children)child.emit('close');await closing;
    }
  }
});

test('native stock Windows helper detects authored junctions and never changes source content',
  {skip:process.platform!=='win32'?'stock Windows attribute helper requires Windows':false},async()=>{
    const temporary=path.resolve(os.tmpdir()),root=fs.mkdtempSync(path.join(temporary,'wow-sdk-attributes-'));
    const i=createWindowsPathInspector();
    try{
      const file=path.join(root,'Literal$[x].lua'),folder=path.join(root,'folder'),junction=path.join(root,'junction');
      fs.writeFileSync(file,'-- authored fixture');fs.mkdirSync(folder);fs.symlinkSync(folder,junction,'junction');
      assert.deepEqual(await i.inspect([file,folder,junction,path.join(root,'missing')]),[
        {ok:true,reparsePoint:false},{ok:true,reparsePoint:false},{ok:true,reparsePoint:true},{ok:false,reparsePoint:true}]);
      assert.equal(fs.readFileSync(file,'utf8'),'-- authored fixture');
    }finally{await i.close();assert.equal(path.dirname(root),temporary);assert.ok(path.basename(root).startsWith('wow-sdk-attributes-'));
      fs.rmSync(root,{recursive:true,force:true});}
  });
