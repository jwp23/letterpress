# Letterpress — brainstorm handoff

Write Markdown inside your site's own typography.

## Decided so far (2026-09-13)
- Inline WYSIWYG Markdown editor: type into the rendered page, not source + preview.
- Web page served by a small local Node server; run in a browser app-mode window
  (`chromium --app=http://localhost:PORT`). Tauri wrapper is a possible later step;
  Electron rejected.
- Points at a site checkout, no copying. Config file from day one with only the
  keys this site needs: stylesheet path, static root (for `/fonts/...`), posts
  directory, body wrapper class (`.prose`), theme mechanism (`html.light`).
- Not Astro-specific except an optional fidelity mode that renders with
  `@astrojs/markdown-remark`'s `createMarkdownProcessor`.
- ProseMirror-based editor (Milkdown a candidate) so rendered DOM is standard
  tags the site CSS targets. Wrapper class must land on the editable element.
- First target site: ~/workspace/jwp23/jpresley23-com (posts in `posts/`,
  CSS at `src/styles/site.css`, fonts in `public/fonts/`).
- Code blocks: site defers them; editor treats them as a plain `pre` node.

## Next (brainstorming skill, architectural path)
Clarifying questions → 2-3 approaches → design doc `docs/designs/letterpress.md`
→ bd epic → writing-plans.
