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

const ESTADO_COLORS = {
  'Disponible': '#16a34a', 'Adjudicado': '#FB7520', 'Reservado': '#FB7520',
  'Entregado': '#2563eb', 'Escriturado': '#7c3aed', 'No Disponible': '#64748b',
}
const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const TILE_ATTR = '© Esri, Maxar'

export default function SatelliteView({ lots, manzanas, georef, onSelect }) {
  const mapRef = useRef(null)
  const containerRef = useRef(null)

  const toLatLon = useMemo(() => buildTransform(georef), [georef])

  useEffect(() => {
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

    const allPts = lots.flatMap(l => l.pts)
    const cx = allPts.reduce((s, p) => s + p[0], 0) / allPts.length
    const cy = allPts.reduce((s, p) => s + p[1], 0) / allPts.length
    const [clat, clon] = toLatLon(cx, cy)

    const map = L.map(containerRef.current, {
      center: [clat, clon], zoom: 17, zoomControl: false,
    })
    mapRef.current = map
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map)

    // Manzana outlines
    for (const m of manzanas) {
      const coords = m.pts.map(([x, y]) => toLatLon(x, y))
      L.polygon(coords, { color: '#fff', weight: 1.5, fillOpacity: 0, dashArray: '4 4' })
        .addTo(map).bindTooltip(m.label, { permanent: false, className: 'sat-tip' })
    }

    // Lots
    for (const lot of lots) {
      if (lot.tipo === 'verde') {
        L.polygon(lot.pts.map(([x, y]) => toLatLon(x, y)), {
          color: '#22c55e', weight: 1, fillColor: '#22c55e', fillOpacity: 0.3,
        }).addTo(map)
        continue
      }
      const color = ESTADO_COLORS[lot.estado] || '#475569'
      const coords = lot.pts.map(([x, y]) => toLatLon(x, y))
      const poly = L.polygon(coords, {
        color: '#fff', weight: 0.7, fillColor: color, fillOpacity: 0.5,
      }).addTo(map)
      const info = [
        `<b>Mza ${lot.manzana} · Lote ${lot.numero}</b>`,
        lot.estado || '', lot.terreno ? `${lot.terreno} m²` : '',
        lot.costo ? `USD ${lot.costo.toLocaleString()}` : '',
      ].filter(Boolean).join('<br/>')
      poly.bindPopup(info)
      poly.bindTooltip(`${lot.manzana}-${lot.numero}`, { permanent: false, className: 'sat-tip' })
      if (onSelect) poly.on('click', () => onSelect(lot))
    }

    const allLatLon = lots.flatMap(l => l.pts.map(([x, y]) => toLatLon(x, y)))
    if (allLatLon.length) map.fitBounds(allLatLon, { padding: [20, 20] })

    return () => { map.remove(); mapRef.current = null }
  }, [lots, manzanas, toLatLon, onSelect])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 2 }} />
}
