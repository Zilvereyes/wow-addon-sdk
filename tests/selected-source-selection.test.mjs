import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseToc} from '@wow-addon/toc-parser';
import {prepareGraphContext} from '../scripts/selected-source-context.mjs';
import {selectGraphToc,openGraphReference} from '../scripts/selected-source-selection.mjs';

const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
function context(alter=()=>{}){
  const p={profile:json('../docs/proposals/selected-source-graph-profile.json'),
    ...json('../examples/classic-era-resolution-profile.json'),xmlPolicy:json('../examples/xml-provider-profile.json').policy,
    inlineProfile:json('../examples/xml-inline-lua-profile.json'),luaInputProfile:'bounded'};
  alter(p);return prepareGraphContext(p);
}
function loader(files,reads){return async path=>{
  reads.push(path);if(!files.has(path))throw Error('authored missing');
  const {content,sourcePath=path}=files.get(path);
  return{sourcePath,parsed:parseToc(content,sourcePath)};
};}
const files=()=>new Map([
  ['Demo/Demo_Vanilla.toc',{content:'## Title: Era\r\nUI/Chosen.lua'}],
  ['Demo/Demo_Mainline.toc',{content:'## Title: Other\nUI/Never.lua'}],
]);

test('actual TOC selector reads every explicit candidate and opens only selected descendants',async()=>{
  const reads=[],ctx=context(),selected=await selectGraphToc(ctx,0,loader(files(),reads));
  assert.equal(selected.selection.status,'selected');assert.equal(selected.traversable,true);
  assert.deepEqual(reads,['Demo/Demo_Vanilla.toc','Demo/Demo_Mainline.toc']);
  assert.equal(selected.selected.parsed.metadata.tocPath,'Demo/Demo_Vanilla.toc');
  const entry=selected.selected.parsed.metadata.fileEntries[0],opened=[];
  const result=await openGraphReference(ctx,{sourcePath:selected.selected.sourcePath,
    targetValue:entry.path,conditions:[],source:entry.source,kind:'toc'},async path=>{opened.push(path);return 'authored payload';});
  assert.deepEqual(opened,['Demo/UI/Chosen.lua']);assert.equal(result.value,'authored payload');
  assert.equal(result.evaluation.availability,'active');
});

test('an explicit Retail environment selects the opposite authored variant and descendants',async()=>{
  const ctx=context(p=>{
    p.environment.client='retail';p.environment.clientFamily='mainline';
    p.selectionPolicy.client='retail';p.selectionPolicy.clientFamily='mainline';p.selectionPolicy.suffixPrecedence=['Mainline',null];
  });
  const selected=await selectGraphToc(ctx,0,loader(files(),[]));
  assert.equal(selected.traversable,true);assert.equal(selected.selected.sourcePath,'Demo/Demo_Mainline.toc');
  const entry=selected.selected.parsed.metadata.fileEntries[0],opened=[];
  await openGraphReference(ctx,{sourcePath:selected.selected.sourcePath,targetValue:entry.path,source:entry.source,
    kind:'toc',conditions:[]},async path=>{opened.push(path);});
  assert.deepEqual(opened,['Demo/UI/Never.lua']);
});

test('missing candidates prevent selector invocation and fallback; parser diagnostics stay attached',async()=>{
  const f=files();f.delete('Demo/Demo_Vanilla.toc');const reads=[];
  const missing=await selectGraphToc(context(),0,loader(f,reads));
  assert.equal(missing.selection,null);assert.equal(missing.traversable,false);assert.equal(missing.selected,null);
  assert.equal(missing.candidates.length,2);assert.deepEqual(reads,['Demo/Demo_Vanilla.toc','Demo/Demo_Mainline.toc']);
  f.set('Demo/Demo_Vanilla.toc',{content:'## not-a-valid-directive'});
  const rejected=await selectGraphToc(context(),0,loader(f,[]));
  assert.equal(rejected.selection.status,'selected');assert.equal(rejected.traversable,false);
  assert.ok(rejected.selected.parsed.diagnostics.some(d=>d.severity==='error'));
  f.set('Demo/Demo_Vanilla.toc',{content:'## Title: selected'});f.set('Demo/Demo_Mainline.toc',{content:'## not-a-valid-directive'});
  const unselected=await selectGraphToc(context(),0,loader(f,[]));
  assert.equal(unselected.traversable,true);assert.ok(unselected.candidates[1].loaded.parsed.diagnostics.length>0);
});

test('exact native source spelling reaches parser identity while duplicates and mismatches fail closed',async()=>{
  const f=files();f.set('Demo/Demo_Vanilla.toc',{content:'',sourcePath:'DEMO/Demo_Vanilla.TOC'});
  const result=await selectGraphToc(context(),0,loader(f,[]));
  assert.equal(result.selected.parsed.metadata.tocPath,'DEMO/Demo_Vanilla.TOC');
  assert.equal(result.selection.selectedVariantId,JSON.stringify(['authored/demo','DEMO/Demo_Vanilla.TOC']));
  const duplicate=context(p=>p.profile.addons[0].tocPaths.push(p.profile.addons[0].tocPaths[0]));
  assert.equal((await selectGraphToc(duplicate,0,loader(files(),[]))).selection.status,'invalid');
  f.set('Demo/Demo_Vanilla.toc',{content:'',sourcePath:'Elsewhere/Demo_Vanilla.toc'});
  assert.equal((await selectGraphToc(context(),0,loader(f,[]))).selection,null);
  const strict=context(p=>p.profile.pathPolicy.caseComparison='exact');
  f.set('Demo/Demo_Vanilla.toc',{content:'',sourcePath:'DEMO/Demo_Vanilla.TOC'});
  assert.equal((await selectGraphToc(strict,0,loader(f,[]))).selection,null);
  f.set('Demo/Demo_Vanilla.toc',{content:'',sourcePath:'DEMO\\Demo_Vanilla.TOC'});
  assert.equal((await selectGraphToc(context(),0,loader(f,[]))).selected.sourcePath,'DEMO\\Demo_Vanilla.TOC');
});

test('actual selector retains no-match and ambiguous outcomes without a traversable prefix',async()=>{
  const f=files();
  const none=context(p=>p.selectionPolicy.suffixPrecedence=['Wrath']);
  const noMatch=await selectGraphToc(none,0,loader(f,[]));
  assert.equal(noMatch.selection.status,'no-match');assert.equal(noMatch.selected,null);assert.equal(noMatch.traversable,false);
  f.set('Demo/Demo_Vanilla.TOC',{content:''});
  const tied=context(p=>p.profile.addons[0].tocPaths.push('Demo/Demo_Vanilla.TOC'));
  const ambiguous=await selectGraphToc(tied,0,loader(f,[]));
  assert.equal(ambiguous.selection.status,'ambiguous');assert.equal(ambiguous.traversable,false);
});

test('inactive semantic targets are never interpreted or opened; unknown guards keep original issues',async()=>{
  const ctx=context(),toc='Demo/Demo_Vanilla.toc';
  const parsed=parseToc('Bad[AllowLoadGameType other]/../NUL.lua\r\n[Bootstrap]Empty.lua',toc);
  let opens=0;
  const reference=entry=>({sourcePath:toc,targetValue:entry.path,source:entry.source,kind:'toc',
    conditions:entry.conditions.map(c=>({...c,providerId:'@wow-addon/toc-metadata-adapter'}))});
  const inactive=await openGraphReference(ctx,reference(parsed.metadata.fileEntries[0]),async()=>{opens++;});
  assert.equal(inactive.status,'inactive');assert.equal(inactive.expandedTarget,null);assert.equal(opens,0);
  const unknown=await openGraphReference(ctx,reference(parsed.metadata.fileEntries[1]),async()=>{opens++;return [];});
  assert.equal(unknown.status,'opened');assert.equal(unknown.evaluation.availability,'unknown');
  assert.deepEqual(unknown.evaluation.issues.map(i=>i.code),['CONDEVAL0003']);
  assert.equal(unknown.evaluation.issues[0].sources[0].file,toc);assert.equal(opens,1);
  const both={...reference(parsed.metadata.fileEntries[0]),conditions:[
    ...reference(parsed.metadata.fileEntries[0]).conditions,...reference(parsed.metadata.fileEntries[1]).conditions]};
  const falseAndUnknown=await openGraphReference(ctx,both,async()=>{opens++;});
  assert.equal(falseAndUnknown.status,'inactive');assert.equal(opens,1);
  assert.deepEqual(falseAndUnknown.evaluation.issues.map(i=>i.code),['CONDEVAL0003','CONDEVAL0006']);
});

test('reference gating uses semantic TOC paths, inside-root parents and explicit tokens',async()=>{
  const toc='Demo/Demo_Vanilla.toc',entry=parseToc('UI/Part[AllowLoadGameType vanilla]One.lua',toc).metadata.fileEntries[0];
  const opened=[],load=async path=>{opened.push(path);return true;},ctx=context();
  const ref={sourcePath:toc,targetValue:entry.path,source:entry.source,kind:'toc',
    conditions:entry.conditions.map(c=>({...c,providerId:'@wow-addon/toc-metadata-adapter'}))};
  await openGraphReference(ctx,ref,load);
  await openGraphReference(ctx,{...ref,targetValue:'../Sibling/[Branch]/Part.xml'},load);
  assert.deepEqual(opened,['Demo/UI/PartOne.lua','Sibling/Era/Part.xml']);
  for(const [target,status] of [['../../escape.lua','blocked'],['/root.lua','blocked'],['NUL.lua','blocked'],
    ['[Unknown]/File.lua','unsupported'],['$parent.lua','unsupported']]){
    const result=await openGraphReference(ctx,{...ref,targetValue:target},load);assert.equal(result.status,status);
  }
  assert.equal(opened.length,2);
});

test('malformed guards and over-budget targets fail before loading; target I/O errors propagate',async()=>{
  const ctx=context(),source={file:'Demo/Demo_Vanilla.toc',range:{start:{line:0,column:0},end:{line:0,column:1}}};
  let opens=0;const load=async()=>{opens++;throw Error('authored I/O failure');};
  const ref={sourcePath:source.file,targetValue:'File.lua',source,conditions:[{invalid:true}],kind:'toc'};
  const invalid=await openGraphReference(ctx,ref,load);assert.equal(invalid.status,'blocked');
  assert.equal(invalid.evaluation.reason,'invalid-input');assert.equal(opens,0);
  const budget=await openGraphReference(ctx,{...ref,conditions:[],targetValue:'a'.repeat(4097)},load);
  assert.equal(budget.status,'budget');assert.equal(opens,0);
  await assert.rejects(openGraphReference(ctx,{...ref,conditions:[]},load),/authored I\/O failure/u);
  assert.equal(opens,1);
});

test('only TOC Lua/XML, XML Include XML and XML Script Lua targets reach the loading port',async()=>{
  const ctx=context(),source={file:'Demo/Demo_Vanilla.toc',range:{start:{line:0,column:0},end:{line:0,column:1}}};
  const opened=[],load=async path=>{opened.push(path);return true;};
  const ref={sourcePath:source.file,targetValue:'File.lua',source,conditions:[],kind:'toc'};
  for(const [kind,target,status] of [['toc','File.LUA','opened'],['toc','File.XML','opened'],
    ['toc','README.txt','unsupported'],['toc','Asset.blp','unsupported'],['toc','Nested.toc','unsupported'],
    ['include','Include.xml','opened'],['include','Code.lua','unsupported'],['script','Code.lua','opened'],
    ['script','Include.xml','unsupported'],['other','Code.lua','unsupported']]){
    assert.equal((await openGraphReference(ctx,{...ref,kind,targetValue:target},load)).status,status);
  }
  assert.deepEqual(opened,['Demo/File.LUA','Demo/File.XML','Demo/Include.xml','Demo/Code.lua']);
});

test('reference source identity must exactly match its containing lookup source',async()=>{
  const ctx=context(),entry=parseToc('Payload.lua','Demo/A.toc').metadata.fileEntries[0];
  const opened=[],load=async path=>{opened.push(path);};
  const ref={sourcePath:'Other/B.toc',targetValue:entry.path,source:entry.source,conditions:[],kind:'toc'};
  assert.equal((await openGraphReference(ctx,ref,load)).status,'blocked');assert.deepEqual(opened,[]);
  assert.equal((await openGraphReference(ctx,{...ref,sourcePath:'Demo/A.toc'},load)).status,'opened');
  assert.deepEqual(opened,['Demo/Payload.lua']);
});
