# ADR-006: Mutation testing runs Stryker over the whole tree as a required check

Date: 2026-09-13

## Context

`spe` guards test quality with cargo-mutants: a diff-scoped, sharded PR gate
plus a weekly full-scope sweep that files a survivor tracking issue
(`../spe/docs/designs/mutation-testing.md`). Letterpress wants the same
guarantee, that every in-scope mutant is killed or excluded with a reason, and
the CI pipeline epic (ADR-004) deliberately left mutation testing for its own
design pass.

The Node equivalent is StrykerJS with its vitest runner. A probe on `main` at
f2a0d7d measured the cost: 445 mutants across `src/` and `client/`, the `src/`
run finishing in 31 seconds on 20 cores, against a cargo-mutants full run of
about three hours. The probe also found two toolchain conflicts:

- Under vitest 5.0.0, `@stryker-mutator/vitest-runner` 10.0.0 runs zero tests
  against every covered mutant and reports a 3% score where vitest 4.1.11
  reports 81%. Vitest 5 changed `testNamePattern` to match the suite chain
  joined with `>`, and the runner still joins with a space (stryker-js issue
  #6210, open, no fix released).
- Stryker's tsconfig rewriter calls `ts.parseConfigFileTextToJson`, which
  TypeScript 7's native compiler no longer exports, and crashes before mutating
  anything.

## Decision

- Adopt `@stryker-mutator/core` and `@stryker-mutator/vitest-runner` 10.0.0 as
  devDependencies, with one `stryker.config.json` defining scope for every
  layer.
- Run the full in-scope set on every pull request and push to `main`, as a
  `mutation` job in `ci.yml`. No diff scoping, no sharding, no weekly sweep, no
  survivor issue: at this cost every pull request already does what the weekly
  run exists to do in `spe`.
- Fail on any unexcluded survivor (`thresholds.break: 100`), with no
  percentage target. The gate becomes required once the baseline's 98
  surviving and uncovered mutants are killed or excluded.
- Exclude equivalent mutants with inline `// Stryker disable` comments that
  carry a reason, reviewed on the pull request that adds them.
- Enforce locally with a pre-push hook that runs the same command, wired
  through `scripts/pre-push-checks.sh` the way pre-commit already is.
- Pin `vitest` and `@vitest/coverage-v8` to `^4` and have Dependabot ignore
  vitest major updates until the runner supports vitest 5.
- Point `tsconfigFile` at a name that does not exist so the rewriter is skipped;
  this project's tsconfig has no `extends` or `references` for it to rewrite.

## Trade-offs

- **Gained:** `spe`'s guarantee with one job and one config file, and a check
  that reports a status on every pull request.
- **Given up:** vitest 5 for as long as issue #6210 stays open. A downgrade
  against Dependabot's grain, held by an explicit ignore rule; both the pin and
  the rule are marked for removal.
- **Given up:** `spe`'s single-file exclusion list. Stryker has no per-mutant
  config exclusion, so exclusions live next to the code with a grep as the
  inventory. In exchange, an exclusion cannot go stale on an unrelated edit.
- **Accepted:** the `tsconfigFile` workaround relies on the tsconfig staying
  free of `extends` and `references`. If either is added, the rewriter matters
  again and the TypeScript 7 conflict returns.
- **Accepted:** the pre-push hook adds well under a minute to every push,
  without a diff check. Adding one later is the cheap fix if it grows.
