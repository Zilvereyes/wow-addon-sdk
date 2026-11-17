#!/usr/bin/env node

/**
 * Run API Extractor for all public SDK packages.
 *
 * Cross-platform:
 * - Windows PowerShell / CMD
 * - Linux
 * - Node.js 22+
 *
 * Invokes the CLI using Node directly, without a shell.
 * This supports repository paths containing spaces.
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    '..'
);

const local = process.argv.includes('--local');

const packages = [
    'diagnostics',
    'addon-metadata',
    'toc-parser',
    'global-registry',
    'toc-metadata-adapter',
    'lua-analysis',
    'xml-parser',
    'xml-analysis'
];

// A successful CLI exit only proves report comparison when the reviewed entry,
// enabled report and distinct committed/temporary destinations remain active.
// Reject inherited settings and extra overrides as well as changed values.
const reviewedConfig = {
    $schema: 'https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json',
    newlineKind: 'lf',
    mainEntryPointFilePath: '<projectFolder>/dist/index.d.ts',
    apiReport: {
        enabled: true,
        reportFolder: '<projectFolder>/etc',
        reportTempFolder: '<projectFolder>/temp',
        reportFileName: '<unscopedPackageName>'
    },
    docModel: { enabled: false },
    dtsRollup: { enabled: false },
    tsdocMetadata: { enabled: false }
};

function matchesReviewedConfig(actual, expected) {
    if (expected === null || typeof expected !== 'object') return actual === expected;
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
    const keys = Object.keys(expected);
    return Object.keys(actual).length === keys.length && keys.every(key =>
        Object.hasOwn(actual, key) && matchesReviewedConfig(actual[key], expected[key]));
}

// Preflight every package before invoking any CLI, including --local runs that
// deliberately update committed reports. A later bad config must not allow an
// earlier package's report to be rewritten first.
const configPaths = packages.map(name => path.join(root, 'packages', name, 'api-extractor.json'));
for (const configPath of configPaths) {
    if (!fs.existsSync(configPath)) {
        console.error(`Missing API Extractor configuration: ${configPath}`);
        process.exit(1);
    }
    let config;
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); }
    catch {
        console.error(`unreviewed API Extractor configuration: ${configPath}`);
        process.exit(1);
    }
    if (!matchesReviewedConfig(config, reviewedConfig)) {
        console.error(`unreviewed API Extractor configuration: ${configPath}`);
        process.exit(1);
    }
}

// Resolve the actual npm package CLI instead of the .cmd wrapper.
const packageDirectory = path.join(
    root,
    'node_modules',
    '@microsoft',
    'api-extractor'
);

const manifestPath = path.join(packageDirectory, 'package.json');

if (!fs.existsSync(manifestPath)) {
    console.error('API Extractor is not installed. Run npm ci first.');
    process.exit(1);
}

const manifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf8')
);

const cliRelativePath =
    typeof manifest.bin === 'string'
        ? manifest.bin
        : manifest.bin?.['api-extractor'];

if (!cliRelativePath) {
    console.error('Cannot resolve API Extractor CLI entry point.');
    process.exit(1);
}

const cliPath = path.resolve(packageDirectory, cliRelativePath);

if (!fs.existsSync(cliPath)) {
    console.error(`API Extractor CLI not found: ${cliPath}`);
    process.exit(1);
}

for (const [index, name] of packages.entries()) {
    const configPath = configPaths[index];

    console.log(`\n=== API Extractor: ${name} ===`);

    const args = [
        cliPath,
        'run',
        '--config',
        configPath
    ];

    if (local) {
        args.push('--local');
    }

    const result = spawnSync(process.execPath, args, {
        cwd: root,
        stdio: 'inherit',
        shell: false,
        windowsHide: true
    });

    if (result.error) {
        console.error(result.error);
        process.exit(1);
    }

    if (result.signal) {
        console.error(`API Extractor terminated: ${result.signal}`);
        process.exit(1);
    }

    if (result.status !== 0) {
        console.error(`API Extractor failed for ${name}`);
        process.exit(result.status ?? 1);
    }
}

console.log(`\nAPI Extractor completed for all ${packages.length} packages.`);
