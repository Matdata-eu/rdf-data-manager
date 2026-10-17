import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as LeafletMap, Layer, LayerGroup } from 'leaflet'
import { allPositions, axisOrder, fromLatLng, parseWkt, toLatLng, writeWkt, type Position, type Wkt } from './wkt'
import { finishDraft, MIN_VERTICES, moveVertex, vertices, type DrawMode } from './draw'
import { mapOptions } from './options'
import { useT } from '@rdf-data-manager/react'

interface Props {
  /** The WKT literal being edited. */
  wkt: string
  onChange?: (wkt: string) => void
  id: string
  invalid?: boolean
  readOnly?: boolean
}

const TOOLS: Array<[DrawMode, string]> = [['Point', 'Point'], ['LineString', 'Line'], ['Polygon', 'Polygon']]

/**
 * Shows a WKT geometry on a map. A point can be placed by clicking; the drawing tools draw a
 * line or a polygon vertex by vertex; every vertex of the shown geometry can be dragged.
 */
export function MapEditor ({ wkt, onChange, id, invalid, readOnly }: Props) {
  const t = useT()
  const host = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap>(null)
  const layerRef = useRef<Layer>(null)
  const draftRef = useRef<LayerGroup>(null)
  const [L, setL] = useState<typeof import('leaflet')>()
  /** The tool in use, and the vertices clicked so far (in the literal's axis order). */
  const [tool, setTool] = useState<DrawMode>()
  const [draft, setDraft] = useState<Position[]>([])
  const latest = useRef({ wkt, onChange, tool, draft })
  useEffect(() => { latest.current = { wkt, onChange, tool, draft } })

  // The literal is parsed once per change; the map effects below only draw it.
  const parsed = useMemo((): { wkt?: Wkt; order?: 'lonlat' | 'latlon'; error?: string } => {
    if (!wkt.trim()) return {}
    let geometry: Wkt
    try {
      geometry = parseWkt(wkt)
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
    const order = axisOrder(geometry.crs)
    if (!order) return { error: t('This coordinate reference system cannot be shown on the map; edit the text.') }
    return { wkt: geometry, order }
  }, [wkt, t])
  const error = parsed.error

  // Leaflet is loaded on first use, so forms without a geometry never pay for it.
  useEffect(() => {
    let cancelled = false
    void Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([mod]) => {
      if (!cancelled) setL(mod.default ?? mod)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!L || !host.current || mapRef.current) return
    const map = L.map(host.current, { zoomControl: true, attributionControl: true })
    L.tileLayer(mapOptions.tileUrl, { attribution: mapOptions.attribution, maxZoom: mapOptions.maxZoom }).addTo(map)
    map.setView(mapOptions.center, mapOptions.zoom)
    if (!readOnly) {
      map.on('click', e => {
        const { wkt: current, onChange, tool } = latest.current
        if (!onChange) return
        let existing: Wkt | undefined
        try { existing = current.trim() ? parseWkt(current) : undefined } catch { existing = undefined }
        const order = axisOrder(existing?.crs) ?? 'lonlat'
        const at = fromLatLng(e.latlng.lat, e.latlng.lng, order)
        if (tool === 'LineString' || tool === 'Polygon') {
          setDraft(d => [...d, at])
          return
        }
        // Without a tool, a click only places a point when there is none or a point already.
        if (!tool && existing && existing.geometry.type !== 'Point') return
        onChange(writeWkt({ crs: existing?.crs, geometry: { type: 'Point', coordinates: at } }))
        if (tool) setTool(undefined)
      })
    }
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [L, readOnly])

  // Redraw whenever the literal changes; while drawing, the stored geometry is not editable.
  useEffect(() => {
    const map = mapRef.current
    if (!L || !map) return
    if (layerRef.current) {
      layerRef.current.remove()
      layerRef.current = null
    }
    if (!parsed.wkt || !parsed.order) return
    const { order, wkt: literal } = parsed
    const g = literal.geometry
    const ll = (p: Position) => toLatLng(p, order)
    const group = L.featureGroup()
    switch (g.type) {
      case 'MultiPoint':
        g.coordinates.forEach(p => L.circleMarker(ll(p), { radius: 5 }).addTo(group))
        break
      case 'LineString':
        L.polyline(g.coordinates.map(ll)).addTo(group)
        break
      case 'MultiLineString':
        L.polyline(g.coordinates.map(line => line.map(ll))).addTo(group)
        break
      case 'Polygon':
        L.polygon(g.coordinates.map(ring => ring.map(ll))).addTo(group)
        break
      case 'MultiPolygon':
        L.polygon(g.coordinates.map(poly => poly.map(ring => ring.map(ll)))).addTo(group)
        break
    }
    const editable = !readOnly && !tool
    if (g.type === 'Point' || editable) {
      const icon = L.divIcon({ className: g.type === 'Point' ? 'rdm-map-marker' : 'rdm-map-vertex', iconSize: g.type === 'Point' ? [16, 16] : [12, 12] })
      for (const v of vertices(g)) {
        const marker = L.marker(ll(v.position), { draggable: editable, icon, keyboard: false })
        marker.on('dragend', () => {
          const { lat, lng } = marker.getLatLng()
          latest.current.onChange?.(writeWkt({ crs: literal.crs, geometry: moveVertex(g, v.at, fromLatLng(lat, lng, order)) }))
        })
        marker.addTo(group)
      }
    }
    group.addTo(map)
    layerRef.current = group
    const points = allPositions(g).map(ll)
    // No animation: a form that remounts mid-animation would leave Leaflet moving a removed map.
    if (points.length === 1) map.setView(points[0], Math.max(map.getZoom(), 12), { animate: false })
    else map.fitBounds(L.latLngBounds(points), { padding: [16, 16], animate: false })
  }, [L, parsed, readOnly, tool])

  // The line or polygon being drawn, with a dot on every vertex clicked so far.
  useEffect(() => {
    const map = mapRef.current
    if (!L || !map) return
    draftRef.current?.remove()
    draftRef.current = null
    if (!tool || draft.length === 0) return
    const order = parsed.order ?? 'lonlat'
    const pts = draft.map(p => toLatLng(p, order))
    const group = L.layerGroup()
    if (pts.length > 1) (tool === 'Polygon' ? L.polygon(pts, { dashArray: '4 4' }) : L.polyline(pts, { dashArray: '4 4' })).addTo(group)
    pts.forEach(p => L.circleMarker(p, { radius: 4 }).addTo(group))
    group.addTo(map)
    draftRef.current = group
  }, [L, tool, draft, parsed.order])

  const start = (mode: DrawMode) => {
    setDraft([])
    setTool(tool === mode ? undefined : mode)
  }
  const finish = () => {
    if (!tool) return
    const geometry = finishDraft(tool, draft)
    if (!geometry) return
    onChange?.(writeWkt({ crs: parsed.wkt?.crs, geometry }))
    setTool(undefined)
    setDraft([])
  }
  const cancel = () => { setTool(undefined); setDraft([]) }
  const drawing = tool === 'LineString' || tool === 'Polygon'

  return (
    // The drawing class sits on the wrapper: Leaflet owns the canvas element's classes.
    <div className={`rdm-map${tool ? ' drawing' : ''}`}>
      {!readOnly && (
        <div className='rdm-map-tools' role='toolbar' aria-label={t('Drawing tools')}>
          {TOOLS.map(([mode, label]) => (
            <button key={mode} type='button' className='button ghost small' aria-pressed={tool === mode} onClick={() => start(mode)}>
              {t(label)}
            </button>
          ))}
          {drawing && (
            <>
              <button type='button' className='button primary small' disabled={draft.length < MIN_VERTICES[tool]} onClick={finish}>{t('Finish')}</button>
              <button type='button' className='button ghost small' disabled={draft.length === 0} onClick={() => setDraft(d => d.slice(0, -1))}>{t('Undo point')}</button>
              <button type='button' className='button ghost small' onClick={cancel}>{t('Cancel')}</button>
            </>
          )}
        </div>
      )}
      <div ref={host} className='rdm-map-canvas' aria-label={t('Map')} role='application' />
      {!L && <p className='muted small'>{t('Loading map…')}</p>}
      {error && <p className='rdm-map-error'>{error}</p>}
      {readOnly
        ? <code className='rdm-map-wkt'>{wkt}</code>
        : (
            <textarea
              id={id} aria-label={t('WKT')} aria-invalid={invalid} rows={2} className='rdm-map-wkt' spellCheck={false}
              placeholder='POINT (10.75 59.91)' value={wkt} onChange={e => onChange?.(e.target.value)}
            />
          )}
      {!readOnly && (
        <span className='hint'>
          {drawing
            ? t(tool === 'Polygon'
              ? 'Click the map to add the corners of the polygon, then Finish. It replaces the current geometry.'
              : 'Click the map to add the points of the line, then Finish. It replaces the current geometry.')
            : t('Click the map to place a point, or pick Line or Polygon to draw one. Drag a vertex to move it, or edit the WKT text. Coordinates are longitude then latitude unless the literal names another CRS.')}
        </span>
      )}
    </div>
  )
}
