/** Selection/read gates over trusted internal loading ports; no native host or CLI yet. */
import {selectTocVariant} from '@wow-addon/toc-metadata-adapter';
import {getGraphRequest,evaluateReferenceGuard} from './selected-source-context.mjs';
import {normalizeGraphPath,expandGraphTarget} from './selected-source-profile.mjs';

const fold=value=>value.replace(/[A-Z]/gu,c=>c.toLowerCase());

/** loadToc must return an independently validated, bounded analysis using the matched native spelling.
 * The native adapter will own path attestation, budgets, worker receipts and result validation.
 * This seam deliberately cannot grant that adapter any acceptance credit.
 */
export async function selectGraphToc(context,addonIndex,loadToc){
  const request=getGraphRequest(context),{profile}=request;
  if(!Number.isSafeInteger(addonIndex)||addonIndex<0||addonIndex>=profile.addons.length)throw Error('Invalid graph group index.');
  const group=profile.addons[addonIndex],candidates=[];
  const compare=profile.pathPolicy.caseComparison==='exact'?value=>value:fold;
  for(const tocPath of group.tocPaths){
    try{
      const loaded=await loadToc(tocPath,group);
      const actual=normalizeGraphPath(loaded.sourcePath,[],{maximumUnits:profile.limits.pathUnits});
      const expected=normalizeGraphPath(tocPath,[],{maximumUnits:profile.limits.pathUnits});
      if(actual.status!=='ready'||expected.status!=='ready'||
        actual.components.length!==expected.components.length||actual.components.some((v,i)=>compare(v)!==compare(expected.components[i]))||
        loaded.parsed.metadata.tocPath!==loaded.sourcePath)throw Error('Invalid graph candidate projection.');
      candidates.push({tocPath,loaded});
    }catch{candidates.push({tocPath,loaded:null});}
  }
  if(candidates.some(row=>row.loaded===null))return{candidates,selection:null,selected:null,traversable:false};
  const selection=selectTocVariant(request.environment,group.logicalAddonId,group.addonBaseName,
    candidates.map(({loaded})=>({identity:{logicalAddonId:group.logicalAddonId,
      tocVariantId:JSON.stringify([group.logicalAddonId,loaded.sourcePath]),tocPath:loaded.sourcePath,
      tocSuffix:loaded.parsed.metadata.tocSuffix,source:{file:loaded.sourcePath,
        range:{start:{line:0,column:0},end:{line:0,column:0}}}},metadata:loaded.parsed.metadata})),request.selectionPolicy);
  const selected=selection.status==='selected'?candidates.find(({loaded})=>
    JSON.stringify([group.logicalAddonId,loaded.sourcePath])===selection.selectedVariantId).loaded:null;
  return{candidates,selection,selected,traversable:selected!==null&&!selected.parsed.diagnostics.some(d=>d.severity==='error')};
}

/** Evaluate first. Inactive targets are retained without expansion, path interpretation or loading.
 * Conditions/source must already be validated parser projections; loadTarget is trusted code, not profile data.
 * 'opened' is an internal gate outcome, not a graph-resolution, syntax or native safety verdict.
 */
export async function openGraphReference(context,reference,loadTarget){
  const request=getGraphRequest(context),evaluation=evaluateReferenceGuard(context,reference.conditions,reference.source);
  if(evaluation.availability==='inactive')return{status:'inactive',evaluation,expandedTarget:null};
  if(evaluation.reason==='invalid-input'||evaluation.reason==='missing-provenance')return{status:'blocked',evaluation,expandedTarget:null};
  if(reference.source.file!==reference.sourcePath)return{status:'blocked',evaluation,expandedTarget:null};
  const maximumUnits=request.profile.limits.pathUnits;
  const expansion=expandGraphTarget(reference.targetValue,request.profile.pathPolicy.variables.tokens,maximumUnits);
  if(expansion.status!=='ready')return{status:expansion.status,evaluation,expandedTarget:null};
  const parent=normalizeGraphPath(reference.sourcePath,[],{maximumUnits});
  if(parent.status!=='ready')return{status:'blocked',evaluation,expandedTarget:expansion.expandedTarget};
  const target=normalizeGraphPath(expansion.expandedTarget,parent.components.slice(0,-1),{maximumUnits});
  if(target.status!=='ready')return{status:target.status,evaluation,expandedTarget:expansion.expandedTarget};
  const targetPath=target.components.join('/');
  const name=fold(target.components.at(-1));
  const eligible=reference.kind==='toc'?(name.endsWith('.lua')||name.endsWith('.xml')):
    reference.kind==='include'?name.endsWith('.xml'):reference.kind==='script'&&name.endsWith('.lua');
  if(!eligible)return{status:'unsupported',evaluation,expandedTarget:expansion.expandedTarget};
  const value=await loadTarget(targetPath,reference.conditions,evaluation);
  return{status:'opened',evaluation,expandedTarget:expansion.expandedTarget,targetPath,value};
}
