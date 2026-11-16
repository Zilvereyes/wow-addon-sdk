import {
  type ConditionDescriptor, type GlobalDeclaration, buildGlobalRegistry,
} from '@wow-addon/global-registry';

const source = { file: 'Fixture/Fixture.toc', range: { start: { line: 0, column: 0 }, end: { line: 0, column: 1 } } };
const descriptor: ConditionDescriptor = {
  providerId: 'authored-provider', name: 'FutureRule', values: ['Opaque'], raw: '[FutureRule Opaque]', source,
};
const legacy: GlobalDeclaration = { name: 'DB', addonId: 'A', kind: 'saved-variable', activationState: 'conditional', source };
const annotated: GlobalDeclaration = { ...legacy, conditions: [descriptor] };
buildGlobalRegistry([legacy, annotated]);
// Existing SourceReference remains shallowly mutable; adapter output copies it.
descriptor.source.range.start.column = 1;
// @ts-expect-error provider identity is required
const missingProvider: ConditionDescriptor = { name: 'x', values: [], raw: 'x', source };
// @ts-expect-error values are strings
const numericValue: ConditionDescriptor = { ...descriptor, values: [1] };
// @ts-expect-error new descriptor fields are readonly
descriptor.name = 'changed';
// @ts-expect-error new value array is readonly
descriptor.values.push('changed');
// @ts-expect-error the optional declaration field is readonly
annotated.conditions = [];
// @ts-expect-error the optional declaration array is readonly
annotated.conditions?.push(descriptor);
// @ts-expect-error omit an unavailable optional field under exact optional types
const explicitUndefined: GlobalDeclaration = { ...legacy, conditions: undefined };
void [missingProvider, numericValue, explicitUndefined];
