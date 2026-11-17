import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GRAPH_LIMITS,validateGraphProfile,normalizeGraphPath,expandGraphTarget} from '../scripts/selected-source-profile.mjs';

const profile=()=>({schemaVersion:1,id:'authored/graph',pathPolicy:{separators:'slash-and-backslash',
  caseComparison:'ascii-insensitive-unique',containment:'addons-root',links:'reject',
  variables:{kind:'explicit-tokens',tokens:[{token:'[Branch]',replacement:'Era'}]}},
addons:[{logicalAddonId:'authored/demo',directory:'Demo',addonBaseName:'Demo',tocPaths:['Demo/Demo_Vanilla.toc','Demo/Demo_Mainline.toc']}]});
const invalid=value=>assert.throws(()=>validateGraphProfile(value),error=>error.code==='SGRAPH0001'&&
  error.message==='Invalid selected-source graph profile.');

test('graph profile owns consumed cells, preserves opaque identities and permits only lower fixed budgets',()=>{
  const input=profile();input.addons[0].logicalAddonId='__proto__';input.limits={sourceNodes:3};
  const {profile:copy,stringUnits}=validateGraphProfile(input);
  assert.ok(stringUnits>0);assert.equal(copy.addons[0].logicalAddonId,'__proto__');
  assert.equal(copy.limits.sourceNodes,3);assert.equal(copy.limits.readBytes,1024*1024*1024);
  input.addons[0].tocPaths[0]='changed';input.pathPolicy.variables.tokens[0].replacement='changed';
  assert.equal(copy.addons[0].tocPaths[0],'Demo/Demo_Vanilla.toc');
  assert.equal(copy.pathPolicy.variables.tokens[0].replacement,'Era');
  for(const key of Object.keys(GRAPH_LIMITS)){
    const over=profile();over.limits={[key]:GRAPH_LIMITS[key]+1};invalid(over);
    for(const value of [0,-1,1.5,NaN,Infinity]){const bad=profile();bad.limits={[key]:value};invalid(bad);}
  }
});

test('graph preflight rejects malformed, sparse, duplicate, unsafe and over-budget input without coercion',()=>{
  for(const value of [null,undefined,[],1,'private-profile'])invalid(value);
  for(const alter of [p=>p.extra='private',p=>p.schemaVersion=2,p=>p.addons=[],p=>p.addons.push(structuredClone(p.addons[0])),
    p=>p.addons[0].tocPaths=[],p=>p.addons[0].directory='../outside',p=>p.addons[0].tocPaths=['Elsewhere/Other.toc'],
    p=>p.addons[0].tocPaths=['Demo/Other.lua'],p=>p.pathPolicy.links='follow',p=>p.pathPolicy.containment='unrestricted',
    p=>p.pathPolicy.variables.tokens[0].replacement='../outside',p=>p.pathPolicy.variables.tokens[0].replacement='[Other]',
    p=>p.pathPolicy.variables.tokens.push({...p.pathPolicy.variables.tokens[0]}),p=>p.limits={unknown:1},
    p=>p.id='x'.repeat(1024*1024),p=>delete p.addons[0].tocPaths[0]]){const p=profile();alter(p);invalid(p);}
  let coercions=0;const p=profile();p.id={toString(){coercions++;throw Error('private');}};invalid(p);assert.equal(coercions,0);
  const values=profile();let reads=0;const row=values.addons[0];
  Object.defineProperty(values.addons,0,{get(){reads++;return row;},enumerable:true});
  values.addons[Symbol.iterator]=()=>{throw Error('do not consume an arbitrary iterator');};
  assert.equal(validateGraphProfile(values).profile.addons[0].logicalAddonId,'authored/demo');assert.equal(reads,1);
});

test('portable lookup keeps Unicode exact, collapses internal separators and allows inside-root parents',()=>{
  assert.deepEqual(normalizeGraphPath('..\\Other//./Å.lua',['Demo','UI']).components,['Demo','Other','Å.lua']);
  assert.deepEqual(normalizeGraphPath('../Sibling/a.lua',['Demo']).components,['Sibling','a.lua']);
  assert.deepEqual(normalizeGraphPath('%41#x.lua',['Demo']).components,['Demo','%41#x.lua']);
  assert.deepEqual(normalizeGraphPath('e\u0301.lua',['Demo']).components,['Demo','e\u0301.lua']);
  assert.equal(normalizeGraphPath('A.lua',['Demo']).status,'ready');
  assert.equal(normalizeGraphPath('abc.lua',[],{maximumUnits:7}).status,'ready');
  assert.equal(normalizeGraphPath('abcd.lua',[],{maximumUnits:7}).status,'budget');
});

test('portable lookup rejects root/device/ADS/reserved/unrepresentable/directory targets before a host is needed',()=>{
  for(const target of ['/a.lua','\\a.lua','C:a.lua','C:\\a.lua','\\\\host\\a.lua','\\\\?\\C:\\a.lua','../a.lua',
    'a.lua:stream','NUL.lua','con','COM1.lua','lPt9.txt','COM¹.lua','LPT².xml','a?.lua','a*.xml','a|b.lua',
    'a\0.lua','a\u001F.lua','a.lua.','a.lua ','a\uD800.lua','\uDC00.lua','folder/']){
    assert.equal(normalizeGraphPath(target).status,'blocked',JSON.stringify(target));
  }
  for(const target of ['COM0.lua','COM10.lua','COM⁴.lua','nulx.lua','Å.lua'])assert.equal(normalizeGraphPath(target).status,'ready',target);
});

test('explicit tokens expand exactly once in whole/embedded positions and never infer game variables',()=>{
  const tokens=validateGraphProfile(profile()).profile.pathPolicy.variables.tokens;
  assert.deepEqual(expandGraphTarget('UI\\[Branch]\\Part[Branch].xml',tokens),{status:'ready',expandedTarget:'UI\\Era\\PartEra.xml'});
  assert.deepEqual(expandGraphTarget('Plain.lua',[]),{status:'ready',expandedTarget:'Plain.lua'});
  for(const input of ['[Family]/A.lua','[branch]/A.lua','x[Branch','x]y.lua','[Branch[]].lua','$parent.lua','${HOME}/a.lua']){
    assert.equal(expandGraphTarget(input,tokens).status,'unsupported',input);
  }
  assert.equal(expandGraphTarget('[Branch]',tokens,3).status,'budget','raw target is bounded before expansion');
  assert.equal(expandGraphTarget('x[Branch]',tokens,9).status,'ready');
  const longer=[{token:'[A]',replacement:'LongerName'}];
  assert.equal(expandGraphTarget('[A]',longer,9).status,'budget','expanded length is charged before appending');
  assert.equal(expandGraphTarget('/[Branch]/a.lua',tokens).status,'blocked','root syntax is rejected before expansion');
});
