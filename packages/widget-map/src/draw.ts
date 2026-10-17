import type { Geometry, Position } from './wkt'

/** What a click on the map does: place a point, or add a vertex to a line or polygon being drawn. */
export type DrawMode = 'Point' | 'LineString' | 'Polygon'

/** Vertices a drawn geometry needs before it can be finished. */
export const MIN_VERTICES: Record<DrawMode, number> = { Point: 1, LineString: 2, Polygon: 3 }

/**
 * Turns the vertices clicked while drawing into a geometry, or undefined while there are
 * too few. A polygon's ring is closed by repeating its first vertex, as WKT requires.
 */
export function finishDraft (mode: DrawMode, draft: Position[]): Geometry | undefined {
  if (draft.length < MIN_VERTICES[mode]) return undefined
  switch (mode) {
    case 'Point': return { type: 'Point', coordinates: draft[draft.length - 1] }
    case 'LineString': return { type: 'LineString', coordinates: draft }
    case 'Polygon': return { type: 'Polygon', coordinates: [closeRing(draft)] }
  }
}

function closeRing (ring: Position[]): Position[] {
  const [first] = ring
  const last = ring[ring.length - 1]
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first]
}

/** One movable vertex of a geometry: its position and where it sits ([ring, index] or [index]). */
export interface Vertex {
  at: number[]
  position: Position
}

/**
 * The vertices that can be dragged. A polygon ring's closing vertex is left out, since it
 * moves together with the first one.
 */
export function vertices (g: Geometry): Vertex[] {
  switch (g.type) {
    case 'Point': return [{ at: [], position: g.coordinates }]
    case 'LineString': case 'MultiPoint': return g.coordinates.map((position, i) => ({ at: [i], position }))
    case 'MultiLineString': return g.coordinates.flatMap((line, l) => line.map((position, i) => ({ at: [l, i], position })))
    case 'Polygon': return ringVertices(g.coordinates, [])
    case 'MultiPolygon': return g.coordinates.flatMap((rings, p) => ringVertices(rings, [p]))
  }
}

function ringVertices (rings: Position[][], prefix: number[]): Vertex[] {
  return rings.flatMap((ring, r) => (isClosed(ring) ? ring.slice(0, -1) : ring).map((position, i) => ({ at: [...prefix, r, i], position })))
}

function isClosed (ring: Position[]): boolean {
  if (ring.length < 2) return false
  const first = ring[0]
  const last = ring[ring.length - 1]
  return first[0] === last[0] && first[1] === last[1]
}

/** Moves one vertex; moving a ring's first vertex moves its closing vertex too. */
export function moveVertex (g: Geometry, at: number[], to: Position): Geometry {
  const ring = (r: Position[], i: number): Position[] => {
    const closed = isClosed(r)
    return r.map((p, j) => j === i || (closed && i === 0 && j === r.length - 1) ? to : p)
  }
  switch (g.type) {
    case 'Point': return { ...g, coordinates: to }
    case 'LineString': case 'MultiPoint': return { ...g, coordinates: g.coordinates.map((p, i) => i === at[0] ? to : p) }
    case 'MultiLineString': return { ...g, coordinates: g.coordinates.map((l, i) => i === at[0] ? l.map((p, j) => j === at[1] ? to : p) : l) }
    case 'Polygon': return { ...g, coordinates: g.coordinates.map((r, i) => i === at[0] ? ring(r, at[1]) : r) }
    case 'MultiPolygon': return { ...g, coordinates: g.coordinates.map((rs, p) => p === at[0] ? rs.map((r, i) => i === at[1] ? ring(r, at[2]) : r) : rs) }
  }
}
