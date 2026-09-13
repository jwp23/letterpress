# Autosave, not explicit save

Date: 2026-09-13

## Decision

Letterpress writes the file after a 500 ms pause in editing. There is no
save command.

## Rationale

The editor should feel like writing on the page, not operating a tool. The
cost was raised and accepted: the document model is not the Markdown text, so
every write re-serializes the body, and formatting choices such as emphasis
markers are normalized to the serializer's style. Mitigations are a serializer
configured to match the site's existing posts and a test that an untouched
post round-trips with no diff. There is no watcher for outside edits; if
another editor writes the same file, the last writer wins.
