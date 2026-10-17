# Changelog

## [1.0.0](https://github.com/Matdata-eu/rdf-data-manager/compare/v0.1.0...v1.0.0) (2026-10-17)


### ⚠ BREAKING CHANGES

* source paths and the config.json shape changed; see docs/ARCHITECTURE.md and docs/CONFIG.md.

### refactor

* split into core, react, app and shapes-dim workspace packages ([4719ee8](https://github.com/Matdata-eu/rdf-data-manager/commit/4719ee81e48982b0bb6e00dba005503a06dade0a))


### Features

* **app:** feature tour demo with every editor, widget and SHACL feature ([e31f5e9](https://github.com/Matdata-eu/rdf-data-manager/commit/e31f5e93e42a3b289bfc4bee586f7dea6973b94e))
* **app:** validation overview, change review, translation grid, search, used-by, import and export ([2410a2c](https://github.com/Matdata-eu/rdf-data-manager/commit/2410a2ca7ccac1b895fe412e6a28571f8ce6389d))
* **core:** sh:or and sh:xone fields, sh:closed awareness, predicate targets ([90449a3](https://github.com/Matdata-eu/rdf-data-manager/commit/90449a33e1e46ef2a152c75d273b30dcc973c322))
* **widgets:** map and time widgets as workspace packages ([8152847](https://github.com/Matdata-eu/rdf-data-manager/commit/815284794edcbac6ce42bf9c89ba29bcdef866c9))


### Bug fixes

* **core:** replace an edited blank node as a whole in the update ([0241dd6](https://github.com/Matdata-eu/rdf-data-manager/commit/0241dd647cca8830ea93d58530c3d6ffd976e0ee))
* **react:** show problems inside a node that a widget edits as a whole ([71d06dd](https://github.com/Matdata-eu/rdf-data-manager/commit/71d06dd8a68b2c92c0d8b8303e4eb591864e7ac1))
