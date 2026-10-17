# Changelog

Releases are cut by Release Please from the conventional commit messages on `main`; each
release adds its section here. The entries below summarise what the first release carries.

## Unreleased

### Features

- SHACL/DASH-driven forms for any SPARQL endpoint: menu by target class, fields by property
  shape, nested resources, guarded saves with review-before-write, SHACL validation on save.
- Widget registry with built-in DASH editors, `dash:AutoCompleteEditor`, and the bundled
  map (GeoSPARQL WKT) and time (OWL-Time, XSD dates) widgets; more via `config.json`.
- Validation overview for a class or all data, translation grid, search across classes,
  "Used by" references, Turtle and CSV export, Turtle import checked against the shapes,
  managed-query preview, "Other properties" for triples outside the shape.
- `sh:or` / `sh:xone` fields, `sh:closed` awareness, predicate targets parsed.
- Demo mode in the browser with an Oxigraph store (`?demo=dim`, `?demo=geo-time`).
- Interface in Norwegian Bokmål (`nb`; `nn` falls back to it) besides English.
- Packages: `rdf-data-manager` (app), `@rdf-data-manager/core`, `@rdf-data-manager/react`,
  `@rdf-data-manager/widget-map`, `@rdf-data-manager/widget-time`,
  `@rdf-data-manager/store-memory`; Docker image and GitHub Pages deployment.
- The `rdm:` vocabulary is published in `vocab/rdf-data-manager.ttl`.
