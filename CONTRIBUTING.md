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
works out of the box (`docker run -p 3030:3030 stain/jena-fuseki`), then load
`shapes/dim-metadata.shapes.ttl` and `examples/dim-metadata.sample.ttl` or your own data.

## Before you open a pull request

- `npm run lint`, `npm run typecheck` and `npm test` pass. CI runs the same three plus a build.
- Code follows [Standard style](https://standardjs.com/) with TypeScript (`npm run lint:fix` fixes most of it).
- Behaviour that can be tested without a browser has a test in `tests/`. Shape rules get a
  file in `tests/data/invalid/` with `# expect-shape` and `# expect-severity` headers.
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
| `src/shapes/` | Parses SHACL/DASH into the model that drives menus and forms |
| `src/form/` | Editable form state, defaults, IRI minting, which triples a form manages |
| `src/data/` | Loading resources, diffing, building SPARQL Update, preparing a save |
| `src/validation/` | SHACL validation with shacl-engine |
| `src/sparql/` | SPARQL protocol client |
| `src/components/` | React UI |
| `shapes/`, `examples/`, `tools/` | The DIM metadata shapes, sample data and endpoint tools |
| `docs/adr/` | Architecture decision records |

## Reporting a security problem

See [SECURITY.md](SECURITY.md).
