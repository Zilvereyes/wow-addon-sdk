/** Trusted native composition. No host methods or executables come from profiles. */
import {performance} from 'node:perf_hooks';
import {createGraphFileHost} from './selected-source-native.mjs';
import {createGraphAnalyzer} from './selected-source-analysis-client.mjs';
import {createGraphBudget, bindGraphHostBudget} from './selected-source-budget.mjs';

export async function createSelectedSourceHost(root, context, {now = () => performance.now(), ...nativeOptions} = {}) {
  const budget = createGraphBudget(context, {now});
  const files = await createGraphFileHost(root, context, {...nativeOptions, now, budget, transientHandoffs: true});
  const analyzer = createGraphAnalyzer({now, cleanupDeadline: budget.cleanupDeadline});
  const host = {
    listDirectory: files.listDirectory, verifyDirectory: files.verifyDirectory,
    readSource: files.readSource, verifySource: files.verifySource,
    releaseHandoff: files.releaseHandoff,
    analyze: request => analyzer.analyze(request, budget.remaining()),
    nowMilliseconds: now,
    async close() {
      const results = await Promise.allSettled([analyzer.close(), files.close()]);
      if (results.some(result => result.status === 'rejected')) throw Error('graph-host-close');
    },
  };
  bindGraphHostBudget(host, budget, context); return host;
}
