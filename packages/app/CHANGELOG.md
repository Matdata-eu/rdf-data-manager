# Changelog

## [1.0.0](https://github.com/Matdata-eu/rdf-data-manager/compare/v0.1.0...v1.0.0) (2026-10-17)


### ⚠ BREAKING CHANGES

* source paths and the config.json shape changed; see docs/ARCHITECTURE.md and docs/CONFIG.md.

### refactor

* split into core, react, app and shapes-dim workspace packages ([4719ee8](https://github.com/Matdata-eu/rdf-data-manager/commit/4719ee81e48982b0bb6e00dba005503a06dade0a))


### Features

* **app:** demo mode that runs a bundled dataset in the browser ([b3f11b6](https://github.com/Matdata-eu/rdf-data-manager/commit/b3f11b622207ef6cafded4e95a1c8531deaa85fc))
* **app:** feature tour demo with every editor, widget and SHACL feature ([e31f5e9](https://github.com/Matdata-eu/rdf-data-manager/commit/e31f5e93e42a3b289bfc4bee586f7dea6973b94e))
* **app:** UI messages in Norwegian Bokmål (nn falls back) ([7853afa](https://github.com/Matdata-eu/rdf-data-manager/commit/7853afa3c1f1dc847c719697cb8fba7c3229a60c))
* **app:** validation overview, change review, translation grid, search, used-by, import and export ([2410a2c](https://github.com/Matdata-eu/rdf-data-manager/commit/2410a2ca7ccac1b895fe412e6a28571f8ce6389d))
* **core:** sh:or and sh:xone fields, sh:closed awareness, predicate targets ([90449a3](https://github.com/Matdata-eu/rdf-data-manager/commit/90449a33e1e46ef2a152c75d273b30dcc973c322))
* **widget-map:** draw lines and polygons and drag their vertices ([5e340ee](https://github.com/Matdata-eu/rdf-data-manager/commit/5e340ee1dcc6772d307f1d6ca2b63a224ea66b4b))
* **widgets:** map and time widgets as workspace packages ([8152847](https://github.com/Matdata-eu/rdf-data-manager/commit/815284794edcbac6ce42bf9c89ba29bcdef866c9))


### Documentation

* keep the rdm: vocabulary in one place ([5494e56](https://github.com/Matdata-eu/rdf-data-manager/commit/5494e56248f9368c7cfe893b1348480ee2818f57))
* publish the rdm: vocabulary and seed the change log ([1886e7b](https://github.com/Matdata-eu/rdf-data-manager/commit/1886e7bff082462e21aeb387317ff827f5d28135))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @rdf-data-manager/core bumped from 0.1.0 to 1.0.0
    * @rdf-data-manager/react bumped from 0.1.0 to 1.0.0
    * @rdf-data-manager/widget-map bumped from 0.1.0 to 0.2.0
    * @rdf-data-manager/widget-time bumped from 0.1.0 to 0.2.0
    * @rdf-data-manager/store-memory bumped from 0.1.0 to 0.2.0
