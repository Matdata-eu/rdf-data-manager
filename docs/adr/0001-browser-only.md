# 1. The app is a static site that talks to the endpoint from the browser

Date: 2026-10-16

## Status

Accepted

## Context

The first deployment targets are GitHub Pages, an npm package and a container image, later
Kubernetes at Bane NOR. Every organisation that adopts the app already runs a SPARQL
endpoint.

## Decision

The app is built with Vite into static files and has no server of its own. The browser
sends SPARQL queries and updates directly to the configured endpoint, which must allow
CORS from the app's origin (Fuseki does by default). Settings come from local storage,
URL parameters or a `config.json` next to `index.html`.

## Consequences

- Deployment is copying files; any static host or image works.
- The endpoint, or a proxy in front of it, handles access control (see ADR 2).
- Everything that runs, including SHACL validation, must run in the browser.
