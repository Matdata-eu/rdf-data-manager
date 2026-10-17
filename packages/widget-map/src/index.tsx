import { firstText, withText, type PropertyShape, type Term } from '@rdf-data-manager/core'
import type { Widget, WidgetEditorProps, WidgetViewerProps } from '@rdf-data-manager/react'
import { MapEditor } from './MapEditor'
import './map.css'

export { configureMap, mapOptions } from './options'
export { parseWkt, writeWkt, type Wkt, type Geometry } from './wkt'

const GEO = 'http://www.opengis.net/ont/geosparql#'
export const WKT_LITERAL = `${GEO}wktLiteral`
export const AS_WKT = `${GEO}asWKT`
export const GEOMETRY = `${GEO}Geometry`
export const HAS_GEOMETRY = `${GEO}hasGeometry`
export const MAP_EDITOR = 'https://matdata.eu/ns/rdf-data-manager#MapEditor'

/** A geo:wktLiteral property, or geo:asWKT. */
function isWktProperty (p: PropertyShape): boolean {
  return p.datatype === WKT_LITERAL || p.path.value === AS_WKT
}

/** A property whose values are geometry nodes edited in place (geo:hasGeometry with sh:node). */
function isGeometryNode (p: PropertyShape): boolean {
  return Boolean(p.node) && (p.classes.includes(GEOMETRY) || p.path.value === HAS_GEOMETRY)
}

function score (p: PropertyShape, _value?: Term): number {
  return isWktProperty(p) || isGeometryNode(p) ? 20 : 0
}

function Editor ({ value, onChange, id, invalid }: WidgetEditorProps) {
  if (value.node) {
    // The whole geometry node is ours: its WKT literal is what the map edits.
    const node = value.node
    return (
      <MapEditor
        id={id} invalid={invalid} wkt={firstText(node, AS_WKT)}
        onChange={wkt => onChange({ ...value, node: withText(node, AS_WKT, wkt) })}
      />
    )
  }
  return <MapEditor id={id} invalid={invalid} wkt={value.text} onChange={text => onChange({ ...value, text })} />
}

function Viewer ({ value }: WidgetViewerProps) {
  const wkt = value.node ? firstText(value.node, AS_WKT) : value.text
  return <MapEditor id='' wkt={wkt} readOnly />
}

/** Map editor and viewer for GeoSPARQL geometries, as dash:editor rdm:MapEditor or by score. */
export const mapWidget: Widget = { id: MAP_EDITOR, score, Editor, Viewer }

export default mapWidget
