import { useEffect, useRef, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/* Affine transform: DXF (x,y) → [lat, lon] */
function buildTransform(georef) {
  const [r1, r2] = georef
  const [x1, y1] = r1.dxf, [lat1, lon1] = r1.ll
  const [x2, y2] = r2.dxf, [lat2, lon2] = r2.ll
  const dx = x2 - x1, dy = y2 - y1
  const dlat = lat2 - lat1, dlon = lon2 - lon1
  const d2 = dx * dx + dy * dy
  const rLat = dlat / d2, rLon = dlon / d2
  const cosLat = Math.cos((lat1 + lat2) / 2 * Math.PI / 180)
  return (x, y) => {
    const ox = x - x1, oy = y - y1
    const along_lat = (ox * dx + oy * dy) * rLat
    const along_lon = (ox * dx + oy * dy) * rLon
    const perp = (ox * dy - oy * dx) / d2
    const perp_lat = -perp * dlon * cosLat
    const perp_lon = perp * dlat / cosLat
    return [lat1 + along_lat + perp_lat, lon1 + along_lon + perp_lon]
  }
}

const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const TILE_ATTR = '© Esri, Maxar'

export default function SatelliteView({
  lots,          // lots ya procesados (mismos que la vista SVG)
  manzanas,
  greens = [],
  georef,
  colorOf,       // función (lot) => color, la misma que en la vista SVG
  matches,       // función (lot) => bool, aplica filtros
  selId,         // id del lote seleccionado
  onSelect,      // callback cuando clickean un lote
}) {
  const mapRef = useRef(null)
  const containerRef = useRef(null)
  const layerLotsRef = useRef(null)      // capa de lotes (se recrea al cambiar color/filtros)
  const layerMznsRef = useRef(null)      // capa de manzanas (una vez)
  const layerGreensRef = useRef(null)    // capa de verdes (una vez)
  const polyByIdRef = useRef(new Map())  // id → polygon para poder resaltar seleccionado

  const toLatLon = useMemo(() => buildTransform(georef), [georef])

  /* ───── Crear mapa base UNA sola vez ───── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const allPts = lots.flatMap(l => l.pts)
    if (allPts.length === 0) return
    const cx = allPts.reduce((s, p) => s + p[0], 0) / allPts.length
    const cy = allPts.reduce((s, p) => s + p[1], 0) / allPts.length
    const [clat, clon] = toLatLon(cx, cy)

    const map = L.map(containerRef.current, {
      center: [clat, clon], zoom: 17, zoomControl: false,
    })
    mapRef.current = map
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map)

    // Capas de manzanas y verdes (no cambian con filtros)
    layerMznsRef.current = L.layerGroup().addTo(map)
    layerGreensRef.current = L.layerGroup().addTo(map)
    layerLotsRef.current = L.layerGroup().addTo(map)

    // Ajustar bounds inicial
    const allLatLon = lots.flatMap(l => l.pts.map(([x, y]) => toLatLon(x, y)))
    if (allLatLon.length) map.fitBounds(allLatLon, { padding: [20, 20] })

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      polyByIdRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // solo al montar

  /* ───── Manzanas (una vez) ───── */
  useEffect(() => {
    if (!layerMznsRef.current) return
    layerMznsRef.current.clearLayers()
    for (const m of manzanas) {
      const coords = m.pts.map(([x, y]) => toLatLon(x, y))
      L.polygon(coords, { color: '#fff', weight: 1.5, fillOpacity: 0, dashArray: '4 4' })
        .addTo(layerMznsRef.current)
        .bindTooltip(m.label || '', { permanent: false, className: 'sat-tip' })
    }
  }, [manzanas, toLatLon])

  /* ───── Espacios verdes (una vez) ───── */
  useEffect(() => {
    if (!layerGreensRef.current) return
    layerGreensRef.current.clearLayers()
    for (const g of greens) {
      const coords = g.pts.map(([x, y]) => toLatLon(x, y))
      L.polygon(coords, {
        color: '#22c55e', weight: 1, fillColor: '#22c55e', fillOpacity: 0.3,
      }).addTo(layerGreensRef.current)
    }
  }, [greens, toLatLon])

  /* ───── Lotes: se re-renderizan cuando cambia colorMode, filtros o selección ───── */
  useEffect(() => {
    if (!layerLotsRef.current) return
    layerLotsRef.current.clearLayers()
    polyByIdRef.current.clear()

    for (const lot of lots) {
      const visible = matches ? matches(lot) : true
      const color = colorOf ? colorOf(lot) : '#475569'
      const isSel = selId === lot.id
      const coords = lot.pts.map(([x, y]) => toLatLon(x, y))

      const poly = L.polygon(coords, {
        color: isSel ? '#ffff00' : '#fff',
        weight: isSel ? 2.5 : 0.7,
        fillColor: color,
        fillOpacity: visible ? 0.65 : 0.08,
        opacity: visible ? 1 : 0.25,
      }).addTo(layerLotsRef.current)

      const info = [
        `<b>Mza ${lot.manzana} · Lote ${lot.lote || lot.numero}</b>`,
        lot.estado || '',
        lot.m2_terreno ? `${lot.m2_terreno} m²` : '',
        lot.costo ? `USD ${Number(lot.costo).toLocaleString('es-AR')}` : '',
      ].filter(Boolean).join('<br/>')
      poly.bindPopup(info)
      poly.bindTooltip(`${lot.manzana}-${lot.lote || lot.numero}`, {
        permanent: false, className: 'sat-tip',
      })
      if (onSelect) poly.on('click', () => onSelect(lot))
      polyByIdRef.current.set(lot.id, poly)
    }
  }, [lots, colorOf, matches, selId, toLatLon, onSelect])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 2 }}
    />
  )
}
