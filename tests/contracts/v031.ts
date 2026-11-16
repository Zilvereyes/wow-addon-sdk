import { WoWClient, WoWGameMode, type ClientEnvironment } from '@wow-addon/addon-metadata';
import {
  selectTocVariant, type TocSelectionPolicy, type TocSelectionCandidate,
  type TocSelectionIssue, type TocSelectionResult,
} from '@wow-addon/toc-metadata-adapter';

const environment: ClientEnvironment = { schemaVersion: 1, client: WoWClient.ClassicEra, clientFamily: 'classic' };
const policy: TocSelectionPolicy = {
  schemaVersion: 1, id: 'authored-test-policy', client: WoWClient.ClassicEra,
  clientFamily: 'classic', suffixPrecedence: ['Vanilla', 'Classic', null],
  gameType: 'caller-defined-type', gameMode: WoWGameMode.Normal,
};
declare const candidates: readonly TocSelectionCandidate[];
const result: TocSelectionResult = selectTocVariant(environment, 'install/addon', 'Addon', candidates, policy);
const issue: TocSelectionIssue = { code: 'TOCSEL0001', message: 'Invalid input', sources: [] };
void [result, issue];
// @ts-expect-error policy schema is a literal 1
const wrongSchema: TocSelectionPolicy = { ...policy, schemaVersion: 2 };
// @ts-expect-error suffix priorities are required
const missingPriority: TocSelectionPolicy = { schemaVersion: 1, id: 'x', client: WoWClient.Retail, clientFamily: 'mainline' };
// @ts-expect-error omission represents an unconstrained mode
const undefinedMode: TocSelectionPolicy = { ...policy, gameMode: undefined };
// @ts-expect-error policy fields are readonly
policy.id = 'other';
// @ts-expect-error priority list is readonly
policy.suffixPrecedence.push('TBC');
// @ts-expect-error result fields are readonly
result.status = 'invalid';
// @ts-expect-error issue source array is readonly
issue.sources.push({ file: 'x', range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } } });
// @ts-expect-error issues use documented codes
const unknownCode: TocSelectionIssue = { code: 'OTHER', message: 'x', sources: [] };
