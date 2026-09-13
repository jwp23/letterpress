# Point at the site checkout, do not copy its assets

Date: 2026-09-13

## Decision

Letterpress reads the target site's stylesheet, fonts, and static assets
straight from a checkout of the site. A `letterpress.json` at the site's
repository root names the stylesheet, the static root, the body class, and
the light-mode class. All paths resolve against the config file's directory.

## Rationale

Copying assets into the editor means two copies that drift, and the site's
`DESIGN.md` would no longer be the single source of visual truth. Pointing at
the checkout makes the editor show whatever the site currently ships, and the
config is four keys that describe any static site, not only Astro.
