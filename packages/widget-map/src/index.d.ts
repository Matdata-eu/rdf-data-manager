import type { Widget } from '@rdf-data-manager/react'
import './map.css'
export { configureMap, mapOptions } from './options'
export { parseWkt, writeWkt, type Wkt, type Geometry } from './wkt'
export declare const WKT_LITERAL = 'http://www.opengis.net/ont/geosparql#wktLiteral'
export declare const AS_WKT = 'http://www.opengis.net/ont/geosparql#asWKT'
export declare const GEOMETRY = 'http://www.opengis.net/ont/geosparql#Geometry'
export declare const HAS_GEOMETRY = 'http://www.opengis.net/ont/geosparql#hasGeometry'
export declare const MAP_EDITOR = 'https://matdata.eu/ns/rdf-data-manager#MapEditor'
/** Map editor and viewer for GeoSPARQL geometries, as dash:editor rdm:MapEditor or by score. */
export declare const mapWidget: Widget
export default mapWidget
// # sourceMappingURL=index.d.ts.map
