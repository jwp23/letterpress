# Mutation Testing

Mutation testing (StrykerJS) guards test quality where a weak test corrupts a
user's post. Three layers catch surviving mutants: a required CI check, a
pre-push hook, and a write-time local run.
The design mirrors `spe`'s cargo-mutants pipeline where the reasons carry over
and drops the parts that only existed because a Rust run took hours. ADR-006
records the tool choice and the toolchain pins.

## Enforcement scope

`stryker.config.json` at the repository root is the single definition of scope.
It mutates every TypeScript file under `src/` and `client/` except `*.test.ts`.
Every layer reads this one file, so scope cannot drift between them.

Outside scope by omission, as entry-point plumbing with no logic worth
guarding:

- `bin/letterpress.js`, which calls `runCli`.
- `scripts/`, the smoke script and git-hook helpers.
- `dist/`, build output.

Because scope is defined once and excluded mutants are dropped from the score,
every survivor any layer reports is actionable.

## Pass criterion

Zero unexcluded survivors. `thresholds.break` is 100, so any surviving or
uncovered mutant fails the run. Timeouts count as killed, Stryker's default.
There is no percentage target: the goal is that every in-scope mutant is either
killed by a test or excluded with a reason.

## Layer 1 — CI gate (required check)

A `mutation` job in `ci.yml` runs `stryker run` on every pull request to `main`
and every push to `main`. It has the same shape as the other Node jobs: pinned
checkout without credentials, `setup-node` with the npm cache, `npm ci`, then
Stryker. It declares no `needs`, so it runs in parallel with the other jobs.

The job always mutates the whole in-scope tree. `spe` restricts its gate to the
pull request's diff and shards the rest across runners because a full
cargo-mutants run takes about three hours; here the full run takes seconds on
a workstation and minutes at most on a hosted runner, so diff scoping and
sharding would add machinery without saving time. A check that always runs always reports a status, which
is what branch protection needs.

The check is required. A survivor fails the pull request: add a test that kills
it, or exclude it with a reason (see Equivalence policy).

## Layer 2 — pre-push hook

`scripts/pre-push-checks.sh` runs the same `stryker run` and rejects the push
on any survivor. `.githooks/pre-push` (contributors) and `.beads/hooks/pre-push`
(maintainers running beads) both exec that one script, following the
pre-commit pattern, so the two entry points cannot drift.

The hook runs the full in-scope set on every push, without a diff check. On a
development machine the run takes well under a minute, and a diff check is the
same machinery the CI gate deliberately omits.

## Layer 3 — write-time local run

`npm run mutate` runs Stryker with the repository config. Run it while writing
tests for a change; the pre-push hook and the CI gate back it up.

## Equivalence policy

A mutant that no reasonable test can kill is excluded, never chased:

- Exclusions are inline Stryker disable comments on the line they excuse, and
  each carries a reason:

  ```ts
  // Stryker disable next-line StringLiteral: a wrong MIME string is a browser
  // rendering quirk, not corrupted post content; a test per literal guards nothing.
  '.svg': 'image/svg+xml',
  ```

  The comment moves with the code, so no exclusion goes stale the way a pinned
  line and column would. `grep -rn "Stryker disable"` lists every exclusion.
- Adding an exclusion is a reviewed change on the pull request that needs it,
  so the escape hatch is visible in review, not silent.
- Stryker has no per-mutant exclusion list in config, and disabling a mutator
  type globally (all `StringLiteral` mutants, say) would also stop guarding
  error messages and config keys. Inline comments are the precise option.

Expected exclusions from the baseline run: the MIME-type table in
`src/server.ts` and the browser command strings in `src/browser.ts`.

## Reporting

Reporters are `clear-text` and `json`. The clear-text report prints each
survivor with its diff in the job log or terminal, which is enough to act on.
The JSON report under `reports/mutation/` supports local triage; that
directory and Stryker's `.stryker-tmp/` sandbox are git-ignored. No HTML report, incremental cache, weekly sweep, or survivor
tracking issue: the full run is fast enough that every pull request already
does what `spe`'s weekly run exists to do.

## Toolchain constraints

Two settings exist only because of upstream incompatibilities and should be
removed when the upstream fixes ship. ADR-006 records both.

- **vitest pinned to 4.x.** Under vitest 5, `@stryker-mutator/vitest-runner`
  10.0.0 runs zero tests against every covered mutant and reports them all as
  survived (stryker-js issue #6210). The failure mode is a silently collapsed
  score, not an error, so a gate on vitest 5 would be wrong without looking
  wrong. `package.json` pins `vitest` and `@vitest/coverage-v8` to `^4`, and
  `dependabot.yml` ignores vitest major updates so the pin is not undone by a
  routine bump.
- **`tsconfigFile` names a file that does not exist.** Stryker's tsconfig
  rewriter calls a TypeScript API that TypeScript 7 removed, and crashes. The
  rewriter only fixes up `extends` and `references` paths inside the sandbox;
  this project's tsconfig has neither, so skipping it changes nothing.

## Baseline

Measured on `main` at f2a0d7d with Stryker 10.0.0 and vitest 4.1.11, 20 cores:

| File             | Mutants | Killed | Timeout | Survived | No coverage |
| ---------------- | ------: | -----: | ------: | -------: | ----------: |
| `src/server.ts`  |     119 |     71 |      18 |       25 |           5 |
| `client/main.ts` |      81 |     52 |       0 |       22 |           7 |
| `src/config.ts`  |      54 |     40 |       2 |       10 |           2 |
| `src/frontmatter.ts` |  65 |     56 |       0 |        9 |           0 |
| `src/cli.ts`     |      49 |     39 |       0 |        6 |           4 |
| `src/browser.ts` |      14 |      9 |       0 |        5 |           0 |
| `src/markdown.ts` |     60 |     56 |       4 |        3 |           0 |
| `src/errors.ts`  |       2 |      2 |       0 |        0 |           0 |

445 mutants in all. The `src/` run alone took 31 seconds, so a hosted 4-core
runner should finish the whole set in a few minutes at most.
The gate cannot become required until the 98 surviving and uncovered mutants
are killed or excluded; that kill-off is the bulk of epic letterpress-3yw.
