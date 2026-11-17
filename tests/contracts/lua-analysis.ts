import { analyzeLua, type LuaAnalysisOptions, type LuaAnalysisResult, type LuaAnalysisProfile, type LuaAnalysisContext } from '@wow-addon/lua-analysis';
import { type GlobalDeclaration, type ConditionDescriptor } from '@wow-addon/global-registry';

const options: LuaAnalysisOptions = { addonId: 'caller/opaque', conditions: [] };
const profile: LuaAnalysisProfile = 'corpus';
const expanded: LuaAnalysisOptions = { addonId: 'caller', profile, allowShebang: true };
const handler: LuaAnalysisContext = { kind: 'function-body', parameters: ['self'], variadic: false };
const contextual: LuaAnalysisOptions = { addonId: 'caller', context: handler };
// @ts-expect-error function-body requires explicit variadic permission
const missingVariadic: LuaAnalysisContext = { kind: 'function-body', parameters: [] };
// @ts-expect-error function-body requires explicit parameter list
const missingParameters: LuaAnalysisContext = { kind: 'function-body', variadic: true };
// @ts-expect-error context fields are readonly
handler.variadic = true;
// @ts-expect-error parameter list is readonly
handler.parameters.push('other');
void [contextual, missingVariadic, missingParameters];
// @ts-expect-error only the two approved named profiles exist
const unsupportedProfile: LuaAnalysisProfile = 'unbounded';
// @ts-expect-error profile selection is readonly
expanded.profile = 'bounded';
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
void [version, declarations, missing, unsupportedProfile];
