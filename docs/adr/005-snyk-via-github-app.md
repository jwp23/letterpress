# ADR-005: Snyk runs via its GitHub App integration, not a pinned-CLI workflow

Date: 2026-09-14

## Context

ADR-004 decided to run Snyk Code from a pinned CLI in a workflow file
(`snyk.yml`), explicitly rejecting Snyk's GitHub App import so that scan
scope, severity threshold, and scanner version would live in git rather than
Snyk's web UI. Implementing that workflow required a `SNYK_TOKEN` repository
secret.

Generating that token surfaced a constraint ADR-004 didn't account for: Snyk
Personal Access Tokens cap at 90 days by design. The CI/CD-appropriate
alternative — a non-expiring OAuth 2.0 service account — is a feature gated
to Snyk's Enterprise tier, which this project's account does not have. A
manually-rotated 90-day token is a real operational risk for a low-traffic
personal project: the token silently expires, `snyk code test` fails auth,
the check goes red for a reason unrelated to actual findings, and nobody
notices until they need to merge something.

## Decision

Run Snyk via its built-in GitHub App integration instead of a CLI workflow:

- Remove `snyk.yml` and the `SNYK_TOKEN` repository secret entirely.
- Connect the Snyk GitHub App to jwp23/letterpress with its "PR checks"
  feature enabled (not just PR comments), so it posts a real, requirable
  status check (`security/snyk (jwp23)`).
- Add `.snyk` at the repo root excluding tooling/config directories
  (`.beads/`, `.claude/`, `.codex/`, `.agents/`) that aren't application
  code, since the App scans whatever the repository contains.

## Trade-offs

- **Gained:** no token to rotate. The App manages its own authentication,
  eliminating the silent-expiry failure mode entirely.
- **Given up:** ADR-004's "every gate is a file in the repository" property,
  for this one check only. Snyk's scan configuration (scope, severity
  threshold, scanner version) now lives in Snyk's web UI rather than git.
  `semgrep.yml` and `sonarqube.yml` are unaffected — they remain file-based,
  secret-authenticated workflows.
- **Given up:** CLI-version pinning. The App runs whatever scanner version
  Snyk deploys server-side, not a version this repository controls.
- **Accepted:** the `security/snyk (jwp23)` check's availability depends on
  Snyk's own service and the GitHub App's permissions staying intact, rather
  than a self-contained file and secret this repository fully owns.
