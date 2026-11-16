import { analyzeLua, type LuaAnalysisOptions, type LuaAnalysisResult } from '@wow-addon/lua-analysis';
import { type GlobalDeclaration, type ConditionDescriptor } from '@wow-addon/global-registry';

const options: LuaAnalysisOptions = { addonId: 'caller/opaque', conditions: [] };
const result: LuaAnalysisResult = analyzeLua('DB = {}', 'Fixture.lua', options);
const version: 1 = result.schemaVersion;
const declarations: readonly GlobalDeclaration[] = result.declarations;
declare const condition: ConditionDescriptor;
// @ts-expect-error caller identity is required
const missing: LuaAnalysisOptions = {};
// @ts-expect-error options are readonly
options.addonId = 'changed';
// @ts-expect-error inherited restrictions are readonly
options.conditions?.push(condition);
// @ts-expect-error result properties are readonly
result.complete = true;
// @ts-expect-error returned declaration list is readonly
result.declarations.push(declarations[0]!);
// @ts-expect-error no backend AST or execution API is exposed
result.ast;
void [version, declarations, missing];
