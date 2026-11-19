import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createSelectedSourceHost} from '../scripts/selected-source-host.mjs';
import {traceSelectedSources} from '../scripts/selected-source-engine.mjs';
import {context} from './selected-source-engine-fixtures.mjs';

async function fixture(run) {
  const temporary = path.resolve(os.tmpdir()), root = fs.mkdtempSync(path.join(temporary, 'wow-sdk-graph-composed-'));
  try {
    fs.mkdirSync(path.join(root, 'Demo'));
    fs.writeFileSync(path.join(root, 'Demo', 'Demo_Vanilla.toc'), 'Core.lua');
    fs.writeFileSync(path.join(root, 'Demo', 'Core.lua'), 'X=1');
    await run(root);
  } finally {
    assert.equal(path.dirname(root), temporary); assert.ok(path.basename(root).startsWith('wow-sdk-graph-composed-'));
    fs.rmSync(root, {recursive: true, force: true});
  }
}
const requested = limits => context(row => {
  row.profile.addons[0].tocPaths = ['Demo/Demo_Vanilla.toc']; row.profile.limits = limits;
});

test('composed native host shares exact payload/probe allowance with graph and integrity reads', () => fixture(async root => {
  // Eleven payload bytes twice; each read must first fit its extra growth probe.
  for (const [allowance, complete, expectedOpens] of [[23, true, 4], [22, false, 3]]) {
    const opened = [], io = {...fs, openSync(name, flags, ...rest) {
      assert.equal(flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC), 0);
      opened.push(name); return fs.openSync(name, flags, ...rest);
    }};
    const input = requested({readBytes: allowance}), host = await createSelectedSourceHost(root, input, {io});
    const trace = await traceSelectedSources(input, host);
    assert.equal(trace.groups[0].resolutionEligible, complete, JSON.stringify({issues: trace.issues,
      group: trace.groups[0], files: [...trace.files.values()], metrics: trace.budget.metrics(), opened}));
    assert.equal(trace.files.size, 2); assert.equal(trace.analyses.length, 2);
    assert.equal(opened.length, expectedOpens);
    assert.equal(trace.budget.metrics().readBytes, complete ? 22 : 19);
    assert.equal(trace.issues.some(row => row.code === 'SGRAPH0005'), !complete);
    const lua = [...trace.files.values()].find(row => row.language === 'lua');
    assert.equal(lua.failureCounts.resource, complete ? 0 : 1); assert.equal(lua.failureCounts.read, 0);
    assert.equal(fs.readFileSync(path.join(root, 'Demo', 'Core.lua'), 'utf8'), 'X=1');
  }
}));

test('composed host operation clock starts before traversal and cannot reset after bootstrap', () => fixture(async root => {
  let now = 0, opened = 0;
  const io = {...fs, openSync(...args) {opened++; return fs.openSync(...args);}};
  const inspectorFactory = () => ({async inspect(paths) {return paths.map(() => ({ok: true, reparsePoint: false}));}, async close() {}});
  const input = requested({operationMilliseconds: 100}), host = await createSelectedSourceHost(root, input, {io, inspectorFactory, now: () => now});
  now = 100;
  const trace = await traceSelectedSources(input, host);
  assert.equal(trace.fatal, 'resource'); assert.equal(opened, 0); assert.deepEqual(trace.analyses, []);
  assert.equal(trace.budget.cleanupDeadline(), 10_100);
  now = 10_100;
  assert.equal(trace.budget.cleanupDeadline(), 10_100);
  assert.throws(() => trace.budget.remaining(), {code: 'SGRAPH0005'});
}));
