#!/usr/bin/env sh
# Strip the Claude-Session trailer from commit messages before validation.
# The trailer is a harness attribution convention that conflicts with this
# project's single-line-no-body commit rule; the session URL belongs in the
# PR description instead (per check-commit-msg.sh's own error text).

msg_file="$1"

# Filter out any line starting with 'Claude-Session:' using grep -v
# Write to a temp file for BSD/GNU portability (not sed -i)
tmp_file=$(mktemp)
grep -v '^Claude-Session:' "$msg_file" > "$tmp_file"

# Trim trailing blank line(s) left behind by the removed trailer
# Classic sed trailing-blank-line trim
sed -e :a -e '/^[[:space:]]*$/{ $d; N; ba' -e '}' "$tmp_file" > "$msg_file"

# Clean up
rm -f "$tmp_file"
