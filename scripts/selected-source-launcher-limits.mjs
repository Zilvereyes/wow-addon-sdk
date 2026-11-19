/** Private protocol limits shared by the supervisor and child endpoint. */
export const launcherRequestLimits = Object.freeze({
  'corpus-lua': 128,
  'toc-xml': 32,
  'one-shot': 1,
});
