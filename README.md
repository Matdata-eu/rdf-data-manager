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
from the Fuseki `/metadata` dataset. The web app itself is not built yet.

## Shapes

| File | Content |
|---|---|
| [shapes/dim-metadata.shapes.ttl](shapes/dim-metadata.shapes.ttl) | SHACL/DASH shapes for `dcat:Dataset`, `bno:KeyFigure`, `bno:KeyFigureTable`, `bno:KeyFigureSection`, `csvw:Column` and (read-only) `dcat:Distribution` |
| [examples/dim-metadata.sample.ttl](examples/dim-metadata.sample.ttl) | Sample metadata that conforms to the shapes |
| [tests/data/invalid/](tests/data/invalid/) | One file per rule the shapes must catch |

Datasets, key figures and key figure tables need exactly one title and one description in
each of English (`en`), Bokmål (`nb`) and Nynorsk (`nn`). Key figure sections need an English
title and may add `nb` and `nn`; a legacy `@no` title gives a warning.

The shapes are meant to live in the named graph
`<https://data.banenor.no/data/_shapes_metadata>` of `/metadata`, next to the data.

```bash
pip install -r requirements-dev.txt
python -m pytest tests                                    # shapes vs. sample and invalid cases
python tools/validate_endpoint.py http://localhost:8030/jena-fuseki/metadata/
python tools/load_shapes.py       http://localhost:8030/jena-fuseki/metadata/
```

### How the shapes drive the UI

- Every class targeted by a node shape with an `rdfs:label` becomes a menu entry, in
  `rdm:order`. Shapes targeting the same class are merged.
- Property shapes give the form fields: `sh:group` and `sh:order` place them,
  `dash:editor` / `dash:viewer` choose the widget, `dash:readOnly` disables editing.
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
| `rdm:defaultValue` | property shape | Value pre-filled on create (`rdm:today` = current date) |
| `rdm:orderBy`, `rdm:orderDescending` | property / node shape | Sort order of multiple values |
| `rdm:languages` | property shape | Language tags the form offers for a text field |
