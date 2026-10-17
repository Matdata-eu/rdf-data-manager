import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as LeafletMap, Layer } from 'leaflet'
import { allPositions, axisOrder, fromLatLng, parseWkt, toLatLng, writeWkt, type Wkt } from './wkt'
import { mapOptions } from './options'

interface Props {
  /** The WKT literal being edited. */
  wkt: string
  onChange?: (wkt: string) => void
  id: string
  invalid?: boolean
  readOnly?: boolean
}

/** Shows a WKT geometry on a map. A point can be placed by clicking and moved by dragging. */
export function MapEditor ({ wkt, onChange, id, invalid, readOnly }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap>(null)
  const layerRef = useRef<Layer>(null)
  const [L, setL] = useState<typeof import('leaflet')>()
  const latest = useRef({ wkt, onChange })
  useEffect(() => { latest.current = { wkt, onChange } })

  // The literal is parsed once per change; the map effect below only draws it.
  const parsed = useMemo((): { wkt?: Wkt; order?: 'lonlat' | 'latlon'; error?: string } => {
    if (!wkt.trim()) return {}
    let geometry: Wkt
    try {
      geometry = parseWkt(wkt)
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
    const order = axisOrder(geometry.crs)
    if (!order) return { error: 'This coordinate reference system cannot be shown on the map; edit the text.' }
    return { wkt: geometry, order }
  }, [wkt])
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
        const { wkt: current, onChange } = latest.current
        if (!onChange) return
        let parsed: Wkt | undefined
        try { parsed = current.trim() ? parseWkt(current) : undefined } catch { parsed = undefined }
        // Only a point, or an empty value, is placed by clicking; other shapes are edited as text.
        if (parsed && parsed.geometry.type !== 'Point') return
        const order = axisOrder(parsed?.crs) ?? 'lonlat'
        onChange(writeWkt({ crs: parsed?.crs, geometry: { type: 'Point', coordinates: fromLatLng(e.latlng.lat, e.latlng.lng, order) } }))
      })
    }
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [L, readOnly])

  // Redraw whenever the literal changes.
  useEffect(() => {
    const map = mapRef.current
    if (!L || !map) return
    if (layerRef.current) {
      layerRef.current.remove()
      layerRef.current = null
    }
    if (!parsed.wkt || !parsed.order) return
    const { order } = parsed
    const g = parsed.wkt.geometry
    const ll = (p: [number, number]) => toLatLng(p, order)
    let layer: Layer
    switch (g.type) {
      case 'Point': {
        const marker = L.marker(ll(g.coordinates), { draggable: !readOnly, icon: L.divIcon({ className: 'rdm-map-marker', iconSize: [16, 16], iconAnchor: [8, 8] }) })
        marker.on('dragend', () => {
          const { lat, lng } = marker.getLatLng()
          latest.current.onChange?.(writeWkt({ crs: parsed.wkt?.crs, geometry: { type: 'Point', coordinates: fromLatLng(lat, lng, order) } }))
        })
        layer = marker
        break
      }
      case 'MultiPoint':
        layer = L.featureGroup(g.coordinates.map(p => L.circleMarker(ll(p), { radius: 5 })))
        break
      case 'LineString':
        layer = L.polyline(g.coordinates.map(ll))
        break
      case 'MultiLineString':
        layer = L.polyline(g.coordinates.map(line => line.map(ll)))
        break
      case 'Polygon':
        layer = L.polygon(g.coordinates.map(ring => ring.map(ll)))
        break
      case 'MultiPolygon':
        layer = L.polygon(g.coordinates.map(poly => poly.map(ring => ring.map(ll))))
        break
    }
    layer.addTo(map)
    layerRef.current = layer
    const points = allPositions(g).map(ll)
    if (points.length === 1) map.setView(points[0], Math.max(map.getZoom(), 12))
    else map.fitBounds(L.latLngBounds(points), { padding: [16, 16] })
  }, [L, parsed, readOnly])

  return (
    <div className='rdm-map'>
      <div ref={host} className='rdm-map-canvas' aria-label='Map' role='application' />
      {!L && <p className='muted small'>Loading map…</p>}
      {error && <p className='rdm-map-error'>{error}</p>}
      {readOnly
        ? <code className='rdm-map-wkt'>{wkt}</code>
        : (
            <textarea
              id={id} aria-label='WKT' aria-invalid={invalid} rows={2} className='rdm-map-wkt' spellCheck={false}
              placeholder='POINT (10.75 59.91)' value={wkt} onChange={e => onChange?.(e.target.value)}
            />
          )}
      {!readOnly && <span className='hint'>Click the map to place a point, drag it to move it, or edit the WKT text. Coordinates are longitude then latitude unless the literal names another CRS.</span>}
    </div>
  )
}
