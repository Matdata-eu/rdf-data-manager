import { describe, expect, it } from 'vitest'
import { axisOrder, parseWkt, writeWkt, CRS84, EPSG4326 } from '../src/wkt'
import { mapWidget, WKT_LITERAL, HAS_GEOMETRY, GEOMETRY } from '../src'
import type { PropertyShape } from '@rdf-data-manager/core'
import { namedNode } from '@rdf-data-manager/core'

const point = 'POINT (10.75 59.91)'

function property (over: Partial<PropertyShape>): PropertyShape {
  return {
    id: namedNode('urn:p'),
    key: 'p',
    path: namedNode('urn:path'),
    name: {},
    description: {},
    order: 0,
    classes: [],
    uniqueLang: false,
    readOnly: false,
    hidden: false,
    updateOnSave: false,
    orderDescending: false,
    ...over
  }
}

describe('wkt', () => {
  it('round-trips the geometry types', () => {
    for (const w of [
      point,
      `<${CRS84}> POINT (10.75 59.91)`,
      'LINESTRING (10 59, 11 60, 12 61)',
      'POLYGON ((10 59, 11 59, 11 60, 10 59), (10.2 59.2, 10.4 59.2, 10.4 59.4, 10.2 59.2))',
      'MULTIPOINT (10 59, 11 60)',
      'MULTILINESTRING ((10 59, 11 60), (12 61, 13 62))',
      'MULTIPOLYGON (((10 59, 11 59, 11 60, 10 59)), ((20 59, 21 59, 21 60, 20 59)))'
    ]) expect(writeWkt(parseWkt(w))).toBe(w)
  })

  it('reads the CRS prefix and the EPSG:4326 axis order', () => {
    const w = parseWkt(`<${EPSG4326}> POINT (59.91 10.75)`)
    expect(w.crs).toBe(EPSG4326)
    expect(axisOrder(w.crs)).toBe('latlon')
    expect(axisOrder(undefined)).toBe('lonlat')
    expect(axisOrder('http://www.opengis.net/def/crs/EPSG/0/25833')).toBeUndefined()
  })

  it('rejects text that is not WKT', () => {
    expect(() => parseWkt('somewhere')).toThrow()
    expect(() => parseWkt('POINT (a b)')).toThrow()
    expect(() => parseWkt('POINT ((1 2)')).toThrow()
  })
})

describe('map widget', () => {
  it('claims wktLiteral properties and geometry nodes, nothing else', () => {
    expect(mapWidget.score(property({ datatype: WKT_LITERAL }))).toBe(20)
    expect(mapWidget.score(property({ path: namedNode(HAS_GEOMETRY), node: 'urn:shape', classes: [GEOMETRY] }))).toBe(20)
    expect(mapWidget.score(property({ datatype: 'http://www.w3.org/2001/XMLSchema#string' }))).toBe(0)
  })
})
