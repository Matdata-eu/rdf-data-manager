# Contributing

Thanks for helping. This page says how to get the project running, what a change needs,
and how we work.

## Getting started

```bash
git clone https://github.com/Matdata-eu/rdf-data-manager.git
cd rdf-data-manager
npm install          # also installs the pre-commit hook
npm run dev          # http://localhost:5173
npm test
```

Node 22 or later. There is no backend: the app talks to a SPARQL endpoint from the browser.
For a local endpoint, [Apache Jena Fuseki](https://jena.apache.org/documentation/fuseki2/)
works out of the box (`fuseki-server --mem --update /metadata` from the Apache
release, or `docker compose up fuseki` for a container), then load
`shapes/dim-metadata.shapes.ttl` and `examples/dim-metadata.sample.ttl` or your own data.

## Before you open a pull request

- `npm run lint`, `npm run typecheck` and `npm test` pass. CI runs the same three plus a build.
- Code follows [Standard style](https://standardjs.com/) with TypeScript (`npm run lint:fix` fixes most of it).
- Behaviour that can be tested without a browser has a test in the package's `tests/`.
  Shape rules get a file in `packages/shapes-dim/tests/data/invalid/` with `# expect-shape`
  and `# expect-severity` headers. Form components are tested with Testing Library; the
  browser smoke test (`packages/app/e2e/`) runs in CI against a Fuseki.
- A user-facing option or a new `rdm:` annotation is documented in the README.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat(app): …`, `fix(shapes): …`, `docs: …`, `chore: …`, `test: …`, `ci: …`.
  Do not add `Co-Authored-By` trailers.
- Keep pull requests focused. A refactor and a feature are two pull requests.

## What is in scope

The app edits RDF data through forms generated from SHACL and DASH, against any SPARQL 1.1
endpoint. Anything that makes that work for more shapes, more stores or more people is
welcome. Out of scope, by decision (see `docs/adr/`): authentication and authorisation,
reasoning, and editing ontologies or shapes themselves.

## Where things are

| Path | What |
|---|---|
| `packages/core/src/shapes/` | Parses SHACL/DASH into the model that drives menus and forms |
| `packages/core/src/form/` | Editable form state, defaults, IRI minting, which triples a form manages |
| `packages/core/src/data/` | Loading resources, diffing, building SPARQL Update, preparing and guarding a save |
| `packages/core/src/validation/` | SHACL validation with shacl-engine |
| `packages/core/src/sparql/` | SPARQL protocol client |
| `packages/react/src/` | `NodeForm`, the widget registry and the built-in widgets |
| `packages/app/src/` | The app shell: router, settings, pages, theme |
| `packages/app/src/messages/` | UI message catalogues (Norwegian Bokmål); keys are the English text |
| `packages/app/e2e/` | Playwright smoke test against a Fuseki |
| `packages/shapes-dim/` | The DIM metadata shapes, sample data, invalid cases and endpoint tools |
| `docs/` | Architecture, widgets, configuration, decision records |

The workspace packages resolve to each other's sources in dev, tests and the app build, so
nothing needs building first; `npm run build` emits `dist/` for publishing.

## Reporting a security problem

See [SECURITY.md](SECURITY.md).
