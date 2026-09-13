# Letterpress

Write Markdown inside your site's own typography.

Letterpress opens one Markdown post in a browser window and lets the author
type directly into a rendering of the page, styled by the target site's own
stylesheet and fonts. It is a local tool with no backend and no account. The
site build stays the authority on the final HTML; Letterpress is a faithful
view of the typography and structure while writing.

Decisions and their trade-offs live in `docs/adr/`. This document describes
the current design.

## Scope

In:

- One file per window, opened from the command line.
- Inline editing of the post body in the site's style, dark and light.
- Frontmatter preserved verbatim and edited as raw YAML.
- Autosave.
- Images referenced from the site's static root render in place.

Out, until something needs them:

- Listing, creating, or navigating between posts.
- Image insertion or upload.
- Watching the file for outside edits. Last writer wins.
- Rendering with the site generator's own Markdown pipeline.
- Reproducing site chrome such as nav and footer.

## Usage

From inside the site repository:

```
letterpress posts/my-post.md
```

The CLI finds `letterpress.json` by walking up from the post's directory,
starts a server on a free localhost port, and opens a browser. When a
Chromium-family browser is available it launches in app mode, which gives a
chromeless window; otherwise the default browser opens.

## Configuration

`letterpress.json` sits at the site repository root and is committed there.
Every path resolves against the config file's directory, so the launch
directory does not matter.

```json
{
  "stylesheet": "src/styles/site.css",
  "staticRoot": "public",
  "bodyClass": "prose",
  "lightClass": "light"
}
```

| Key          | Meaning                                                      |
| ------------ | ------------------------------------------------------------ |
| `stylesheet` | The site's stylesheet, served as-is.                         |
| `staticRoot` | Directory served at `/`, so font and image URLs resolve.     |
| `bodyClass`  | Class the site puts on the rendered post body.               |
| `lightClass` | Class the site puts on `<html>` for light mode. Dark is none. |

All four keys are required. Loading fails with one sentence naming the
missing key or the path that does not exist.

## Components

### CLI

Resolves the post path, loads the config, starts the server, and opens the
browser. It holds no other logic.

### Config

A pure module: discover the config file by walking up, validate the keys,
resolve the paths, and confirm they exist.

### Server

`node:http` with no framework. It serves:

- the built editor page,
- the configured stylesheet,
- everything under the static root,
- `GET /config` returning the body and light classes as JSON,
- `GET /post` returning the file's text,
- `PUT /post` writing the file.

The server is bound to the one file the CLI opened and refuses any other
path. Writes go to a temporary file in the same directory, then rename, so a
crash never leaves a half-written post.

### Client

TypeScript bundled with esbuild when the package is built. On load it:

1. Splits the file at the frontmatter fences into a YAML string and a
   Markdown body. The YAML string is kept byte for byte.
2. Shows the YAML in a plain text block above the editor.
3. Reads the `title:` line from the YAML, display only, and renders it as the
   post's `h1` in the site's post-title style. A missing or malformed line
   means no title is shown.
4. Parses the body with `prosemirror-markdown` and mounts ProseMirror with
   `bodyClass` on the editable element, so the site's body rules apply to the
   editor itself.
5. Reproduces only as much of the site's nesting as widths need: the site
   column wrapper, the article, then the body element.

A theme toggle adds or removes `lightClass` on `<html>`.

## Data Flow

```
file ──GET /post──▶ split ──▶ YAML text block ──────────────┐
                        └──▶ markdown-it ──▶ ProseMirror ──▶ serialize ──▶ join ──PUT /post──▶ file
```

Autosave: any change in either area starts a 500 ms debounce. When it fires, the body is serialized to Markdown, joined with
the YAML block and fences, and sent to the server. A status mark shows
saving, saved, or error. On error the document stays in memory so nothing is
lost while the cause is fixed.

### Serializer style

The serializer is configured to match how the site's posts are written:
emphasis and list markers, fence style, and no hard wrapping of paragraphs.
The acceptance test is that loading a post and saving it untouched produces
no diff.

Two parsers are in play: markdown-it in the editor and the site generator's
own, remark for Astro, in the build. They agree on CommonMark and common GFM.
Edge cases can differ, and the build wins.

## Errors

- CLI: a missing file, no config found, a missing key, or a configured path
  that does not exist exits non-zero with one plain sentence naming the
  path. No stack traces for user mistakes.
- Server: a failed write returns an error status; the client shows it and
  keeps the document. Requests for any file other than the opened one are
  refused.
- Client: any text parses to a document, and frontmatter is never parsed
  beyond the title line, so neither step can fail.

## Testing

Vitest, red/green TDD from the first line. Tests use real files in temporary
directories and real HTTP; nothing is mocked.

- Config: discovery by walking up, key validation, path resolution, and
  existence checks.
- Frontmatter: split and join with frontmatter, without, with an empty
  block, and with CRLF line endings. Round-trip is byte-identical.
- Markdown round-trip: a fixture mirroring the site's real post style,
  parsed and serialized in Node without a browser, compared to the source.
- Server: a server on a random port, real temp files, the atomic write, and
  the path refusal.
- Browser: no unit tests. Verification is opening the site's actual post
  beside the site's dev server and comparing screenshots with the
  scripted-browser-verification skill.

Test output is pristine. A test that provokes an error captures and asserts
on it.

## Code Map

```
bin/letterpress        CLI entry
src/cli.ts             argument handling, launch
src/config.ts          discovery, validation, resolution
src/frontmatter.ts     split and join
src/markdown.ts        ProseMirror schema, parser, serializer config
src/server.ts          http server and endpoints
client/                editor page and bundle source
scripts/smoke.ts       headless render of a post for verification
docs/adr/              decisions
```

## First Target

jpresley23.com, a checkout at `../jpresley23-com`: posts in `posts/`,
stylesheet at `src/styles/site.css`, fonts under `public/fonts/`, body class
`prose`, light class `light`.
