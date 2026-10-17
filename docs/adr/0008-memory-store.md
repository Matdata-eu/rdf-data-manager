# 8. An in-memory SPARQL store for tests and the demo

Date: 2026-10-17

## Status

Accepted

## Context

Every query the app sends was only exercised against a real Fuseki in the browser tests,
which need a server. Unit tests faked the client or avoided the repository, so a wrong
query shape (a path, a FILTER, a CONSTRUCT template) could only fail in CI. The roadmap
also wants a demo that runs on GitHub Pages without an endpoint.

## Decision

`Repository` depends on a small `SparqlQueryClient` interface instead of the protocol
client. `@rdf-data-manager/store-memory` implements it with
[Oxigraph](https://github.com/oxigraph/oxigraph) compiled to WebAssembly: a complete
SPARQL 1.1 query and update engine that runs in Node and in the browser. The repository
tests load the DIM shapes and sample data into it and run the real queries.

## Consequences

Features that are nothing but queries (search, references, export, import, the
validation overview, the translation grid) have fast tests with a real engine. The demo
mode can load example data into the same store. Oxigraph adds about 2 MB of WebAssembly,
which only the demo and the tests load; the app bundle for a real endpoint does not
include it. Differences between SPARQL engines remain possible, so the Playwright tests
still run against Fuseki in CI.
