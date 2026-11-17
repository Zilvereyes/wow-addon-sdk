/** Existing SDK behavior only. No source graph, filesystem traversal or game loading is implemented. */
import assert from 'node:assert/strict';
import {WoWClient} from '../../packages/addon-metadata/dist/index.js';
import {parseToc} from '../../packages/toc-parser/dist/index.js';
import {selectTocVariant,evaluateGlobalConditions,resolveGlobalRegistry} from '../../packages/toc-metadata-adapter/dist/index.js';
import {analyzeLua} from '../../packages/lua-analysis/dist/index.js';
import {analyzeXml,mapXmlValueRanges} from '../../packages/xml-analysis/dist/index.js';

const checks=[];const check=(name,fn)=>{fn();checks.push(name);};
const logicalAddonId='authored/demo';
const environment={schemaVersion:1,client:WoWClient.ClassicEra,clientFamily:'classic',gameType:'vanilla'};
const selectionPolicy={schemaVersion:1,id:'authored/era',client:WoWClient.ClassicEra,clientFamily:'classic',suffixPrecedence:['Vanilla',null]};
const conditionPolicy={schemaVersion:1,id:'authored/conditions',nameComparison:'ascii-insensitive',rules:[{
  providerId:'@wow-addon/toc-metadata-adapter',name:'AllowLoadGameType',field:'gameType',operator:'include',valueComparison:'exact',
}]};
const text='## SavedVariables: DB\nCore.lua [AllowLoadGameType vanilla]\nCore.lua [AllowLoadGameType vanilla]\nUI\\View.xml\n[Branch]\\Module.lua';
const parsed=parseToc(text,'Demo/Demo_Vanilla.toc');
const retail=parseToc('## SavedVariables: RetailDB\nNever.lua','Demo/Demo_Mainline.toc');
const candidate=p=>({identity:{logicalAddonId,tocVariantId:JSON.stringify([logicalAddonId,p.metadata.tocPath]),
  tocPath:p.metadata.tocPath,tocSuffix:p.metadata.tocSuffix,source:p.entries[0].source},metadata:p.metadata});
const candidates=[candidate(parsed),candidate(retail)];
const group={logicalAddonId,addonBaseName:'Demo',selectionPolicy,candidates};
// Authored caller-supplied descriptors, not an implemented graph translator.
const descriptors=entry=>entry.conditions.map(c=>({providerId:'@wow-addon/toc-metadata-adapter',name:c.name,
  values:[...c.values],raw:c.raw,source:structuredClone(c.source)}));
const restriction=descriptors(parsed.metadata.fileEntries[0]);
const direct=conditions=>analyzeLua('Shared=1','Demo/Core.lua',{addonId:logicalAddonId,conditions});
const first=direct(restriction),second=direct(descriptors(parsed.metadata.fileEntries[1]));
const provider=declarations=>({providerId:'@wow-addon/lua-analysis',tocVariantId:candidates[0].identity.tocVariantId,declarations});
const selector=localName=>({namespaceUri:null,localName});
const xmlOptions={addonId:logicalAddonId,policy:{roots:[selector('Ui')],frameElements:[selector('Frame')],
  includeElements:[selector('Include')],scriptElements:[selector('Script')],handlerContainers:[selector('Scripts')],handlerElements:[selector('OnLoad')]}};

check('TOC preserves duplicate raw path occurrences and distinct original condition sources',()=>{
  assert.deepEqual(parsed.diagnostics,[]);
  assert.deepEqual(parsed.metadata.fileEntries.map(e=>e.path),['Core.lua','Core.lua','UI\\View.xml','[Branch]\\Module.lua']);
  assert.equal(parsed.metadata.fileEntries[0].conditions[0].source.range.start.line,1);
  assert.equal(parsed.metadata.fileEntries[1].conditions[0].source.range.start.line,2);
  const input='Co[AllowLoadGameType vanilla]re.lua';
  const interrupted=parseToc(input,'Demo/Demo_Vanilla.toc').metadata.fileEntries[0];
  assert.equal(interrupted.path,'Core.lua');
  assert.equal(input.slice(interrupted.source.range.start.column,interrupted.source.range.end.column),input);
});
check('actual selector chooses exact Era and Retail variants independently without mutating candidates',()=>{
  const before=JSON.stringify(candidates);
  assert.equal(selectTocVariant(environment,logicalAddonId,'Demo',candidates,selectionPolicy).selectedVariantId,candidates[0].identity.tocVariantId);
  const retailEnv={schemaVersion:1,client:WoWClient.Retail,clientFamily:'mainline'};
  const retailPolicy={...selectionPolicy,client:WoWClient.Retail,clientFamily:'mainline',suffixPrecedence:['Mainline',null]};
  assert.equal(selectTocVariant(retailEnv,logicalAddonId,'Demo',candidates,retailPolicy).selectedVariantId,candidates[1].identity.tocVariantId);
  assert.equal(JSON.stringify(candidates),before);
});
check('existing evaluator distinguishes active inactive and unknown supplied path restrictions',()=>{
  const declaration=first.declarations[0];assert.ok(declaration);
  assert.equal(evaluateGlobalConditions(declaration,environment,conditionPolicy).availability,'active');
  assert.equal(evaluateGlobalConditions(declaration,{...environment,gameType:'other'},conditionPolicy).availability,'inactive');
  const unknown={...environment};delete unknown.gameType;
  assert.equal(evaluateGlobalConditions(declaration,unknown,conditionPolicy).availability,'unknown');
});
check('unknown path-guard issues survive separately from a declaration-free core result',()=>{
  const noRules={...conditionPolicy,rules:[]};
  const evaluation=evaluateGlobalConditions(first.declarations[0],environment,noRules);
  assert.equal(evaluation.availability,'unknown');
  assert.deepEqual(evaluation.issues.map(issue=>issue.code),['CONDEVAL0003']);
  assert.deepEqual(evaluation.issues[0].sources,[restriction[0].source]);
  assert.notEqual(evaluation.issues[0].sources[0],restriction[0].source);
  const empty=analyzeLua('-- empty','Demo/Core.lua',{addonId:logicalAddonId,conditions:restriction});
  assert.equal(empty.complete,true);assert.deepEqual(empty.declarations,[]);
  const emptyToc=parseToc('Core.lua [AllowLoadGameType vanilla]','Demo/Demo_Vanilla.toc');
  const emptyCandidate=candidate(emptyToc);
  const emptyGroup={...group,candidates:[emptyCandidate]};
  const result=resolveGlobalRegistry(environment,[{...emptyGroup,providers:[provider(empty.declarations)]}],noRules);
  assert.equal(result.complete,true);assert.deepEqual(result.entries,[]);assert.deepEqual(result.issues,[]);
  const control=resolveGlobalRegistry(environment,[{...emptyGroup,providers:[provider(first.declarations)]}],noRules);
  assert.equal(control.complete,false);
  assert.deepEqual(control.entries[0].declarations[0].evaluation.issues.map(issue=>issue.code),['CONDEVAL0003']);
});
check('actual Lua results own inherited restriction copies and preserve exact source labels',()=>{
  assert.equal(first.complete,true);assert.equal(second.complete,true);
  assert.equal(first.declarations[0].source.file,'Demo/Core.lua');
  assert.equal(first.declarations[0].activationState,'conditional');
  assert.notEqual(first.declarations[0].conditions[0].source,restriction[0].source);
  assert.notEqual(first.declarations[0].conditions[0].values,restriction[0].values);
});
check('actual resolver preserves automatic TOC origin then duplicate provider order and source restrictions',()=>{
  const result=resolveGlobalRegistry(environment,[{...group,providers:[provider(first.declarations),provider(second.declarations)]}],conditionPolicy);
  assert.equal(result.complete,true);assert.deepEqual(result.activeGlobals,['DB','Shared']);
  const declarations=result.entries.find(e=>e.name==='Shared').declarations;
  assert.equal(declarations.length,2);
  assert.deepEqual(declarations.map(d=>d.declaration.conditions[0].source.range.start.line),[1,2]);
  assert.ok(declarations.every(d=>d.tocVariantId===candidates[0].identity.tocVariantId));
});
check('actual resolver excludes a valid unselected provider batch',()=>{
  const other=analyzeLua('Never=1','Demo/Never.lua',{addonId:logicalAddonId});
  const result=resolveGlobalRegistry(environment,[{...group,providers:[{
    providerId:'@wow-addon/lua-analysis',tocVariantId:candidates[1].identity.tocVariantId,declarations:other.declarations,
  }]}],conditionPolicy);
  assert.equal(result.complete,true);assert.deepEqual(result.activeGlobals,['DB']);
});
check('actual XML facts retain unresolved decoded targets and original entity maps without reading targets',()=>{
  const result=analyzeXml('<Ui><Include file="Parts&#x2f;Two.xml"/><Script file="Core.lua"/></Ui>','Demo/View.xml',xmlOptions);
  assert.equal(result.complete,true);assert.deepEqual(result.references.map(r=>r.target.value),['Parts/Two.xml','Core.lua']);
  assert.deepEqual(result.references[0].target.mappings.map(m=>m.kind),['literal','entity','literal']);
});
check('actual inline Lua and mapper preserve the independently specified split-identifier golden ranges',()=>{
  const content='<Ui><Script>Pub<!--gap-->lic=1</Script></Ui>';
  const xml=analyzeXml(content,'Demo/View.xml',xmlOptions);
  const lua=analyzeLua(xml.scripts[0].body.value,'decoded:authored',{addonId:logicalAddonId});
  const mapped=mapXmlValueRanges(content,'Demo/View.xml',xml.scripts[0].body,lua.declarations.map(d=>d.source.range));
  assert.equal(lua.complete,true);assert.equal(mapped.complete,true);
  assert.deepEqual(mapped.mappings[0].parts.map(p=>[p.source.range.start.column,p.source.range.end.column]),[[12,15],[25,28]]);
  assert.equal(lua.declarations[0].source.file,'decoded:authored');
});
check('existing XML element indices permit a deterministic interleaved event characterization',()=>{
  const content='<Ui><Script>First=1</Script><Include file="Child.xml"/><Frame name="Later"><Scripts><OnLoad>self=1; Last=2</OnLoad></Scripts></Frame></Ui>';
  const result=analyzeXml(content,'Demo/View.xml',xmlOptions);assert.equal(result.complete,true);
  const events=[...result.frames.map(f=>[f.elementIndex,'frame']),...result.references.map(r=>[r.elementIndex,r.kind]),
    ...result.scripts.map(s=>[s.elementIndex,s.kind])].sort((a,b)=>a[0]-b[0]);
  assert.deepEqual(events,[[1,'chunk'],[2,'include'],[3,'frame'],[5,'handler']]);
});
check('frame and explicit function-body declarations retain unknown activation',()=>{
  const frames=analyzeXml('<Ui><Frame name="FrameGlobal"/></Ui>','Demo/View.xml',xmlOptions);
  assert.equal(frames.declarations[0].activationState,'unknown');
  const lua=analyzeLua('self=1; HandlerGlobal=2','decoded:handler',{addonId:logicalAddonId,context:{kind:'function-body',parameters:['self'],variadic:false}});
  assert.deepEqual(lua.declarations.map(d=>[d.name,d.activationState]),[['HandlerGlobal','unknown']]);
});
check('generic self-varargs fallback does not establish explicit button locality',()=>{
  const source='button=1; Out=2';
  const supplied=parameters=>analyzeLua(source,'decoded:comparison',{addonId:logicalAddonId,context:{kind:'function-body',parameters,variadic:true}});
  assert.deepEqual(supplied(['self']).declarations.map(d=>d.name),['button','Out']);
  assert.deepEqual(supplied(['self','button']).declarations.map(d=>d.name),['Out']);
});
check('generic variadic fallback and historical nonvariadic self context disagree on root varargs',()=>{
  const supplied=variadic=>analyzeLua('return ...','decoded:comparison',{addonId:logicalAddonId,context:{kind:'function-body',parameters:['self'],variadic}});
  assert.equal(supplied(true).complete,true);
  assert.equal(supplied(false).diagnostics[0].code,'LUA0002');assert.deepEqual(supplied(false).declarations,[]);
});
assert.equal(checks.length,13);
console.log(JSON.stringify({schemaVersion:1,kind:'existing-sdk-graph-design-characterization',baselineSDKCommit:'07b79a88150804be87b3d9c041bc7f2ff23e531f',runtime:process.version,
  checks:checks.length,pass:true,graphImplemented:false,installedInputRead:false,thirdPartyExecution:false,cases:checks},null,2));
