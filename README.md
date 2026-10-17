# RDF Data Manager

A web application for create, read, update and delete (CRUD) operations on RDF data
behind a SPARQL endpoint. Its whole user interface is driven by a
[SHACL](https://www.w3.org/TR/shacl/) / [DASH](https://datashapes.org/forms.html)
configuration that is either stored in the same endpoint as the data or loaded from an
external source.

Licensed under the [MIT License](LICENSE).

## Status

The first target is the metadata of the Bane NOR Digital Infrastructure Model (DIM):
the CSV datasets and key figures that the `dim-etl-dataset-generation` pipeline reads
from the Fuseki `/metadata` dataset.

## Running the app

The app is a static TypeScript/React site with no backend: the browser talks to the
SPARQL endpoint directly, so the endpoint must allow CORS from the app's origin (Fuseki
does by default).

```bash
npm install
npm run dev        # http://localhost:5173
```

Other ways to run it (details in [docs/CONFIG.md](docs/CONFIG.md)):

```bash
npx rdf-data-manager --port 8080 --config ./config.json          # the npm package serves the built app
docker run -p 8080:8080 -e RDM_DATASET=http://host.docker.internal:3030/metadata/ ghcr.io/matdata-eu/rdf-data-manager
docker compose up --build                                       # the app next to a Fuseki, for a local trial
```

Every push to `main` deploys to GitHub Pages; releases are cut by Release Please from the
conventional commit history and publish the npm package and the container image.

Open Settings and enter the endpoint (for Fuseki, the dataset URL fills in the query and
update URLs) and where the shapes come from: a named graph in the endpoint, a Turtle URL
or a local file. For the DIM metadata the shapes graph is
`https://data.banenor.no/data/_shapes_metadata`. Settings are kept in the browser. They can also be passed in the URL,
e.g. `?dataset=http://localhost:3030/metadata/&shapesGraph=https://…`, or served as a
`config.json` next to `index.html` (`"locked": true` hides Settings).

The look follows the [MatData design system](https://claude.ai/artifact/TtLC5gbV1pXHbZX22cPxCx):
Barlow and JetBrains Mono (bundled, so no outside network is needed), and light and dark themes. All colours,
fonts, spacing and radii are CSS variables in [src/theme.css](src/theme.css), so another
organisation can restyle the app by replacing that one file.

If the endpoint does not send CORS headers, run the dev server with
`RDM_PROXY_TARGET=http://localhost:8030 npm run dev` and use
`http://localhost:5173/proxy/jena-fuseki/metadata/` as the dataset URL.

What the app does:

- Lists the instances of every class the shapes describe, with counts and a filter.
- Creates, edits and deletes resources with forms built from the shapes, including
  nested nodes such as a table's columns, which are saved together with their parent.
- Validates the would-be stored data with the shapes before every save (in the browser,
  with [shacl-engine](https://github.com/rdf-ext/shacl-engine)). Violations block the save
  unless you choose "Save anyway"; warnings are shown after saving.
- Refuses to save over someone else's edit: a resource that changed since it was opened
  must be reloaded first, and creating an IRI that appeared in the meantime fails.
- Writes only the triples the form manages, as a minimal `DELETE DATA` / `INSERT DATA`
  update, so properties outside the shapes are left alone.

## Packages

The repository is an npm workspace ([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)):

| Package | What | npm |
|---|---|---|
| [packages/core](packages/core) | Shapes model, form state, diff and SPARQL Update, SPARQL client, SHACL validation. Plain TypeScript, no UI | `@rdf-data-manager/core` |
| [packages/react](packages/react) | `NodeForm` and the widget registry; forms for any React app ([docs/WIDGETS.md](docs/WIDGETS.md)) | `@rdf-data-manager/react` |
| [packages/app](packages/app) | The app: router, settings, theme, `config.json`, runtime widget loading | `rdf-data-manager` |
| [packages/widget-map](packages/widget-map) | Map editor for GeoSPARQL geometries (Leaflet), loaded on demand | `@rdf-data-manager/widget-map` |
| [packages/widget-time](packages/widget-time) | Calendar and clock editors for XSD date/time types and OWL-Time nodes | `@rdf-data-manager/widget-time` |
| [packages/shapes-dim](packages/shapes-dim) | The Bane NOR DIM shapes, sample data, invalid test cases and endpoint tools | private |

## Shapes

| File | Content |
|---|---|
| [packages/shapes-dim/shapes/dim-metadata.shapes.ttl](packages/shapes-dim/shapes/dim-metadata.shapes.ttl) | SHACL/DASH shapes for `dcat:Dataset`, `bno:KeyFigure`, `bno:KeyFigureTable`, `bno:KeyFigureSection`, `csvw:Column` and (read-only) `dcat:Distribution` |
| [packages/shapes-dim/examples/dim-metadata.sample.ttl](packages/shapes-dim/examples/dim-metadata.sample.ttl) | Sample metadata that conforms to the shapes |
| [packages/shapes-dim/tests/data/invalid/](packages/shapes-dim/tests/data/invalid/) | One file per rule the shapes must catch |

Datasets, key figures and key figure tables need exactly one title and one description in
each of English (`en`), Bokmål (`nb`) and Nynorsk (`nn`). Key figure sections need an English
title and may add `nb` and `nn`; a legacy `@no` title gives a warning.

The shapes are meant to live in the named graph
`<https://data.banenor.no/data/_shapes_metadata>` of `/metadata`, next to the data.

```bash
npm test                                                              # shapes vs. sample and invalid cases, form logic, form components
npm run lint                                                          # Standard style with TypeScript (npm run lint:fix repairs most findings)
FUSEKI_DATASET=http://localhost:3030/metadata/ npx playwright test    # browser smoke test, from packages/app, against a Fuseki
npm run validate-endpoint -- http://localhost:8030/jena-fuseki/metadata/   # reads shape targets only; --full, --no-distributions, --timeout, --json
npm run load-shapes -- http://localhost:8030/jena-fuseki/metadata/         # PUT the shapes into their named graph
```

### How the shapes drive the UI

- Every class targeted by a node shape with an `rdfs:label` becomes a menu entry, in
  `rdm:order`. Shapes targeting the same class are merged.
- Property shapes give the form fields: `sh:group` and `sh:order` place them,
  `dash:editor` / `dash:viewer` choose the widget (any registered widget, built-in or added
  through `config.json`; see [docs/WIDGETS.md](docs/WIDGETS.md)), `dash:readOnly` disables editing.
- Nested resources (a table's columns) use `dash:DetailsEditor` with `sh:node`.
- New IRIs are `dash:uriStart` + a local name the user types, checked against
  `rdm:localNamePattern`.

Annotations in the `rdm:` namespace (`https://matdata.eu/ns/rdf-data-manager#`):

| Property | Used on | Meaning |
|---|---|---|
| `rdm:order` | node shape | Menu order |
| `rdm:hideFromMenu` | node shape | Do not list the target class in the menu |
| `rdm:localNamePattern` | node shape | Regex for the local name of new instances |
| `rdm:localNameDescription` | node shape | Help text for that local name |
| `rdm:localNameProperty` | node shape | Property whose value completes the IRI of a new nested node |
| `rdm:defaultValue` | property shape | Value pre-filled on create (`rdm:today` = current date) |
| `rdm:updateOnSave` | property shape | Set the value to today whenever the resource is saved |
| `rdm:orderBy`, `rdm:orderDescending` | property / node shape | Sort order of multiple values |
| `rdm:collapsed` | property shape | Start the field collapsed; without it, fields with more than 5 values start collapsed |
| `rdm:pageSize` | property shape | Number of values shown before "Show more" (default 10) |
| `rdm:languages` | property shape | Language tags the form offers for a text field |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to run, test and submit changes, and
[docs/adr/](docs/adr/) for the decisions behind the design.
