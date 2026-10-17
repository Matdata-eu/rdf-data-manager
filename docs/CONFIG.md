# Configuration

The app reads its settings from three places, later ones winning: `config.json` next to
`index.html`, the settings saved in the browser, and URL parameters. With `"locked": true`
in `config.json`, only that file counts and Settings is hidden.

## config.json

Schema: [`config.schema.json`](../packages/app/public/config.schema.json) (served next to the app as
well). All keys are optional.

| Key | Meaning | Example |
|---|---|---|
| `queryUrl` | SPARQL query endpoint | `https://data.example.org/metadata/query` |
| `updateUrl` | SPARQL update endpoint; defaults to `queryUrl` | `https://data.example.org/metadata/update` |
| `dataGraph` | Named graph holding the data; empty for the default graph | `""` |
| `shapes` | `{"source": "endpoint", "graph": "<iri>"}` or `{"source": "url", "url": "<url>"}` | `{"source": "endpoint", "graph": "https://data.banenor.no/data/_shapes_metadata"}` |
| `language` | Preferred language tag for labels | `nb` |
| `languages` | Language tags offered in Settings (default `["en"]`); the shapes' `rdm:languages` are added | `["en", "nb", "nn"]` |
| `widgets` | Widgets to load: `"map"`, `"time"` (bundled, loaded on demand) or URLs of ES modules, see [WIDGETS.md](WIDGETS.md) | `["map", "time"]` |
| `timeoutMs` | Request timeout in milliseconds (default 120000) | `60000` |
| `locked` | Hide Settings and ignore browser and URL settings | `true` |

```json
{
  "queryUrl": "https://data.example.org/metadata/query",
  "updateUrl": "https://data.example.org/metadata/update",
  "shapes": { "source": "endpoint", "graph": "https://data.banenor.no/data/_shapes_metadata" },
  "language": "nb",
  "locked": true
}
```

## URL parameters

`?dataset=<Fuseki dataset URL>` (fills query and update URLs), or `?query=<url>&update=<url>`;
`&graph=<data graph>`, `&shapesGraph=<iri>` or `&shapesUrl=<url>`, `&lang=<tag>`,
`&widgets=map,time`.

`?demo=dim` or `?demo=geo-time` runs a bundled dataset in a store inside the browser
(Oxigraph compiled to WebAssembly, loaded on demand): nothing is sent anywhere, and a
reload starts over. Settings offers the same under "Try a demo". Deployments that set
`"demo"` in `config.json` start in that demo.

## Container image

`ghcr.io/matdata-eu/rdf-data-manager` serves the app on port 8080 with nginx. The
entrypoint writes `config.json` from environment variables; unset ones are left out.

| Variable | config.json key |
|---|---|
| `RDM_DATASET` | `queryUrl` and `updateUrl` derived Fuseki-style (`<dataset>/query`, `<dataset>/update`) |
| `RDM_QUERY_URL`, `RDM_UPDATE_URL` | `queryUrl`, `updateUrl` (win over `RDM_DATASET`) |
| `RDM_DATA_GRAPH` | `dataGraph` |
| `RDM_SHAPES_GRAPH` or `RDM_SHAPES_URL` | `shapes` |
| `RDM_LANGUAGE` | `language` |
| `RDM_LANGUAGES` | `languages` (comma-separated) |
| `RDM_WIDGETS` | `widgets` (comma-separated: `map`, `time` or URLs) |
| `RDM_TIMEOUT_MS` | `timeoutMs` |
| `RDM_LOCKED` | `locked` (`true` or `false`) |

```bash
docker run -p 8080:8080 \
  -e RDM_DATASET=http://host.docker.internal:3030/metadata/ \
  -e RDM_SHAPES_GRAPH=https://data.banenor.no/data/_shapes_metadata \
  ghcr.io/matdata-eu/rdf-data-manager
```

To mount a ready-made file instead, put it at `/usr/share/nginx/html/config.json` and
set no `RDM_*` variables.

`docker-compose.yml` in the repository starts the app with a Fuseki for a local trial.

## npm

`npx rdf-data-manager --port 8080 --config ./config.json` serves the built app from any
machine with Node 22. The package also ships the DIM shapes and sample data under
`shapes/` and `examples/`.

## GitHub Pages

Every push to `main` deploys the app to GitHub Pages. That deployment has no
`config.json`, so it asks for an endpoint on first use; pass one in the URL to share a
link, e.g. `?dataset=https://…&shapesUrl=https://…`.
