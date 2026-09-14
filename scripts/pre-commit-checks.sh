#!/usr/bin/env sh
# Project quality checks run before every commit.
#
# Invoked by .githooks/pre-commit (contributors) and by .beads/hooks/pre-commit
# (maintainers running the beads issue tracker). Both entry points call this one
# script so the checks cannot drift apart.
#
# Checks are ordered fastest and most critical first. betterleaks is optional
# locally and warns when missing; CI enforces it for every pull request.
set -u

cd "$(git rev-parse --show-toplevel)" || exit 1

# bd (beads) appends to this file on every issue write, independently of
# whatever commit is in progress, so nothing else ever stages it and it
# drifts out of sync with the commits made during the same session. Auto-
# stage it here so it rides along with whatever commit is already happening.
if ! git diff --quiet -- .beads/interactions.jsonl 2>/dev/null; then
    git add .beads/interactions.jsonl
fi

if command -v betterleaks >/dev/null 2>&1; then
    if ! betterleaks git --pre-commit --staged --redact; then
        echo >&2 "pre-commit: betterleaks detected secrets in staged changes."
        exit 1
    fi
else
    echo >&2 "pre-commit: WARNING: betterleaks not installed — staged changes were not scanned for secrets. Install from https://github.com/betterleaks/betterleaks"
fi

if ! npm run --silent format:check; then
    echo >&2 "pre-commit: prettier check failed. Run 'npm run format' to fix."
    exit 1
fi

if ! npm run --silent typecheck; then
    echo >&2 "pre-commit: typecheck failed."
    exit 1
fi

if ! npm audit; then
    echo >&2 "pre-commit: npm audit found vulnerabilities."
    exit 1
fi

if ! ./node_modules/.bin/licensee --errors-only; then
    echo >&2 "pre-commit: licensee found a dependency with an unapproved license."
    exit 1
fi

if ! ./node_modules/.bin/vitest run; then
    echo >&2 "pre-commit: tests failed."
    exit 1
fi
