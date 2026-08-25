import { useEffect, useRef, useMemo, useCallback } from 'react'
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
  lots, manzanas, greens = [], georef,
  colorOf, matches, selId, onSelect,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const lotsLayerRef = useRef(null)

  const toLatLon = useMemo(() => buildTransform(georef), [georef])

  // Función para dibujar/redibujar lotes — se llama al montar Y cuando cambian filtros/colores
  const drawLots = useCallback(() => {
    if (!lotsLayerRef.current) return
    lotsLayerRef.current.clearLayers()

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
      }).addTo(lotsLayerRef.current)

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
    }
  }, [lots, colorOf, matches, selId, toLatLon, onSelect])

  // Crear mapa UNA vez al montar
  useEffect(() => {
    if (!containerRef.current) return

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

    // Manzanas
    for (const m of manzanas) {
      const coords = m.pts.map(([x, y]) => toLatLon(x, y))
      L.polygon(coords, { color: '#fff', weight: 1.5, fillOpacity: 0, dashArray: '4 4' })
        .addTo(map).bindTooltip(m.label || '', { permanent: false, className: 'sat-tip' })
    }

    // Espacios verdes
    for (const g of greens) {
      const coords = g.pts.map(([x, y]) => toLatLon(x, y))
      L.polygon(coords, {
        color: '#22c55e', weight: 1, fillColor: '#22c55e', fillOpacity: 0.3,
      }).addTo(map)
    }

    // Capa de lotes (se redibuja con drawLots)
    lotsLayerRef.current = L.layerGroup().addTo(map)

    // Bounds
    const allLatLon = lots.flatMap(l => l.pts.map(([x, y]) => toLatLon(x, y)))
    if (allLatLon.length) map.fitBounds(allLatLon, { padding: [20, 20] })

    // Dibujar lotes iniciales
    drawLots()

    return () => {
      map.remove()
      mapRef.current = null
      lotsLayerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // solo al montar

  // Redibujar lotes cuando cambian filtros, colores o selección
  useEffect(() => {
    drawLots()
  }, [drawLots])

  return (
    <div ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 2 }}
    />
  )
}
