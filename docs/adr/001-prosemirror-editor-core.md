# ADR-001: ProseMirror with prosemirror-markdown as the editor core

Date: 2026-09-13

## Context

Letterpress is an inline Markdown editor: the author types directly into a
rendering of the post that wears the target site's own stylesheet and fonts.
That makes two properties of the editor core decisive:

- The rendered DOM must be plain semantic HTML (`h2`, `p`, `blockquote`,
  `ul`, `pre`) with no framework styling, so the site's CSS applies unchanged.
- Markdown must round-trip. The document is loaded from a Markdown file and,
  with autosave, written back on every pause, so the serializer's output
  style has to be controllable per node.

Three candidates were considered: ProseMirror used directly with
`prosemirror-markdown`, Milkdown, and Tiptap with a Markdown extension. All
three are built on ProseMirror.

## Decision

Use ProseMirror directly with `prosemirror-markdown` for the schema, parser
(markdown-it), and serializer, and `prosemirror-example-setup` for keymaps and
input rules.

## Trade-offs

- **Gained:** the smallest dependency surface, a DOM we fully control, no
  theme layer to strip, and a serializer whose per-node style is configurable
  so a no-op round-trip yields a clean diff.
- **Given up:** Milkdown's remark ecosystem, notably GFM tables out of the box,
  and Tiptap's larger community and documentation. Tables and other GFM
  extensions must be added by hand if the target site ever needs them.
- **Accepted:** the editor parses with markdown-it while Astro builds with
  remark. They agree on CommonMark and common GFM; edge cases can differ, and
  the site build remains the authority on the final HTML. An optional
  Astro-pipeline fidelity mode is a possible later addition, not part of v1.
