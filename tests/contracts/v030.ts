import {
  CLIENT_ENVIRONMENT_SCHEMA_VERSION, WoWClient, WoWGameMode,
  type ClientEnvironment, type AddOnIdentity, type TocVariantIdentity,
} from '@wow-addon/addon-metadata';
import type { SourceReference } from '@wow-addon/diagnostics';

const environment: ClientEnvironment = {
  schemaVersion: CLIENT_ENVIRONMENT_SCHEMA_VERSION,
  client: WoWClient.Unknown, clientFamily: 'classic',
};
const explicit: ClientEnvironment = {
  ...environment, gameMode: WoWGameMode.Hardcore,
  gameType: 'future-type', textLocale: 'future-locale',
};
const identity: AddOnIdentity = { logicalAddonId: 'workspace/Å🧪' };
const source: SourceReference = {
  file: 'Å/Å_Vanilla.toc',
  range: { start: { line: 0, column: 0 }, end: { line: 0, column: 2 } },
};
const variant: TocVariantIdentity = {
  ...identity, tocVariantId: JSON.stringify([identity.logicalAddonId, source.file]),
  tocPath: source.file, tocSuffix: 'Vanilla', source,
};
const unsuffixed: TocVariantIdentity = { ...variant, tocSuffix: null };
void [explicit, unsuffixed];
// @ts-expect-error schemaVersion is required
const missingVersion: ClientEnvironment = { client: WoWClient.Unknown, clientFamily: 'unknown' };
// @ts-expect-error schema 2 is metadata, not environment
const wrongVersion: ClientEnvironment = { ...environment, schemaVersion: 2 };
// @ts-expect-error specific client is required
const missingClient: ClientEnvironment = { schemaVersion: 1, clientFamily: 'classic' };
// @ts-expect-error family is required
const missingFamily: ClientEnvironment = { schemaVersion: 1, client: WoWClient.Unknown };
// @ts-expect-error omission represents unknown; explicit undefined is not a value
const undefinedMode: ClientEnvironment = { ...environment, gameMode: undefined };
// @ts-expect-error environment fields are readonly
environment.client = WoWClient.Retail;
// @ts-expect-error logical identity is readonly
identity.logicalAddonId = 'other';
// @ts-expect-error variant path is readonly
variant.tocPath = 'other.toc';
// @ts-expect-error suffix is explicit even when absent
const missingSuffix: TocVariantIdentity = { logicalAddonId: 'A', tocVariantId: 'A', tocPath: 'A.toc', source };
