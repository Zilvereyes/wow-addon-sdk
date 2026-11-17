import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareGraphContext,evaluateReferenceGuard} from '../scripts/selected-source-context.mjs';

const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const request=()=>({profile:json('../docs/proposals/selected-source-graph-profile.json'),
  ...json('../examples/classic-era-resolution-profile.json'),
  xmlPolicy:json('../examples/xml-provider-profile.json').policy,
  inlineProfile:json('../examples/xml-inline-lua-profile.json'),luaInputProfile:'bounded'});
const invalid=input=>assert.throws(()=>prepareGraphContext(input),error=>error.code==='SGRAPH0001'&&
  error.message==='Invalid selected-source graph context.');
const source=()=>({file:'Demo/Demo_Vanilla.toc',range:{start:{line:1,column:0},end:{line:1,column:12}}});
const condition=(values=['vanilla'],name='AllowLoadGameType')=>({providerId:'@wow-addon/toc-metadata-adapter',
  name,raw:'authored condition',values,source:source()});

test('four-profile preflight owns and freezes context without altering caller data',()=>{
  const input=request(),context=prepareGraphContext(input);
  assert.ok(context.stringUnits>0);assert.equal(context.request.luaInputProfile,'bounded');
  assert.deepEqual(context.request.environment,input.environment);
  input.environment.gameType='changed';input.xmlPolicy.roots[0].localName='changed';
  input.inlineProfile.handlers[0].context.parameters[0]='changed';
  assert.equal(context.request.environment.gameType,'vanilla');
  assert.equal(context.request.xmlPolicy.roots[0].localName,'Ui');
  assert.deepEqual(context.request.inlineProfile.handlers[0].context.parameters,['self']);
  assert.throws(()=>{context.request.environment.gameType='changed';},TypeError);
});

test('preflight rejects absent, sparse, contradictory and unavailable root contexts with fixed errors',()=>{
  for(const value of [undefined,null,[],{}])invalid(value);
  for(const alter of [p=>delete p.xmlPolicy,p=>delete p.inlineProfile,p=>p.luaInputProfile='automatic',
    p=>p.environment.client='unknown',p=>p.environment.clientFamily='mainline',
    p=>p.selectionPolicy.client='mainline',p=>p.selectionPolicy.suffixPrecedence=['Vanilla','vanilla'],
    p=>delete p.conditionPolicy.rules[0],p=>p.conditionPolicy.rules.push({...p.conditionPolicy.rules[0]}),
    p=>delete p.xmlPolicy.roots[0],p=>delete p.inlineProfile.handlers[0],
    p=>p.inlineProfile.handlers[0].context.parameters=['end']]){const p=request();alter(p);invalid(p);}
  let coercions=0;const p=request();p.environment.client={toString(){coercions++;throw Error('private');}};
  invalid(p);assert.equal(coercions,0);
  const optional=request();optional.environment.gameType='';optional.environment.textLocale='';
  assert.equal(prepareGraphContext(optional).request.environment.textLocale,'');
});

test('consumed context fields and dense array cells are read once without caller iterators',()=>{
  const p=request();let reads=0,cells=0,lengths=0;
  const environment=p.environment,row=p.inlineProfile.handlers[0];
  Object.defineProperty(p,'environment',{get(){reads++;return reads===1?environment:null;}});
  const handlers=[];Object.defineProperty(handlers,0,{get(){cells++;return cells===1?row:null;},enumerable:true});
  handlers[Symbol.iterator]=()=>{throw Error('private iterator');};
  p.inlineProfile.handlers=new Proxy(handlers,{get(target,key,receiver){if(key==='length')lengths++;return Reflect.get(target,key,receiver);}});
  p.selectionPolicy.suffixPrecedence[Symbol.iterator]=()=>{throw Error('private iterator');};
  const context=prepareGraphContext(p);
  assert.equal(context.request.environment.gameType,'vanilla');assert.equal(context.request.inlineProfile.handlers.length,1);
  assert.equal(reads,1);assert.equal(cells,1);assert.equal(lengths,1);
});

test('combined consumed-string budget rejects individually valid profiles before graph I/O',()=>{
  const p=request();p.profile.id='a'.repeat(550000);p.xmlPolicy.roots[0].namespaceUri='b'.repeat(550000);invalid(p);
  p.profile.id='a'.repeat(400000);p.xmlPolicy.roots[0].namespaceUri='b'.repeat(400000);
  assert.ok(prepareGraphContext(p).stringUnits>800000);
});

test('actual evaluator retains unknown guards and all AND issues without requiring declarations',()=>{
  const context=prepareGraphContext(request());
  assert.deepEqual(evaluateReferenceGuard(context,[],source()),{availability:'active',reason:'unconditional',issues:[]});
  assert.equal(evaluateReferenceGuard(context,[condition()],source()).availability,'active');
  const unknown=condition(['vanilla'],'Unrecognized'),mismatch=condition(['other']);
  const result=evaluateReferenceGuard(context,[unknown],source());
  assert.equal(result.availability,'unknown');assert.equal(result.reason,'unknown');
  assert.deepEqual(result.issues.map(i=>i.code),['CONDEVAL0003']);
  assert.deepEqual(result.issues[0].sources,[unknown.source]);
  unknown.source.range.start.line=50;assert.equal(result.issues[0].sources[0].range.start.line,1);
  const both=evaluateReferenceGuard(context,[condition(['vanilla'],'Unrecognized'),mismatch],source());
  assert.equal(both.availability,'inactive');
  assert.deepEqual(both.issues.map(i=>i.code),['CONDEVAL0003','CONDEVAL0006']);
  assert.throws(()=>evaluateReferenceGuard({request:request()},[],source()),/Invalid selected-source graph context/u);
});
