/** One private operation ledger shared by native I/O and graph retention. */
import {performance} from 'node:perf_hooks';
import {getGraphRequest} from './selected-source-context.mjs';

const ledgers = new WeakMap(), hosts = new WeakMap();
export class GraphBudgetError extends Error {
  constructor(limit) {super('Selected-source graph budget exceeded.'); this.code = 'SGRAPH0005'; this.limit = limit;}
}
const integer = value => Number.isSafeInteger(value) && value >= 0;
const projectionError = () => Object.assign(Error('Invalid graph owned projection.'), {code: 'SGRAPH0007'});
export function createGraphBudget(context, {now = () => performance.now(), accountContext = true} = {}) {
  const request = getGraphRequest(context), limits = request.profile.limits;
  const counters = Object.fromEntries(Object.keys(limits).filter(key => !['operationMilliseconds', 'pathUnits'].includes(key)).map(key => [key, 0]));
  const began = now(); let last = began;
  if (!Number.isFinite(began)) throw new GraphBudgetError('operationMilliseconds');
  const check = () => {
    const current = now();
    if (!Number.isFinite(current) || current < last || current - began >= limits.operationMilliseconds) throw new GraphBudgetError('operationMilliseconds');
    last = current; return limits.operationMilliseconds - (current - began);
  };
  function use(key, count) {
    check();
    if (!Object.hasOwn(counters, key) || !integer(count) || count > limits[key] - counters[key]) throw new GraphBudgetError(key);
    counters[key] += count;
  }
  function release(key, count) {
    if (!Object.hasOwn(counters, key) || !integer(count) || count > counters[key]) throw new Error('Invalid graph budget release.');
    counters[key] -= count;
  }
  function retain(records, units) {
    check();
    if (!integer(records) || records > limits.retainedRecords - counters.retainedRecords) throw new GraphBudgetError('retainedRecords');
    if (!integer(units) || units > limits.retainedStringUnits - counters.retainedStringUnits) throw new GraphBudgetError('retainedStringUnits');
    counters.retainedRecords += records; counters.retainedStringUnits += units;
  }
  const ledger = {
    check, remaining: check, use, release, retain,
    remainingReadBytes: () => limits.readBytes - counters.readBytes,
    metrics: () => ({...counters}),
    /** Reserve each owned record/string before copying. An incomplete copy never escapes. */
    copy(input) {
      let records = 0, units = 0;
      function reserve(r, u) {retain(r, u); records += r; units += u;}
      function copy(value, depth = 0) {
        check(); if (depth > 64) throw projectionError();
        if (typeof value === 'string') {reserve(0, value.length); return value;}
        if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
        if (typeof value !== 'object' || value === null) throw projectionError();
        reserve(1, 0);
        if (Array.isArray(value)) {
          const length = value.length;
          if (!integer(length) || length > limits.retainedRecords) throw new GraphBudgetError('retainedRecords');
          const result = [];
          for (let i = 0; i < length; i++) {
            if (!Object.hasOwn(value, i)) throw projectionError();
            const cell = value[i];
            if (cell === null || typeof cell !== 'object') reserve(1, 0);
            result.push(copy(cell, depth + 1));
          }
          return result;
        }
        const keys = Object.keys(value), result = {};
        if (keys.length > 128) throw projectionError();
        for (const key of keys) {
          reserve(0, key.length);
          Object.defineProperty(result, key, {value: copy(value[key], depth + 1), enumerable: true, writable: true, configurable: true});
        }
        return result;
      }
      try {return copy(input);}
      catch (error) {release('retainedRecords', records); release('retainedStringUnits', units); throw error;}
    },
  };
  const identity = JSON.stringify(request); ledgers.set(ledger, identity);
  if (accountContext) retain(1, context.stringUnits + identity.length);
  return Object.freeze(ledger);
}

export function requireGraphBudget(budget, context) {
  if (!ledgers.has(budget) || ledgers.get(budget) !== JSON.stringify(getGraphRequest(context))) throw Error('Invalid shared graph budget.');
  return budget;
}
export function bindGraphHostBudget(host, budget, context) {hosts.set(host, requireGraphBudget(budget, context));}
export function graphHostBudget(host, context) {const budget = hosts.get(host); return budget ? requireGraphBudget(budget, context) : null;}
