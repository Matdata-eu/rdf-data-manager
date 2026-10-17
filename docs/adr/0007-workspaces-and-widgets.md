# 7. Workspace packages and a widget registry

Date: 2026-10-17

## Status

Accepted

## Context

The app was one package. Every planned feature touched the same files, the editors were
a closed list in two switch statements, and nothing could be reused by another UI or
extended by another organisation without a fork. Custom widgets (a map, a calendar) were
the first concrete need.

## Decision

The repository is an npm workspace with `@rdf-data-manager/core` (no React),
`@rdf-data-manager/react` (forms and the widget registry), `rdf-data-manager` (the app)
and a private `@rdf-data-manager/shapes-dim` for the Bane NOR shapes. Widgets are plain
objects with a `dash:editor` IRI, a `score` function and React components; the built-in
editors are registered the same way. The app loads extra widget modules listed in
`config.json` at startup. Bane NOR specifics (the default shapes graph, the language
list) moved out of the generic code into configuration and the shapes package.

## Consequences

- Widgets are developed in this repository for now and published from it; moving one to
  its own repository later is a directory move.
- The three public packages share one version (Release Please, linked versions).
- In development the packages resolve to each other's sources; `dist/` exists only for
  publishing.
