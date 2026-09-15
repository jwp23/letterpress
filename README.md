# Letterpress

Write a Markdown post inside your site's own typography.

Letterpress opens one Markdown file in a browser window and lets you type
directly into a rendering of the page, styled by your site's stylesheet and
fonts. It runs locally, has no backend, and autosaves the file as you type.

## Quick start

Requires Node 24 or newer.

```sh
npm install
npm run build
npm link            # puts the `letterpress` command on your PATH
```

Then, from inside your site checkout:

```sh
letterpress posts/my-post.md
```

A browser opens on a local port. Edit the page, and the file is written 500 ms
after you stop typing. Press Ctrl+C in the terminal to stop.

## Configure your site

Put a `letterpress.json` at the site repository root. Letterpress finds it by
walking up from the post's directory, so it does not matter where you run it
from. Paths resolve against the config file's directory.

```json
{
  "stylesheet": "src/styles/site.css",
  "staticRoot": "public",
  "bodyClass": "prose",
  "lightClass": "light"
}
```

| Key          | Meaning                                                       |
| ------------ | ------------------------------------------------------------- |
| `stylesheet` | The site's stylesheet, served as-is.                          |
| `staticRoot` | Directory served at `/`, so font and image URLs resolve.      |
| `bodyClass`  | Class the site puts on the rendered post body.                |
| `lightClass` | Class the site puts on `<html>` for light mode. Dark is none. |

All four keys are required.

## What it does and does not do

- Edits the post body in the site's style, in dark or light mode. The theme
  follows your system preference and can be toggled in the editor.
- Keeps frontmatter byte for byte. It is shown as raw YAML above the editor;
  only the `title:` line is read, for the heading.
- Renders images referenced from `staticRoot` in place.
- Opens a chromeless window when a Chromium-family browser is installed,
  otherwise your default browser.
- Does not list, create, or navigate between posts.
- Does not watch the file for outside edits. Last writer wins.
- Does not reproduce site chrome such as nav and footer.

## Development

```sh
npm test            # prettier check, typecheck, and vitest
npm run build       # bundles the editor into dist/client
npm run mutate      # mutation testing; fails on any surviving mutant
```

### Git hooks

```sh
./scripts/setup-hooks.sh
```

This points `core.hooksPath` at the repository's committed hooks. Git runs no
hook until you do this. `pre-commit` runs secrets scanning, formatting,
typecheck, dependency audit, license check, and the tests. `commit-msg`
checks that the message is a single Conventional Commits line.
`pre-push` runs mutation testing (`npm run mutate`) and rejects the push while
any mutant survives.

betterleaks is the one tool `npm install` does not provide. The hook warns and
skips the secrets scan when it is missing; CI runs it on every pull request.
Install it from https://github.com/betterleaks/betterleaks.

### Continuous integration

Every pull request runs the workflows in `.github/workflows/`. Semgrep,
SonarQube, and Snyk need the repository secrets `SEMGREP_APP_TOKEN`,
`SONAR_TOKEN`, and `SNYK_TOKEN`; the other checks need nothing.

Design and decisions live in `docs/designs/letterpress.md`, `docs/adr/`, and
`docs/decisions/`.
