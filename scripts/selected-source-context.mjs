/** Owned graph request preflight and actual SDK guard evaluation. No filesystem access. */
import {evaluateGlobalConditions,resolveGlobalRegistry,selectTocVariant} from '@wow-addon/toc-metadata-adapter';
import {validateGraphProfile} from './selected-source-profile.mjs';
import {validateXmlProviderProfile} from './xml-provider-validation.mjs';
import {validateXmlInlineProfile} from './xml-inline-lua-validation.mjs';

const prepared=new WeakSet();
const roles=['roots','frameElements','includeElements','scriptElements','handlerContainers','handlerElements'];
class GraphContextError extends Error{
  constructor(){super('Invalid selected-source graph context.');this.code='SGRAPH0001';}
}
const requireValue=value=>{if(!value)throw new GraphContextError();};
function own(value,key){
  requireValue(value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.hasOwn(value,key));
  return value[key];
}
function cells(value,maximum){
  requireValue(Array.isArray(value));const length=value.length;
  requireValue(Number.isSafeInteger(length)&&length>=0&&length<=maximum);
  const copy=[];
  for(let i=0;i<length;i++){requireValue(Object.hasOwn(value,i));copy.push(value[i]);}
  return copy;
}
function freeze(value){
  if(value!==null&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}
  return value;
}

/** Snapshot only documented own fields before handing plain data to existing validators/APIs. */
export function prepareGraphContext(input){
  try{
    const graph=validateGraphProfile(own(input,'profile'));let stringUnits=graph.stringUnits;
    const text=value=>{
      requireValue(typeof value==='string');stringUnits+=value.length;
      requireValue(stringUnits<=1024*1024);return value;
    };
    function fields(value,required,optional=[]){
      const copy={};
      for(const key of required){const cell=own(value,key);copy[key]=key==='schemaVersion'?cell:text(cell);}
      for(const key of optional)if(Object.hasOwn(value,key))copy[key]=text(value[key]);
      return copy;
    }
    const environment=fields(own(input,'environment'),['schemaVersion','client','clientFamily'],['gameType','gameMode','textLocale']);
    const rawSelection=own(input,'selectionPolicy');
    const selectionPolicy=fields(rawSelection,['schemaVersion','id','client','clientFamily'],['gameType','gameMode']);
    selectionPolicy.suffixPrecedence=cells(own(rawSelection,'suffixPrecedence'),1024*1024).map(value=>value===null?null:text(value));
    const rawConditions=own(input,'conditionPolicy');
    const conditionPolicy=fields(rawConditions,['schemaVersion','id','nameComparison']);
    conditionPolicy.rules=cells(own(rawConditions,'rules'),1024*1024).map(row=>
      fields(row,['providerId','name','field','operator','valueComparison']));
    const suppliedXml=own(input,'xmlPolicy'),xmlPolicy={};
    for(const role of roles)xmlPolicy[role]=cells(own(suppliedXml,role),128).map(row=>{
      const uri=own(row,'namespaceUri');return{namespaceUri:uri===null?null:text(uri),localName:text(own(row,'localName'))};
    });
    validateXmlProviderProfile({schemaVersion:1,policy:xmlPolicy});
    const suppliedInline=own(input,'inlineProfile'),rawChunk=own(suppliedInline,'chunkContext');
    const inlineProfile={schemaVersion:own(suppliedInline,'schemaVersion'),chunkContext:{kind:text(own(rawChunk,'kind'))},
      handlers:cells(own(suppliedInline,'handlers'),128).map(row=>{
        const element=own(row,'element'),uri=own(element,'namespaceUri'),context=own(row,'context');
        return{element:{namespaceUri:uri===null?null:text(uri),localName:text(own(element,'localName'))},
          context:{kind:text(own(context,'kind')),parameters:cells(own(context,'parameters'),128).map(text),
            variadic:own(context,'variadic')}};
      })};
    const checkedInline=validateXmlInlineProfile(inlineProfile);
    const luaInputProfile=own(input,'luaInputProfile');requireValue(['bounded','corpus-files'].includes(luaInputProfile));
    // These actual SDK probes establish context applicability, not graph/parser coverage.
    requireValue(resolveGlobalRegistry(environment,[],conditionPolicy).complete===true);
    requireValue(selectTocVariant(environment,'profile-validation','Profile',[],selectionPolicy).status==='no-match');
    const context=freeze({request:{profile:graph.profile,environment,selectionPolicy,conditionPolicy,xmlPolicy,
      inlineProfile:checkedInline,luaInputProfile},stringUnits});
    prepared.add(context);return context;
  }catch{throw new GraphContextError();}
}

/** Conditions/source come from independently validated parser projections, never a registry declaration. */
export function evaluateReferenceGuard(context,conditions,source){
  getGraphRequest(context);
  return evaluateGlobalConditions({name:'reference-guard',addonId:'reference-guard',kind:'lua-global',source,
    activationState:conditions.length?'conditional':'unconditional',conditions},
  context.request.environment,context.request.conditionPolicy);
}

/** Internal port: callers cannot substitute a lookalike mutable request after preflight. */
export function getGraphRequest(context){requireValue(prepared.has(context));return context.request;}
