/** Trusted native composition. No host methods or executables come from profiles. */
import {performance} from 'node:perf_hooks';
import {createGraphFileHost} from './selected-source-native.mjs';
import {createGraphAnalyzer} from './selected-source-analysis-client.mjs';
import {createGraphBudget, bindGraphHostBudget} from './selected-source-budget.mjs';
import {countFailure, isCorpusFailureCode} from './selected-source-failures.mjs';

export async function createSelectedSourceHost(root, context, {now = () => performance.now(), ...nativeOptions} = {}) {
  const budget = createGraphBudget(context, {now});
  const nativeFailures = {};
  const files = await createGraphFileHost(root, context, {...nativeOptions, now, budget, transientHandoffs: true,
    onFailure(event) {
      if (event.code === 'graph-native-attributes' && isCorpusFailureCode(event.operation, event.subcode)) {
        countFailure(nativeFailures, event.operation, event.subcode);
      }
      nativeOptions.onFailure?.(event);
    },
  });
  const analyzer = createGraphAnalyzer({now, cleanupDeadline: budget.cleanupDeadline});
  const host = {
    listDirectory: files.listDirectory, verifyDirectory: files.verifyDirectory,
    readSource: files.readSource, verifySource: files.verifySource,
    releaseHandoff: files.releaseHandoff,
    analyze: request => analyzer.analyze(request, budget.remaining()),
    nowMilliseconds: now,
    nativeFailures,
    async close() {
      const results = await Promise.allSettled([analyzer.close(), files.close()]);
      const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
      if (failures.length) throw new AggregateError(failures, 'graph-host-close');
    },
  };
  bindGraphHostBudget(host, budget, context); return host;
}
