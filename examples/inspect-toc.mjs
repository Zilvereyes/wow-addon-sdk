/** Usage: node examples/inspect-toc.mjs examples/ZilverUI/ZilverUI_Mainline.toc */
import { readFile } from 'node:fs/promises';
import { parseToc } from '@wow-addon/toc-parser';
import { buildTocGlobalRegistry } from '@wow-addon/toc-metadata-adapter';
import { listGlobals } from '@wow-addon/global-registry';

const filename = process.argv[2];
if (!filename) {
  console.error('Usage: node examples/inspect-toc.mjs <path-to-addon.toc>');
  process.exitCode = 2;
} else {
  try {
    const content = await readFile(filename, 'utf8');
    const parsed = parseToc(content, filename);
    const registry = buildTocGlobalRegistry([parsed.metadata]);
    console.log(JSON.stringify({
      name: parsed.metadata.name,
      client: parsed.metadata.client,
      family: parsed.metadata.clientFamily,
      interfaceVersions: parsed.metadata.interfaceVersions,
      files: parsed.metadata.files,
      savedVariables: parsed.metadata.savedVariables,
      savedVariablesPerCharacter: parsed.metadata.savedVariablesPerCharacter,
      lualsSafeUnconditionalGlobals: listGlobals(registry),
      conditionalDeclarations: parsed.metadata.savedVariableDeclarations
        .filter((d) => d.conditions.length > 0),
      diagnostics: [...parsed.diagnostics, ...registry.diagnostics],
    }, null, 2));
    if (parsed.diagnostics.some((d) => d.severity === 'error')) process.exitCode = 1;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
