/**
 * A small WKT reader and writer for the geometries GeoSPARQL data uses. Coordinates are
 * kept as [x, y] pairs in the literal's own axis order; `axisOrder` says what that is.
 */
export type Position = [number, number]
export type Geometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'LineString'; coordinates: Position[] }
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPoint'; coordinates: Position[] }
  | { type: 'MultiLineString'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] }

export interface Wkt {
  /** CRS IRI from the literal's <…> prefix; undefined means CRS84 (longitude, latitude). */
  crs?: string
  geometry: Geometry
}

export const CRS84 = 'http://www.opengis.net/def/crs/OGC/1.3/CRS84'
export const EPSG4326 = 'http://www.opengis.net/def/crs/EPSG/0/4326'

/** 'lonlat' for CRS84 and the default; 'latlon' for EPSG:4326; undefined for a CRS the map cannot show. */
export function axisOrder (crs?: string): 'lonlat' | 'latlon' | undefined {
  if (!crs || crs === CRS84) return 'lonlat'
  if (crs === EPSG4326) return 'latlon'
  return undefined
}

function positions (text: string): Position[] {
  return text.trim().split(/\s*,\s*/).map(pair => {
    const nums = pair.trim().split(/\s+/).map(Number)
    if (nums.length < 2 || nums.slice(0, 2).some(n => !Number.isFinite(n))) throw new Error(`Bad coordinate "${pair}"`)
    return [nums[0], nums[1]]
  })
}

function rings (text: string): Position[][] {
  return groups(text).map(positions)
}

/** Splits "(a),(b)" at the top level into ["a", "b"]. */
function groups (text: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = -1
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '(') {
      if (depth === 0) start = i + 1
      depth++
    } else if (c === ')') {
      depth--
      if (depth === 0) out.push(text.slice(start, i))
    }
  }
  if (depth !== 0) throw new Error('Unbalanced parentheses')
  return out
}

export function parseWkt (literal: string): Wkt {
  let text = literal.trim()
  let crs: string | undefined
  const m = /^<([^>]+)>\s*/.exec(text)
  if (m) {
    crs = m[1]
    text = text.slice(m[0].length)
  }
  const head = /^([A-Za-z]+)\s*(Z|M|ZM)?\s*(EMPTY|\()/.exec(text)
  if (!head) throw new Error('Not a WKT geometry')
  const type = head[1].toUpperCase()
  if (head[3] === 'EMPTY') throw new Error('Empty geometry')
  const body = text.slice(head[0].length - 1)
  switch (type) {
    case 'POINT': return { crs, geometry: { type: 'Point', coordinates: positions(groups(body)[0])[0] } }
    case 'LINESTRING': return { crs, geometry: { type: 'LineString', coordinates: positions(groups(body)[0]) } }
    case 'POLYGON': return { crs, geometry: { type: 'Polygon', coordinates: rings(groups(body)[0]) } }
    case 'MULTIPOINT': {
      const inner = groups(body)[0]
      const coords = inner.includes('(') ? groups(inner).map(g => positions(g)[0]) : positions(inner)
      return { crs, geometry: { type: 'MultiPoint', coordinates: coords } }
    }
    case 'MULTILINESTRING': return { crs, geometry: { type: 'MultiLineString', coordinates: rings(groups(body)[0]) } }
    case 'MULTIPOLYGON': return { crs, geometry: { type: 'MultiPolygon', coordinates: groups(groups(body)[0]).map(rings) } }
  }
  throw new Error(`Unsupported geometry type ${type}`)
}

const num = (n: number) => Number.isInteger(n) ? String(n) : String(Number(n.toFixed(7)))
const pos = (p: Position) => `${num(p[0])} ${num(p[1])}`
const list = (ps: Position[]) => `(${ps.map(pos).join(', ')})`
const ringList = (rs: Position[][]) => `(${rs.map(list).join(', ')})`

export function writeWkt ({ crs, geometry }: Wkt): string {
  const prefix = crs ? `<${crs}> ` : ''
  switch (geometry.type) {
    case 'Point': return `${prefix}POINT (${pos(geometry.coordinates)})`
    case 'LineString': return `${prefix}LINESTRING ${list(geometry.coordinates)}`
    case 'Polygon': return `${prefix}POLYGON ${ringList(geometry.coordinates)}`
    case 'MultiPoint': return `${prefix}MULTIPOINT ${list(geometry.coordinates)}`
    case 'MultiLineString': return `${prefix}MULTILINESTRING ${ringList(geometry.coordinates)}`
    case 'MultiPolygon': return `${prefix}MULTIPOLYGON (${geometry.coordinates.map(ringList).join(', ')})`
  }
}

/** Every position of a geometry, for fitting the map. */
export function allPositions (g: Geometry): Position[] {
  switch (g.type) {
    case 'Point': return [g.coordinates]
    case 'LineString': case 'MultiPoint': return g.coordinates
    case 'Polygon': case 'MultiLineString': return g.coordinates.flat()
    case 'MultiPolygon': return g.coordinates.flat(2)
  }
}

/** Converts a position in the literal's axis order to [latitude, longitude] for the map. */
export function toLatLng (p: Position, order: 'lonlat' | 'latlon'): [number, number] {
  return order === 'lonlat' ? [p[1], p[0]] : [p[0], p[1]]
}

export function fromLatLng (lat: number, lng: number, order: 'lonlat' | 'latlon'): Position {
  return order === 'lonlat' ? [lng, lat] : [lat, lng]
}
