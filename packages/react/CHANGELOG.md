# Changelog

## [1.0.0](https://github.com/Matdata-eu/rdf-data-manager/compare/v0.1.0...v1.0.0) (2026-10-17)


### ⚠ BREAKING CHANGES

* source paths and the config.json shape changed; see docs/ARCHITECTURE.md and docs/CONFIG.md.

### refactor

* split into core, react, app and shapes-dim workspace packages ([4719ee8](https://github.com/Matdata-eu/rdf-data-manager/commit/4719ee81e48982b0bb6e00dba005503a06dade0a))


### Features

* **app:** UI messages in Norwegian Bokmål (nn falls back) ([7853afa](https://github.com/Matdata-eu/rdf-data-manager/commit/7853afa3c1f1dc847c719697cb8fba7c3229a60c))
* **app:** validation overview, change review, translation grid, search, used-by, import and export ([2410a2c](https://github.com/Matdata-eu/rdf-data-manager/commit/2410a2ca7ccac1b895fe412e6a28571f8ce6389d))
* **widgets:** map and time widgets as workspace packages ([8152847](https://github.com/Matdata-eu/rdf-data-manager/commit/815284794edcbac6ce42bf9c89ba29bcdef866c9))


### Bug fixes

* **react:** show problems inside a node that a widget edits as a whole ([71d06dd](https://github.com/Matdata-eu/rdf-data-manager/commit/71d06dd8a68b2c92c0d8b8303e4eb591864e7ac1))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @rdf-data-manager/core bumped from 0.1.0 to 1.0.0
