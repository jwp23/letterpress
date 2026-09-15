#!/usr/bin/env sh
# Mutation testing before every push.
#
# Invoked by .githooks/pre-push (contributors) and by .beads/hooks/pre-push
# (maintainers running the beads issue tracker). Both entry points call this one
# script so the checks cannot drift apart.
#
# Runs the full in-scope set: it takes well under a minute locally, and a diff
# guard is the machinery the CI gate deliberately omits
# (docs/designs/mutation-testing.md, "Layer 2").
set -u

cd "$(git rev-parse --show-toplevel)" || exit 1

if ! ./node_modules/.bin/stryker run; then
    echo >&2 "pre-push: mutation testing found surviving mutants. Kill them with a test or exclude them with a reason (docs/designs/mutation-testing.md)."
    exit 1
fi
