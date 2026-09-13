# ADR-002: A local web app, not a desktop framework

Date: 2026-09-13

## Context

Letterpress must render the target site's stylesheet and fonts exactly, which
means a browser engine. It also must read and write a file on the author's
machine, which a page alone cannot do. The options were an Electron app, a
Tauri app, or a page served by a small local server and opened in a browser.

## Decision

Letterpress is a page served by a `node:http` server on localhost, started by
the CLI and opened in the browser. When a Chromium-family browser is
available, it launches in app mode for a chromeless window; otherwise the
default browser opens.

## Trade-offs

- **Gained:** no packaging, no bundled browser engine, a few kilobytes of
  server, and a window that looks like a desktop app on a Linux desktop.
- **Given up:** native file dialogs and a single installable binary. The CLI
  is the launcher.
- **Rejected:** Electron. It ships its own Chromium for no gain here.
- **Deferred:** Tauri. It wraps the same page in a native window with system
  WebKitGTK, so it can be added later without changing the editor.
