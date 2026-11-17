import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {prepareGraphContext} from '../scripts/selected-source-context.mjs';
import {createGraphFileHost} from '../scripts/selected-source-native.mjs';

const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
function context(alter=()=>{}){
  const p={profile:json('../docs/proposals/selected-source-graph-profile.json'),...json('../examples/classic-era-resolution-profile.json'),
    xmlPolicy:json('../examples/xml-provider-profile.json').policy,inlineProfile:json('../examples/xml-inline-lua-profile.json'),luaInputProfile:'bounded'};
  alter(p);return prepareGraphContext(p);
}
async function fixture(run){
  const temporary=path.resolve(os.tmpdir()),root=fs.mkdtempSync(path.join(temporary,'wow-sdk-graph-native-'));
  try{fs.mkdirSync(path.join(root,'Demo'));fs.writeFileSync(path.join(root,'Demo','Core.lua'),'Out = 1');await run(root);}
  finally{assert.equal(path.dirname(root),temporary);assert.ok(path.basename(root).startsWith('wow-sdk-graph-native-'));fs.rmSync(root,{recursive:true,force:true});}
}
test('native component lookup preserves matched spelling and reads only explicitly requested text',()=>fixture(async root=>{
  const opens=[],io={...fs,openSync(name,flags,...rest){opens.push(name);assert.equal(flags&(fs.constants.O_WRONLY|fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_TRUNC),0);return fs.openSync(name,flags,...rest);}};
  const host=await createGraphFileHost(root,context(),{io});
  try{
    const lookup=await host.resolvePath('demo\\core.LUA');assert.equal(lookup.status,'ready');assert.equal(lookup.sourcePath,path.join('Demo','Core.lua'));
    assert.deepEqual(opens,[]);const source=await host.readSource(lookup.sourcePath,1024);
    assert.equal(source.bytes.toString(),'Out = 1');assert.equal(opens.length,1);
    assert.equal(await host.verifySource(lookup.sourcePath,source.fingerprint,1024),true);
    assert.equal(host.metrics().chargedReadBytes,14);assert.equal(fs.readFileSync(opens[0],'utf8'),'Out = 1');
    for(const input of ['../outside.lua','/root.lua','NUL.lua','Demo/Core.lua:stream'])assert.equal((await host.resolvePath(input)).status,'blocked');
    assert.equal((await host.resolvePath('Demo/Missing.lua')).status,'missing');assert.equal(opens.length,2);
  }finally{await host.close();}
}));

test('native root/intermediate/final links are rejected without opening their content',()=>fixture(async root=>{
  const target=path.join(root,'Demo'),link=path.join(root,'Link');fs.symlinkSync(target,link,process.platform==='win32'?'junction':'dir');
  let opens=0;const io={...fs,openSync(...args){opens++;return fs.openSync(...args);}};
  const host=await createGraphFileHost(root,context(),{io});
  try{assert.equal((await host.resolvePath('Link/Core.lua')).status,'blocked');assert.equal((await host.resolvePath('Link')).status,'blocked');assert.equal(opens,0);}
  finally{await host.close();}
  await assert.rejects(createGraphFileHost(link,context()),/graph-native-link/u);
}));

test('directory and source integrity changes invalidate their original snapshots',()=>fixture(async root=>{
  const host=await createGraphFileHost(root,context());
  try{
    const directory=await host.listDirectory('Demo'),source=await host.readSource(path.join('Demo','Core.lua'),1024);
    fs.writeFileSync(path.join(root,'Demo','Core.lua'),'Out = 2');
    assert.equal(await host.verifySource(path.join('Demo','Core.lua'),source.fingerprint,1024),false);
    fs.writeFileSync(path.join(root,'Demo','Other.lua'),'');
    assert.equal(await host.verifyDirectory('Demo',directory.fingerprint),false);
    assert.equal((await host.resolvePath('Demo/Core.lua')).status,'blocked');
  }finally{await host.close();}
}));

test('root/network preflight and lower entry/read/deadline budgets fail closed',()=>fixture(async root=>{
  for(const value of ['relative','C:relative','\\\\server\\share','file:///source'])await assert.rejects(createGraphFileHost(value,context()),/graph-native-root/u);
  const entries=await createGraphFileHost(root,context(p=>p.profile.limits={directoryEntries:1}));
  try{assert.equal((await entries.resolvePath('Demo/Core.lua')).status,'budget');}finally{await entries.close();}
  const bytes=await createGraphFileHost(root,context(p=>p.profile.limits={readBytes:7}));
  try{await assert.rejects(bytes.readSource(path.join('Demo','Core.lua'),1024),/graph-native-budget/u);}finally{await bytes.close();}
  let now=0;const inspectorFactory=()=>({async inspect(paths){return paths.map(()=>({ok:true,reparsePoint:false}));},async close(){}});
  const timed=await createGraphFileHost(root,context(p=>p.profile.limits={operationMilliseconds:5000}),{now:()=>now,inspectorFactory});
  try{now=5001;assert.equal((await timed.resolvePath('Demo/Core.lua')).status,'budget');}finally{await timed.close();}
}));

test('native growth charges the sentinel and keeps failed reservations without publication',()=>fixture(async root=>{
  const file=path.join(root,'Demo','Core.lua');fs.writeFileSync(file,'x');let mutated=false;
  const io={...fs,readSync(...args){if(!mutated){mutated=true;fs.writeFileSync(file,'xx');}return fs.readSync(...args);}};
  const host=await createGraphFileHost(root,context(p=>p.profile.limits={readBytes:2}),{io});
  try{
    await assert.rejects(host.readSource(path.join('Demo','Core.lua'),1024),/graph-native-changed/u);
    assert.equal(host.metrics().chargedReadBytes,2);assert.equal(host.metrics().consumedReadBytes,2);
    await assert.rejects(host.readSource(path.join('Demo','Core.lua'),1024),/graph-native-budget/u);
  }finally{await host.close();}
}));

test('native hard links retain separate exact paths and are each actually read',()=>fixture(async root=>{
  fs.linkSync(path.join(root,'Demo','Core.lua'),path.join(root,'Demo','Other.lua'));
  const host=await createGraphFileHost(root,context());
  try{
    for(const name of ['Core.lua','Other.lua']){
      const result=await host.resolvePath('Demo/'+name);assert.equal(result.sourcePath,path.join('Demo',name));
      assert.equal((await host.readSource(result.sourcePath,1024)).bytes.toString(),'Out = 1');
    }
    assert.equal(host.metrics().chargedReadBytes,14);
  }finally{await host.close();}
}));

test('directory depth counts containing folders, with exact and one-over file boundaries',()=>fixture(async root=>{
  fs.mkdirSync(path.join(root,'Demo','UI'));fs.writeFileSync(path.join(root,'Demo','UI','Deep.lua'),'');
  const host=await createGraphFileHost(root,context(p=>p.profile.limits={directoryDepth:1}));
  try{
    assert.equal((await host.resolvePath('Demo',{directory:true})).status,'ready');
    assert.equal((await host.resolvePath('Demo/Core.lua')).status,'ready');
    assert.equal((await host.resolvePath('Demo/UI/Deep.lua')).status,'budget');
  }finally{await host.close();}
}));

test('bulk attribute rejection retains an expired operation budget outcome',()=>fixture(async root=>{
  let now=0,bulk=false;
  const io={...fs,opendirSync(name,...args){if(name===path.join(root,'Demo'))bulk=true;return fs.opendirSync(name,...args);}};
  const inspectorFactory=()=>({async inspect(paths){if(bulk){now=5001;throw Error('authored attribute deadline');}return paths.map(()=>({ok:true,reparsePoint:false}));},async close(){}});
  const host=await createGraphFileHost(root,context(p=>p.profile.limits={operationMilliseconds:5000}),{io,now:()=>now,inspectorFactory});
  try{assert.equal((await host.resolvePath('Demo/Core.lua')).status,'budget');}finally{await host.close();}
}));

test('cached directory changes block content opening even when the requested bytes are unchanged',()=>fixture(async root=>{
  let opens=0;const io={...fs,openSync(...args){opens++;return fs.openSync(...args);}};
  const host=await createGraphFileHost(root,context(),{io});
  try{
    await host.listDirectory('Demo');fs.writeFileSync(path.join(root,'Demo','New.lua'),'-- authored');
    await assert.rejects(host.readSource(path.join('Demo','Core.lua'),1024),/graph-native-changed/u);
    assert.equal(opens,0);assert.equal(fs.readFileSync(path.join(root,'Demo','Core.lua'),'utf8'),'Out = 1');
  }finally{await host.close();}
}));

test('an intermediate directory replaced at open yields no source bytes or fingerprint',()=>fixture(async root=>{
  fs.mkdirSync(path.join(root,'Other'));fs.writeFileSync(path.join(root,'Other','Core.lua'),'Wrong=1');
  let replaced=false,reads=0,closes=0;
  const io={...fs,openSync(...args){
    if(!replaced){
      replaced=true;assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
      fs.renameSync(path.join(root,'Demo'),path.join(root,'Retired'));
      fs.symlinkSync(path.join(root,'Other'),path.join(root,'Demo'),process.platform==='win32'?'junction':'dir');
    }
    return fs.openSync(...args);
  },readSync(...args){reads++;return fs.readSync(...args);},closeSync(...args){closes++;return fs.closeSync(...args);}};
  const host=await createGraphFileHost(root,context(),{io});
  try{
    await assert.rejects(host.readSource(path.join('Demo','Core.lua'),1024),/graph-native-changed/u);
    assert.equal(reads,0);assert.equal(closes,1);assert.equal(host.metrics().consumedReadBytes,0);
  }finally{await host.close();}
}));

test('changed root identity and lower retained-record/string limits stop before source I/O',()=>fixture(async root=>{
  let changed=false,opens=0;
  const io={...fs,lstatSync(name,...args){const stat=fs.lstatSync(name,...args);
    return changed&&name===root?new Proxy(stat,{get(target,key){const value=Reflect.get(target,key);return key==='ino'?value+1n:typeof value==='function'?value.bind(target):value;}}):stat;},
  openSync(...args){opens++;return fs.openSync(...args);}};
  const host=await createGraphFileHost(root,context(),{io});
  try{changed=true;assert.equal((await host.resolvePath('Demo/Core.lua')).status,'blocked');assert.equal(opens,0);}finally{await host.close();}
  for(const limits of [{retainedRecords:1},{retainedStringUnits:1}]){
    let bounded;
    // This assertion isolates retained-memory denial, not stock helper startup.
    // Actual Windows reparse/helper checks retain their separate native fixtures.
    const inspectorFactory=()=>({inspect:async paths=>paths.map(()=>({ok:true,reparsePoint:false})),close:async()=>{}});
    try{await assert.rejects(createGraphFileHost(root,context(p=>p.profile.limits=limits),{inspectorFactory}).then(value=>{bounded=value;return value;}),/graph-native-budget/u);}
    finally{await bounded?.close();}
  }
}));

test('repeated owned directory results are charged before copying cached entries',()=>fixture(async root=>{
  const host=await createGraphFileHost(root,context(p=>p.profile.limits={retainedRecords:32}));
  let bounded=false;
  try{
    for(let i=0;i<20;i++)try{await host.listDirectory('Demo');}catch(error){assert.equal(error.code,'graph-native-budget');bounded=true;break;}
    assert.equal(bounded,true);assert.ok(host.metrics().retainedRecords<=32);
  }finally{await host.close();}
}));

test('empty directory result containers and fingerprints also consume retained budgets',()=>fixture(async root=>{
  fs.unlinkSync(path.join(root,'Demo','Core.lua'));
  const host=await createGraphFileHost(root,context(p=>p.profile.limits={retainedRecords:32}));
  let bounded=false;
  try{
    const first=await host.listDirectory('Demo');assert.deepEqual(first.entries,[]);assert.equal(typeof first.fingerprint,'string');
    for(let i=0;i<20;i++)try{await host.listDirectory('Demo');}catch(error){assert.equal(error.code,'graph-native-budget');bounded=true;break;}
    assert.equal(bounded,true);assert.ok(host.metrics().retainedRecords<=32);
  }finally{await host.close();}
}));

test('repeated empty source buffers and result fingerprints consume retained output budgets',()=>fixture(async root=>{
  fs.writeFileSync(path.join(root,'Demo','Core.lua'),'');
  const host=await createGraphFileHost(root,context(p=>p.profile.limits={retainedRecords:32}));let bounded=false;
  try{
    const first=await host.readSource(path.join('Demo','Core.lua'),1024);assert.equal(first.bytes.length,0);assert.equal(host.metrics().chargedReadBytes,0);
    for(let i=0;i<20;i++)try{await host.readSource(path.join('Demo','Core.lua'),1024);}catch(error){assert.equal(error.code,'graph-native-budget');bounded=true;break;}
    assert.equal(bounded,true);assert.ok(host.metrics().retainedRecords<=32);
  }finally{await host.close();}
}));

test('verification requires an issued exact snapshot before opening or enumerating input',()=>fixture(async root=>{
  let opens=0,lists=0;const io={...fs,openSync(...args){opens++;return fs.openSync(...args);},opendirSync(...args){lists++;return fs.opendirSync(...args);}};
  const host=await createGraphFileHost(root,context(),{io});
  try{
    assert.equal(await host.verifySource(path.join('Demo','Core.lua'),'unissued',1024),false);assert.equal(opens,0);
    assert.equal(await host.verifyDirectory('Demo','unissued'),false);assert.equal(lists,0);
    const original=await host.readSource(path.join('Demo','Core.lua'),1024);
    assert.equal(await host.verifySource(path.join('Demo','Core.lua'),original.fingerprint,1024),true);
  }finally{await host.close();}
}));

test('Linux exact-case collisions and invalid UTF-8 names never select an arbitrary entry',
  {skip:process.platform==='win32'?'case-distinct/invalid-byte filenames require Linux':false},()=>fixture(async root=>{
    fs.writeFileSync(path.join(root,'Demo','core.lua'),'');
    let host=await createGraphFileHost(root,context(p=>p.profile.pathPolicy.caseComparison='exact'));
    try{assert.equal((await host.resolvePath('Demo/Core.lua')).status,'ambiguous');}finally{await host.close();}
    fs.unlinkSync(path.join(root,'Demo','core.lua'));
    fs.writeFileSync(Buffer.concat([Buffer.from(path.join(root,'Demo')+'/'),Buffer.from([0xFF])]),'');
    host=await createGraphFileHost(root,context());
    try{assert.equal((await host.resolvePath('Demo/Core.lua')).status,'blocked');}finally{await host.close();}
  }));
