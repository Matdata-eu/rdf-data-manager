# 3. Validation runs in the browser with shacl-engine

Date: 2026-10-16

## Status

Accepted

## Context

Every save should be checked against the shapes before it reaches the store, and the
result should be shown next to the fields it concerns. The endpoint may not offer SHACL
validation, and the app has no server.

## Decision

Validation uses [shacl-engine](https://github.com/rdf-ext/shacl-engine) in the browser,
with its SPARQL extension so `sh:sparql` constraints work. The data validated is the
loaded resource with the form's changes applied, plus the neighbourhood of every resource
the form refers to. The same library runs the shape tests under Vitest.

## Consequences

- One validator for the app, the tests and the endpoint tools.
- The context loaded for validation is bounded (two hops), so constraints that look
  further afield are only checked by the store, if at all.
- The library's result shape is typed locally in `src/types.d.ts` and needs care on upgrades.
