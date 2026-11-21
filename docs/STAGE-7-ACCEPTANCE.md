# Stage 7 evidence checklist

[Issue #11](https://github.com/Zilvereyes/wow-addon-sdk/issues/11) tracks acceptance of the selected-source graph against the opt-in local corpus. Preserve the scope, budgets and acceptance policy approved in that issue.

## Record each run

- Bind the source commit, Node version, addon client and build, profile digests, and workload to the report.
- Record the run mode as a full invocation or a sum of per-group invocations. For resumed groups, record the number reused and the number run again.
- Report selected sources, returned parser verdicts, rejected files, diagnostic occurrences and final source and directory integrity separately. A bounded run may report partial coverage.
- Retain timings and sampled parent and worker RSS with the sampling interval. Compare performance on the same workload and runtime.
- Record failures using stable codes. List unrelated directory churn as a hypothesis when the run does not establish its cause.
- Export counts and fixed error categories. Keep user paths, addon names, source bytes and local profile files out of public evidence.

## Review sequence

1. Review the resumable runner in [PR #48](https://github.com/Zilvereyes/wow-addon-sdk/pull/48).
2. Review the integrity observer in [#51](https://github.com/Zilvereyes/wow-addon-sdk/pull/51), rejection fixtures in [#52](https://github.com/Zilvereyes/wow-addon-sdk/pull/52), and failure phase/subcode reporting in [#53](https://github.com/Zilvereyes/wow-addon-sdk/pull/53) at their actual base and head commits.
3. Report synthetic CI results and installed-corpus results independently. Update #11 with the remaining acceptance gaps and explicit scope of each result.
4. Evaluate editor dependencies separately. The VS Code extensions pin the SDK by commit, and this evidence process does not require changing that pin.

The active SDK pack and node_modules directories are reproducible from the locked inputs. Use an isolated clone for acceptance checks and write receipts outside the input tree.
