# Architecture decision records

One short file per decision, numbered in the order taken. A record is never edited after
the fact; a change of mind gets a new record that supersedes the old one.

| # | Decision |
|---|---|
| [0001](0001-browser-only.md) | The app is a static site that talks to the endpoint from the browser |
| [0002](0002-no-auth.md) | Authentication and authorisation are out of scope |
| [0003](0003-shacl-engine.md) | Validation runs in the browser with shacl-engine |
| [0004](0004-shapes-in-named-graph.md) | Shapes live in a named graph next to the data by default |
| [0005](0005-rdm-annotations.md) | App behaviour that DASH cannot express uses the `rdm:` vocabulary |
| [0006](0006-single-stack.md) | One stack: TypeScript everywhere, including tools and tests |
| [0007](0007-workspaces-and-widgets.md) | Workspace packages and a widget registry |
| [0008](0008-memory-store.md) | An in-memory SPARQL store for tests and the demo |
