import { type ClientEnvironment, WoWClient } from '@wow-addon/addon-metadata';
import { type GlobalDeclaration, listGlobals } from '@wow-addon/global-registry';
import {
  type ProviderDeclarationSet, type GlobalResolutionInput, type ResolvedGlobalDeclaration,
  type GlobalResolutionIssue, type ResolvedGlobalRegistry, type ConditionEvaluationPolicy, resolveGlobalRegistry,
} from '@wow-addon/toc-metadata-adapter';
const environment: ClientEnvironment = { schemaVersion: 1, client: WoWClient.ClassicEra, clientFamily: 'classic' };
const conditionPolicy: ConditionEvaluationPolicy = { schemaVersion: 1, id: 'fixture', nameComparison: 'exact', rules: [] };
declare const input: GlobalResolutionInput;
declare const declaration: GlobalDeclaration;
const provider: ProviderDeclarationSet = { providerId: 'fixture', tocVariantId: 'caller-key', declarations: [declaration] };
const result: ResolvedGlobalRegistry = resolveGlobalRegistry(environment, [input], conditionPolicy);
const schema: 1 = result.schemaVersion;
const resolved: ResolvedGlobalDeclaration | undefined = result.entries[0]?.declarations[0];
const issue: GlobalResolutionIssue = { code: 'RESOLVE0001', message: 'Invalid', sources: [] };
// @ts-expect-error source identity is required
const incompleteProvider: ProviderDeclarationSet = { providerId: 'fixture', declarations: [] };
// @ts-expect-error input groups are readonly
input.logicalAddonId = 'changed';
// @ts-expect-error provider contents are readonly
provider.declarations.push(declaration);
// @ts-expect-error active global query is readonly
result.activeGlobals.push('changed');
// @ts-expect-error derived entries are readonly
result.entries[0]!.name = 'changed';
// @ts-expect-error resolved provenance is readonly
result.entries[0]!.declarations[0]!.originalAddonId = 'changed';
// @ts-expect-error result is distinct from a static GlobalRegistry
listGlobals(result);
// @ts-expect-error resolution issues have stable codes
const invalidCode: GlobalResolutionIssue = { code: 'OTHER', message: 'x', sources: [] };
void [schema, resolved, issue, incompleteProvider, invalidCode];
