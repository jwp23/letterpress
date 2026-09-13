# ADR-003: TypeScript on Node, esbuild for the client, Vitest for tests

Date: 2026-09-13

## Context

ADR-001 chose ProseMirror, a JavaScript library that runs in the browser, and
ADR-002 chose a local Node server. The remaining choices were language,
bundler, test runner, and whether to use a server framework.

## Decision

- TypeScript for the CLI, server, and client.
- Node's `node:http` for the server, with no framework.
- esbuild to bundle the client when the package is built.
- Vitest for tests, with red/green TDD from the first line. Tests use real
  temporary files and real HTTP; nothing is mocked.

## Trade-offs

- **Gained:** one language across the whole tool, the smallest dependency
  surface that still gives type checking, a bundler that needs no config, and
  a test runner that runs TypeScript directly.
- **Given up:** the conveniences of a server framework for routing and static
  files. The server has two endpoints and three static roots, so hand-written
  handlers stay small.
- **Accepted:** a build step before the CLI can run, because the browser
  needs a bundle. It is one esbuild call.
