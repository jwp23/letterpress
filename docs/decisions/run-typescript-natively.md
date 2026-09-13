# Run TypeScript natively on Node; tsc only type-checks

Date: 2026-09-13

## Decision

The CLI and server run their `.ts` sources directly on Node 24, which strips
type annotations natively. `tsc` runs with `noEmit` as a type check inside
`npm test`, and source imports use explicit `.ts` extensions. Only the
browser client is bundled, by esbuild. TypeScript is the current 7.x line.

## Rationale

A compile step for the server would add a `dist/` for code that never leaves
the machine. Native stripping removes it at the cost of avoiding the few
TypeScript features that need transformation, such as enums and parameter
properties, which this codebase does not use. TypeScript 7.0 was verified with
this configuration; it only type-checks, so the compiler line carries little
risk.
