# ADR-004: CI pipeline mirrors spe's, translated to the Node toolchain

Date: 2026-09-13

> Superseded (in part) 2026-09-14 by ADR-005: Snyk now runs via its GitHub
> App integration rather than a pinned-CLI workflow.

## Context

Letterpress has no continuous integration. The sibling project spe has a
security-focused GitHub Actions pipeline: secrets scanning, a Conventional
Commits gate on pull request titles, formatting, dependency audit, tests and
lint, license and SBOM checks with a vulnerability scan, Semgrep, SonarQube
with coverage, Dependabot, and local git hooks that run the same checks. Its
Rust-specific steps have no meaning here, but every gate has a Node
equivalent.

The choice was how closely to follow spe: mirror its file layout and job
names job for job, collapse everything into one workflow file, or extract
shared reusable workflows into an organisation repository that both projects
call.

## Decision

Mirror spe's layout and gate set, translating each Rust step to its Node
counterpart:

- `ci.yml` with jobs secrets, pr-title, fmt, audit, check, supply-chain.
- `semgrep.yml` and `sonarqube.yml` as separate workflows, skipped for
  Dependabot runs, each needing a repository secret.
- `snyk.yml`, new relative to spe: Snyk Code as a second SAST engine beside
  Semgrep and SonarQube, blocking, run from a pinned CLI in a workflow rather
  than through Snyk's GitHub app import so the gate lives in git.
- `dependabot.yml` for npm and github-actions, weekly, minor and patch
  updates grouped.
- Scripts under `scripts/` and hooks under `.githooks/`, with spe's names,
  and the beads-managed hooks calling the same scripts.
- Every action pinned to a commit SHA, `permissions: {}` at the workflow
  level, and `persist-credentials: false` on checkout.
- `licensee` enforces a license allowlist in place of cargo-deny.
- Mutation testing stays out. A follow-on epic can bring Stryker in.
- No deployment stage. Letterpress is installed with `npm link`.

## Trade-offs

- **Gained:** a pipeline that reads the same as spe's, so a fix or a
  Dependabot bump in one repository maps directly onto the other, and the
  same security posture from the first pull request.
- **Given up:** the brevity of a single workflow file. Semgrep and SonarQube
  stay in their own files so the self-contained gates never depend on a
  secret.
- **Rejected:** shared reusable workflows. Two repositories with different
  toolchains do not justify a third repository to version and pin.
- **Accepted:** the Semgrep, SonarQube, and Snyk scans stay red until their
  secrets are added by hand.
- **Accepted:** three SAST engines means three places to triage a false
  positive. Snyk Code was chosen for its dataflow analysis of JavaScript and
  TypeScript; whether it outperforms the other two on this codebase is
  unmeasured.
- **Rejected:** Snyk's GitHub app import. Its scan scope, severity threshold,
  and scanner version live in Snyk's web UI, not in the repository, and its
  fix pull requests duplicate Dependabot.
