import { describe, expect, it } from 'vitest'
import { finishDraft, moveVertex, vertices } from '../src/draw'
import { parseWkt, writeWkt } from '../src/wkt'

describe('drawing', () => {
  it('needs two vertices for a line and three for a polygon', () => {
    expect(finishDraft('LineString', [[1, 2]])).toBeUndefined()
    expect(finishDraft('Polygon', [[0, 0], [1, 0]])).toBeUndefined()
    expect(writeWkt({ geometry: finishDraft('LineString', [[1, 2], [3, 4]])! })).toBe('LINESTRING (1 2, 3 4)')
  })

  it('closes a drawn polygon ring', () => {
    expect(writeWkt({ geometry: finishDraft('Polygon', [[0, 0], [1, 0], [1, 1]])! })).toBe('POLYGON ((0 0, 1 0, 1 1, 0 0))')
  })

  it('places a point at the last click', () => {
    expect(finishDraft('Point', [[1, 2], [5, 6]])).toEqual({ type: 'Point', coordinates: [5, 6] })
  })
})

describe('vertex editing', () => {
  it('lists a polygon ring without its closing vertex', () => {
    const g = parseWkt('POLYGON ((0 0, 1 0, 1 1, 0 0))').geometry
    expect(vertices(g).map(v => v.at)).toEqual([[0, 0], [0, 1], [0, 2]])
  })

  it('moves the closing vertex together with the first', () => {
    const g = parseWkt('POLYGON ((0 0, 1 0, 1 1, 0 0))').geometry
    expect(writeWkt({ geometry: moveVertex(g, [0, 0], [5, 5]) })).toBe('POLYGON ((5 5, 1 0, 1 1, 5 5))')
  })

  it('moves one vertex of a line and keeps the CRS outside', () => {
    const { crs, geometry } = parseWkt('<http://www.opengis.net/def/crs/EPSG/0/4326> LINESTRING (59 10, 60 11)')
    expect(writeWkt({ crs, geometry: moveVertex(geometry, [1], [61, 12]) })).toBe('<http://www.opengis.net/def/crs/EPSG/0/4326> LINESTRING (59 10, 61 12)')
  })
})
