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
    'xml-parser'
];

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

for (const name of packages) {
    const configPath = path.join(
        root,
        'packages',
        name,
        'api-extractor.json'
    );

    if (!fs.existsSync(configPath)) {
        console.error(`Missing API Extractor configuration: ${configPath}`);
        process.exit(1);
    }

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
