# Architecture

One repository, npm workspaces, three published packages plus one package per widget and
one private package for the Bane NOR shapes.

```
rdf-data-manager (app)        router, settings, theme, config.json, runtime widget loading
   │
   ├── built-in widgets ── widget-map ── widget-time ── anyone's widget (npm package or URL)
   │                                │
   └── @rdf-data-manager/react     widget registry and interface, NodeForm, hooks
          │
          └── @rdf-data-manager/core   shapes model, form state, diff and SPARQL Update,
                                        SPARQL client, SHACL validation; no React, no DOM
```

Arrows point at dependencies: the app loads widgets and composes the react package;
widgets and the react package build on core; core depends on nothing of ours.

## Packages

| Package | Contents | Published as |
|---|---|---|
| `packages/core` | `shapes/`, `form/`, `data/`, `sparql/`, `validation/`, `rdf/` | `@rdf-data-manager/core` |
| `packages/react` | `NodeForm`, the widget registry, built-in widgets, `useAsync`, `form.css` | `@rdf-data-manager/react` |
| `packages/app` | Router, settings, pages, theme, `config.json`, `bin/` CLI, Playwright test | `rdf-data-manager` |
| `packages/shapes-dim` | DIM shapes, sample data, invalid cases, `validate-endpoint` and `load-shapes` tools | private |

In development, tests and the app build the packages resolve to each other's TypeScript
sources (an alias in each Vite config), so nothing is built first. `npm run build`
compiles `core` and `react` to `dist/` with declarations for publishing and builds the app.

## The save pipeline

1. `Repository.loadResource` fetches the resource and its nested nodes (depth ≤ 3) with
   one CONSTRUCT; `stateFromQuads` turns them into `NodeState`.
2. The form edits `NodeState`; `managedQuads` lists the triples the shapes own.
3. `prepareSave` diffs the managed triples before and after, bumps `rdm:updateOnSave`
   properties, loads the two-hop neighbourhood of referenced resources and validates the
   would-be stored data with shacl-engine. Violations block the save.
4. `assertUnchanged` reloads the resource and compares it with what the form started
   from, so a save never silently overwrites someone else's edit.
5. `buildUpdate` emits `DELETE DATA` / `INSERT DATA` (or `DELETE … WHERE` for blank
   nodes; `INSERT … WHERE { FILTER NOT EXISTS … }` for a new resource), and the
   repository sends it.

## Widgets

See [WIDGETS.md](WIDGETS.md). A widget implements a `dash:editor` IRI and scores how
well it fits a property; the registry picks by name when the shape names an editor,
otherwise by score. The built-in editors are widgets too, so there is one mechanism.

## Configuration

See [CONFIG.md](CONFIG.md): `config.json`, URL parameters, environment variables of the
container image, and the JSON Schema.

## Decisions

Recorded in [adr/](adr/).
