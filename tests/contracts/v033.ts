import { type ResolvedAvailability, type ActivationState, type GlobalDeclaration } from '@wow-addon/global-registry';
import { type ClientEnvironment, WoWClient } from '@wow-addon/addon-metadata';
import {
  evaluateGlobalConditions, type ConditionEvaluationPolicy, type ConditionEvaluationIssue, type ConditionEvaluationResult,
  type ConditionEvaluationRule,
} from '@wow-addon/toc-metadata-adapter';

const environment: ClientEnvironment = { schemaVersion: 1, client: WoWClient.ClassicEra, clientFamily: 'classic' };
const policy: ConditionEvaluationPolicy = {
  schemaVersion: 1, id: 'authored', nameComparison: 'exact', rules: [{
    providerId: 'authored-provider', name: 'Match', field: 'gameType', operator: 'include', valueComparison: 'exact',
  }],
};
// Public rule composition must keep the old inline structural contract.
const reusableRule: ConditionEvaluationRule = policy.rules[0]!;
const reusedPolicy: ConditionEvaluationPolicy = { ...policy, rules: [reusableRule] };
const ruleProjection: ConditionEvaluationPolicy['rules'][number] = reusableRule;
// @ts-expect-error named rules retain readonly fields
reusableRule.name = 'changed';
// @ts-expect-error naming the rule does not admit an unsupported operator
const invalidRule: ConditionEvaluationRule = { ...reusableRule, operator: 'execute' };
declare const declaration: GlobalDeclaration;
const result: ConditionEvaluationResult = evaluateGlobalConditions(declaration, environment, policy);
const availability: ResolvedAvailability = result.availability;
const issue: ConditionEvaluationIssue = { code: 'CONDEVAL0003', message: 'Unsupported', sources: [] };
// @ts-expect-error resolved availability is distinct from declaration-time activation
const staticState: ActivationState = availability;
// @ts-expect-error policy schema is exactly 1
const wrongSchema: ConditionEvaluationPolicy = { ...policy, schemaVersion: 2 };
// @ts-expect-error rule list is required
const missingRules: ConditionEvaluationPolicy = { schemaVersion: 1, id: 'x', nameComparison: 'exact' };
// @ts-expect-error policy properties are readonly
policy.id = 'changed';
// @ts-expect-error rules are readonly
policy.rules.push(policy.rules[0]!);
// @ts-expect-error rule properties are readonly
policy.rules[0]!.operator = 'exclude';
// @ts-expect-error result is readonly
result.availability = 'active';
// @ts-expect-error issue arrays are readonly
issue.sources.push(declaration.source);
// @ts-expect-error unknown issue codes are not accepted
const wrongCode: ConditionEvaluationIssue = { code: 'OTHER', message: 'x', sources: [] };
// @ts-expect-error declaration-time conditional is not resolved availability
const wrongAvailability: ResolvedAvailability = 'conditional';
void [staticState, wrongSchema, missingRules, wrongCode, wrongAvailability,
  reusedPolicy, ruleProjection, invalidRule];
