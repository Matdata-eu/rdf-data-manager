# 6. One stack: TypeScript everywhere, including tools and tests

Date: 2026-10-16

## Status

Accepted

## Context

The first version had Python scripts for endpoint validation and shape loading next to the
TypeScript app, so a contributor needed two toolchains and the shape rules were tested
with a different validator than the app used.

## Decision

Everything in the repository is TypeScript: the app, the command-line tools (`tools/`,
run with `tsx`) and the tests (Vitest). Shape tests use the same shacl-engine as the app.

## Consequences

- `npm install` is the whole setup.
- Node 22 or later is required for the tools.
