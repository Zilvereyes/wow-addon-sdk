import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseXml} from '@wow-addon/xml-parser';
import {analyzeXml,mapXmlValueRanges} from '@wow-addon/xml-analysis';
import {analyzeLua} from '@wow-addon/lua-analysis';
import {composeXmlInlineLua,verifyXmlInlineLua,validateXmlInlineProfile} from '../scripts/xml-inline-lua-validation.mjs';
const select=localName=>({namespaceUri:null,localName});
const policy={roots:[select('Ui')],frameElements:[],includeElements:[],scriptElements:[select('Script')],handlerContainers:[],handlerElements:[]};
const profile=validateXmlInlineProfile({schemaVersion:1,chunkContext:{kind:'chunk'},handlers:[]});
const filename='Authored.xml', options={policy,profile,fileOrdinal:1};
function input(text){
  const syntax=parseXml(text,filename);
  const provider=analyzeXml(text,filename,{addonId:'corpus-xml',policy});
  return {text,syntax,provider};
}
const mutations=[
  {name:'relocated declaration source with internally coherent replacement maps',text:'<Ui><Script>First=1; Other=2</Script></Ui>',
    change(result){result.declarations[1].source=structuredClone(result.declarations[0].source);}},
  {name:'unexpected fixed Lua diagnostic message',text:'<Ui><Script>require("authored-not-executed")</Script></Ui>',
    change(result){result.diagnostics[0].message='PRIVATE_UNREVIEWED_MESSAGE';}},
];
for(const mutation of mutations){
  test('inline worker validation rejects '+mutation.name,()=>{
    const {text,syntax,provider}=input(mutation.text);
    const injected=(...args)=>{const result=analyzeLua(...args);mutation.change(result);return result;};
    const response=composeXmlInlineLua(text,filename,syntax,provider,options,injected,mapXmlValueRanges);
    assert.equal(response.status,'invariant');
    assert.deepEqual(response.bodies,[]);
  });
  test('independent inline corpus validation rejects '+mutation.name,()=>{
    const {text,syntax,provider}=input(mutation.text);
    const response=composeXmlInlineLua(text,filename,syntax,provider,options,analyzeLua,mapXmlValueRanges);
    assert.equal(response.status,'completed');
    const row=response.bodies[0], body=provider.scripts[0].body;
    mutation.change(row.analysis);
    row.mapping=mapXmlValueRanges(text,filename,body,[
      ...row.analysis.declarations.map(d=>d.source.range),...row.analysis.diagnostics.map(d=>d.source.range),
    ]);
    assert.equal(row.mapping.complete,true,'corrupt ranges remain source-map consistent');
    assert.throws(()=>verifyXmlInlineLua(response,text,filename,syntax,provider,policy,profile,1));
  });
}

test('per-file inline returned-record cap is exact across real split-identifier declarations and sidecars',()=>{
  for(const count of [12500,12501]){
    const {text,syntax,provider}=input('<Ui><Script>'+'Ou<!--gap-->t=1;'.repeat(count)+'</Script></Ui>');
    assert.equal(syntax.complete,true);assert.equal(provider.complete,true);
    assert.ok(provider.scripts[0].body.mappings.length<50000,'provider has its own unchanged stage budget');
    const response=composeXmlInlineLua(text,filename,syntax,provider,options,analyzeLua,mapXmlValueRanges);
    if(count===12500){
      assert.equal(response.status,'completed');
      const row=response.bodies[0];
      const parts=row.mapping.mappings.reduce((total,mapping)=>total+mapping.parts.length,0);
      assert.equal(row.analysis.declarations.length+row.mapping.mappings.length+parts,50000);
      const checked=verifyXmlInlineLua(response,text,filename,syntax,provider,policy,profile,1);
      assert.equal(checked.metrics.declarations,count);assert.equal(checked.metrics.originalParts,count*2);
    }else{assert.equal(response.status,'resource');assert.deepEqual(response.bodies,[]);}
  }
});
