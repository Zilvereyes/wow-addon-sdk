/** Authored-only experiment. The production launcher continues to use fresh XML threads. */
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,rmdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createGraphAnalyzer} from '../../scripts/selected-source-analysis-client.mjs';

const repo = new URL('../../',import.meta.url);
const sourceRevision = 'd431facca863b120ea7785ce8a63f400bdb4f1ef';
const worker = new URL('scripts/selected-source-analysis-worker.mjs',repo);
const observer = new URL('tests/fixtures/observe-selected-source-launcher.mjs',repo).href;
const xmlPolicy = JSON.parse(readFileSync(new URL('examples/xml-provider-profile.json',repo),'utf8')).policy;
const inlineProfile = JSON.parse(readFileSync(new URL('examples/xml-inline-lua-profile.json',repo),'utf8'));
const replace = (source,anchor,next) => {
  assert.equal(source.split(anchor).length,2,anchor);
  return source.replace(anchor,()=>next);
};
function sourceAtRevision(file) {
  return execFileSync('git',['show',sourceRevision+':scripts/'+file],{
    cwd:fileURLToPath(repo),encoding:'utf8',windowsHide:true,
  }).replaceAll('\r\n','\n');
}
assert.equal(process.argv.length,2,'This experiment uses only built-in authored inputs.');
const temp = resolve(tmpdir());
const scratch = mkdtempSync(join(temp,'wow-xml-reuse-'));
try {
  const corpusOwner = sourceAtRevision('selected-source-lua-thread.mjs');
  const sourceText = sourceAtRevision('selected-source-analysis-worker.mjs');
  let relocated = sourceText;
  for (const file of ['selected-source-analysis-receipts.mjs','selected-source-lua-thread.mjs','xml-inline-lua-validation.mjs']) {
    const target = file === 'selected-source-lua-thread.mjs' ? pathToFileURL(join(scratch,'lua-owner.mjs')) : new URL(file,worker);
    relocated = replace(relocated,"'./"+file+"'",JSON.stringify(target.href));
  }
  for (const name of ['toc-parser','lua-analysis','xml-parser','xml-analysis']) {
    const token = "'@wow-addon/"+name+"'";
    assert.equal(relocated.split(token).length,name==='lua-analysis'?3:2);
    relocated = relocated.replaceAll(token,JSON.stringify(new URL('node_modules/@wow-addon/'+name+'/dist/index.js',repo).href));
  }

  const ownerUrl = pathToFileURL(join(scratch,'xml-owner.mjs'));
  let owner = corpusOwner;
  owner = owner.replaceAll('createCorpusLuaThread','createXmlThread').replaceAll('Corpus Lua','XML').replaceAll('corpus Lua','XML');
  owner = replace(owner,"reply.result.result.diagnostics.some(row => row.code === 'LUA0003' || row.code === 'LUA0005')",
    "[...reply.result.syntax.diagnostics, ...(reply.result.provider?.diagnostics ?? [])].some(row => row.code === 'XML0003' || row.code === 'XUI0003')");
  writeFileSync(join(scratch,'lua-owner.mjs'),corpusOwner,{flag:'wx'});
  writeFileSync(ownerUrl,owner,{flag:'wx'});

  let candidate = "import {createXmlThread} from " + JSON.stringify(ownerUrl.href) + ";\n" + relocated;
  candidate = replace(candidate,'  let requests = 0;',
    `  let xmlThread;
    async function retireXml() {
      await xmlThread?.close();
      xmlThread = undefined;
    }
    function getXmlThread() {
      return xmlThread ??= createXmlThread({
        spawnThread: () => new Worker(new URL(import.meta.url), {workerData:null,execArgv:[],
          resourceLimits:{maxOldGenerationSizeMb:256,stackSizeMb:4}}),
        onFault: () => {process.exitCode=2;input.close();},
      });
    }
    let requests = 0;`);
  candidate = replace(candidate,'      } else if (isCorpusLua || tocXmlLauncher) {',
    `      } else if (tocXmlLauncher && request.language === 'xml') {
          reply = await getXmlThread().analyze(request);
          if (requests + 1 === maxRequests) await retireXml();
        } else if (isCorpusLua || tocXmlLauncher) {
          await retireXml();`);
  candidate = replace(candidate,'  await corpusThread?.close();','  await corpusThread?.close();\n  await retireXml();');

  const paths = ['stock.mjs','candidate.mjs'].map(name => pathToFileURL(join(scratch,name)));
  writeFileSync(paths[0],relocated,{flag:'wx'});
  writeFileSync(paths[1],candidate,{flag:'wx'});
  const repeat=(count,line)=>Array.from({length:count},(_,i)=>line(i)).join('\r\n');
  const rows=[];
  function input(language,kind,content){
    rows.push({kind,request:{language,content,sourcePath:'Authored/Test'+rows.length+'.'+language,
      addonId:'per-call-'+rows.length,conditions:[],luaProfile:'corpus',allowShebang:false,xmlPolicy,inlineProfile}});
  }
  for(let i=0;i<42;i++){
    if(i%6===0)input('lua','lua',repeat(12,j=>'Own'+i+'Value'+j+' = '+j));
    if(i===12||i===28)input('toc','toc','## Interface: 11509\r\nMain.lua');
    if(i===9){input('xml','malformed','<Ui><Frame></Ui>');continue;}
    if(i===19){input('xml','depth-limit','<x>'.repeat(257)+'</x>'.repeat(257));continue;}
    const size=i%3, count=[8,12,120][size];
    input('xml',['small','medium','large'][size],
      '<Ui><!--🙂-->\r\n'+repeat(count,j=>'<Frame name="Name'+i+'_'+j+'">'+
      (size===0?'':'<Scripts><OnLoad>Own'+i+'Inline'+j+' = self</OnLoad></Scripts>')+'</Frame>')+'</Ui>');
  }

  function median(values){
    const ordered=values.toSorted((a,b)=>a-b), i=Math.floor(ordered.length/2);
    return Math.round((ordered[i]+ordered[(ordered.length-1)>>1])*5)/10;
  }
  async function run(use){
    const entries=[], active=new Map(), pairs=[], pending=new Map();
    let seq=0, telemetryError;
    function ask(child){
      return new Promise(resolve=>{
        const id=++seq;
        const timer=setTimeout(()=>{pending.delete(id);resolve(null);},2500);
        function done(data){clearTimeout(timer);pending.delete(id);resolve(data);}
        pending.set(id,done);
        child.send({sample:id},error=>{if(error)done(null);});
      });
    }
    const client=createGraphAnalyzer({spawnProcess(executable,args,options){
      assert.equal(args[1],fileURLToPath(worker));
      const pool=args.at(-1)==='--corpus-launcher'?'lua':'tocXml';
      assert.ok(!active.has(pool));
      const child=spawn(executable,['--import',observer,args[0],fileURLToPath(use),...args.slice(2)],
        {...options,stdio:[...options.stdio,'ipc']});
      const state={pool,starts:0,exits:0,peakKiB:0,closed:null};
      entries.push(state);active.set(pool,child);
      child.once('close',(code,signal)=>{active.delete(pool);state.closed=[code,signal];});
      child.on('message',row=>{
        if(row.kind==='sample'){pending.get(row.sample)?.(row);return;}
        if(row.kind==='start')state.starts++;
        if(row.kind==='exit')state.exits++;
        state.peakKiB=Math.max(state.peakKiB,row.peakRssKiB);
        if(row.live>1||row.executing>1)telemetryError??=Error('Unexpected Worker slot overlap');
        if((row.kind==='start'||row.kind==='dispatch')&&pool==='tocXml'&&active.has('lua')){
          pairs.push(Promise.all([ask(active.get('lua')),ask(child)]));
        }
      });
      return child;
    }});
    const replies=[],times={};
    const start=performance.now();
    try{
      for(const {request,kind} of rows){
        const before=performance.now();
        const reply=await client.analyze(request);
        (times[kind]??=[]).push(performance.now()-before);
        assert.equal(reply.result.language,request.language);
        if(kind==='malformed'||kind==='depth-limit'){
          assert.equal(reply.result.syntax.complete,false);
          assert.equal(reply.result.provider,null);
          if(kind==='depth-limit')assert.ok(reply.result.syntax.diagnostics.some(r=>r.code==='XML0003'));
        }
        if(['small','medium','large'].includes(kind)){
          const inline={small:0,medium:12,large:120}[kind];
          assert.equal(reply.result.inline.length,inline);
          assert.deepEqual(reply.confirmedApiCalls.analyzeLua,{invoked:inline,returned:inline});
          assert.deepEqual(reply.confirmedApiCalls.mapXmlValueRanges,{invoked:inline,returned:inline});
        }
        replies.push(reply);
      }
    }finally{await client.close();}
    const elapsedMs=Math.round(performance.now()-start);
    if(telemetryError)throw telemetryError;
    assert.equal(active.size,0);
    assert.equal(entries.length,3);
    assert.ok(entries.every(entry=>entry.starts===entry.exits));
    for(const entry of entries)assert.deepEqual(entry.closed,[0,null]);
    const samples=(await Promise.all(pairs)).filter(pair=>pair.every(Boolean));
    const combined=samples.filter(([a,b])=>Math.abs(a.measuredAtMs-b.measuredAtMs)<=25);
    assert.ok(combined.length>0);
    const byKind=Object.fromEntries(Object.entries(times).map(([key,value])=>[key,{count:value.length,median:median(value)}]));
    return {replies,report:{elapsedMs,byKind,entries,pairedSamples:combined.length,
      pairedPeakKiB:Math.max(...combined.map(([a,b])=>a.rssKiB+b.rssKiB)), maxLive:Math.max(...combined.map(([a,b])=>a.live+b.live))}};
  }
  let baseline;
  const runs=[];
  for(const index of [0,1,1,0]){
    const {replies,report}=await run(paths[index]);
    if(baseline)assert.deepEqual(replies,baseline);
    else baseline=replies;
    runs.push({mode:index?'candidate':'stock',...report});
  }
  console.log(JSON.stringify({node:process.version,sourceRevision,requests:rows.length,comparisons:rows.length*4,
    digest:createHash('sha256').update(JSON.stringify(baseline)).digest('hex'),runs}));
} finally {
  for (const name of ['lua-owner.mjs','xml-owner.mjs','stock.mjs','candidate.mjs']) {
    rmSync(join(scratch,name),{force:true});
  }
  rmdirSync(scratch);
}
