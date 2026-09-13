# Frontmatter is preserved verbatim and edited as raw YAML

Date: 2026-09-13

## Decision

The frontmatter block is kept byte for byte and shown as a plain text block
above the editor. Letterpress reads only the `title:` line, for display as
the post heading, and never parses or rewrites the rest.

## Rationale

A form would put the site's frontmatter schema into the editor's config and
require faithful YAML round-tripping of every field type. Read-only
frontmatter would stop a new post from being started in Letterpress. Raw
text is the least code and cannot corrupt a field it does not understand.
