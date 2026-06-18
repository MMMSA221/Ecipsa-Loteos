import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { getEmprendimiento } from '../data/loader'
import MANIFEST from '../data/manifest.json'
import SatelliteView from '../components/SatelliteView'

/* ───────── Infraestructura (íconos + orden) ───────── */
const INFRA_ITEMS = [
  { tipo: 'gas',             name: 'Gas',                        short: 'Gas',         color: '#ef4444' },
  { tipo: 'agua',            name: 'Agua',                       short: 'Agua',        color: '#2563eb' },
  { tipo: 'cloacas',         name: 'Cloacas',                    short: 'Cloacas',     color: '#7c3aed' },
  { tipo: 'electricidad',    name: 'Electricidad e Iluminación', short: 'Elec.',       color: '#f59e0b' },
  { tipo: 'espacios_verdes', name: 'Espacios Verdes',            short: 'Esp.V.',      color: '#16a34a' },
  { tipo: 'red_vial',        name: 'Red Vial',                   short: 'Vial',        color: '#64748b' },
]
function InfraIcon({ tipo, color, size = 14 }) {
  const s = { width: size, height: size, display: 'block', flexShrink: 0 }
  if (tipo === 'gas') return (<svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c-3 5-5 8-5 12a5 5 0 0 0 10 0c0-4-2-7-5-12z"/></svg>)
  if (tipo === 'agua') return (<svg style={s} viewBox="0 0 24 24"><path d="M12 2C8 8 5 12 5 16a7 7 0 0 0 14 0c0-4-3-8-7-14z" fill={color}/></svg>)
  if (tipo === 'cloacas') return (<svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="3" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="21"/><line x1="3" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="21" y2="12"/></svg>)
  if (tipo === 'electricidad') return (<svg style={s} viewBox="0 0 24 24" fill={color}><path d="M13 2L4 13h7l-1 9 9.5-12H13z"/></svg>)
  if (tipo === 'espacios_verdes') return (<svg style={s} viewBox="0 0 24 24" fill={color}><ellipse cx="8" cy="13" rx="5" ry="5.5"/><ellipse cx="16" cy="14" rx="5" ry="5.5"/><ellipse cx="12" cy="10" rx="5.5" ry="5.5"/><rect x="11" y="18" width="2" height="4" rx="1"/></svg>)
  if (tipo === 'red_vial') return (<svg style={s} viewBox="0 0 24 24" fill={color}><rect x="2" y="3" width="9" height="4.5" rx="1"/><rect x="13" y="3" width="9" height="4.5" rx="1"/><rect x="6" y="9.5" width="12" height="4.5" rx="1"/><rect x="2" y="16" width="9" height="4.5" rx="1"/><rect x="13" y="16" width="9" height="4.5" rx="1"/></svg>)
  return <span style={{ fontSize: size - 3, color }}>{tipo[0].toUpperCase()}</span>
}

/* ───────── Estado: valor canónico de la BD → 4 buckets del tablero ───────── */
function normEstado(e) {
  if (!e) return 'Sin datos'
  if (e === 'Escriturado') return 'Entregado'
  if (e === 'Reservado' || e === 'Reservado SAAT' || e === 'Directorio - Reservado') return 'Adjudicado'
  return e // Disponible | Adjudicado | Entregado | No Disponible
}

/* ───────── Esquemas de color (del Tablero v10) ───────── */
const SCHEMES = {
  estado: {
    tab: 'Por Estado',
    getKey: l => l.estado,
    order: ['Disponible', 'Adjudicado', 'Entregado', 'No Disponible', 'Sin datos'],
    colors: { 'Disponible': '#16a34a', 'Adjudicado': '#FB7520', 'Entregado': '#7dd3fc', 'No Disponible': '#e85555', 'Sin datos': '#474d5f' },
  },
  tipo: {
    tab: 'Por Tipo Producto',
    getKey: l => l.tipo_inmueble || '—',
    order: ['Casa', 'Casa Futura', 'Lote', 'Macrolote', '—'],
    colors: { 'Casa': '#4f8ef7', 'Casa Futura': '#a78bfa', 'Lote': '#34d399', 'Macrolote': '#fbbf24', '—': '#474d5f' },
  },
  estilo: {
    tab: 'Por Estilo Casa',
    getKey: l => l.estilo || '—',
    order: ['Europea', 'Mediterránea', 'Mediterranea', 'Americana', 'Futura', 'Futura Plus', '—'],
    colors: { 'Europea': '#4f8ef7', 'Mediterránea': '#f97316', 'Mediterranea': '#f97316', 'Americana': '#a3e635', 'Futura': '#a78bfa', 'Futura Plus': '#c084fc', '—': '#474d5f' },
  },
}

const W = 960, H = 800, PAD = 28, FALLBACK = '#474d5f'

const isEmpty = v => v === null || v === undefined || v === '' || v === 'nan' || v === 'None'
const fv = v => isEmpty(v) ? '—' : v
const fm2 = v => { if (isEmpty(v)) return '—'; const n = parseFloat(v); return isNaN(n) ? '—' : n.toFixed(2) + ' m²' }
const fusd = v => { if (isEmpty(v)) return '—'; const n = parseFloat(v); return isNaN(n) ? '—' : 'USD ' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 }) }
const fdate = v => isEmpty(v) ? '—' : String(v).substring(0, 10)
const fkpi = n => 'USD ' + (n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })

export default function Emprendimiento() {
  const { codigo } = useParams()
  const [emp, setEmp] = useState(null)
  const [lots, setLots] = useState([])
  const [mzns, setMzns] = useState([])
  const [greens, setGreens] = useState([])
  const [infra, setInfra] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [colorMode, setColorMode] = useState('estado')
  const [legendFilters, setLegendFilters] = useState(() => new Set())
  const [selId, setSelId] = useState(null)
  const [fTipo, setFTipo] = useState([])
  const [fNegocio, setFNegocio] = useState('')
  const [fEtapa, setFEtapa] = useState('')
  const [fAvance, setFAvance] = useState('')
  const [fManzana, setFManzana] = useState('')
  const [satView, setSatView] = useState(false)
  const [georef, setGeoref] = useState(null)
  const [rawLots, setRawLots] = useState([])

  const wrapRef = useRef(null)
  const svgRef = useRef(null)
  const view = useRef({ x: 0, y: 0, z: 1 })
  const drag = useRef(null)
  const movedRef = useRef(false)

  /* ───────── Carga desde Supabase ───────── */
  useEffect(() => {
    setLoading(true); setNotFound(false); setSelId(null)
    const data = getEmprendimiento(codigo)
    if (!data) { setNotFound(true); setLoading(false); return }
    setEmp(data.emp)
    const all = (data.lots || []).filter(l => Array.isArray(l.pts) && l.pts.length >= 3)
    const merged = all.filter(l => l.tipo === 'lote').map((l, i) => ({
      id: `${l.manzana}-${l.numero}-${i}`,
      manzana: l.manzana,
      lote: l.numero,
      pts: l.pts,
      cx: l.cx, cy: l.cy,
      m2_terreno: l.terreno,
      nombre: `Mza ${l.manzana} · Lote ${l.numero}`,
      estadoRaw: l.estado || null,
      estado: normEstado(l.estado),
      negocio_comercial: l.negocio_comercial || null,
      tipo_inmueble: l.tipo_inmueble || null,
      estilo: l.estilo || null,
      m2_construido: l.m2_construido,
      avance_obra: l.avance_obra || null,
      fecha_entrega: l.fecha_entrega || null,
      costo: l.costo,
      etapa: l.etapa || null,
      dormitorios: l.dormitorios,
      observaciones: null,
    }))
    setLots(merged)
    setRawLots(all)
    setGreens(all.filter(l => l.tipo === 'verde'))
    setMzns((data.manzanas || []).filter(mz => Array.isArray(mz.pts) && mz.pts.length >= 3))
    setGeoref(data.georef || null)
    const m = MANIFEST.find(e => e.codigo === codigo)
    setInfra((m && m.infra) || {})
    setLoading(false)
  }, [codigo])

  /* ───────── BBox + transformaciones CAD → SVG ───────── */
  const bbox = useMemo(() => {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
    const scan = pts => pts.forEach(p => {
      if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0]
      if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1]
    })
    lots.forEach(l => scan(l.pts)); mzns.forEach(m => scan(m.pts)); greens.forEach(g => scan(g.pts))
    return isFinite(minx) ? { minx, miny, maxx, maxy } : null
  }, [lots, mzns, greens])

  const tf = useMemo(() => {
    if (!bbox) return null
    const s = Math.min((W - PAD * 2) / (bbox.maxx - bbox.minx || 1), (H - PAD * 2) / (bbox.maxy - bbox.miny || 1))
    const tx = x => PAD + (x - bbox.minx) * s
    const ty = y => H - PAD - (y - bbox.miny) * s
    const p2s = pts => pts.map(p => `${tx(p[0])},${ty(p[1])}`).join(' ')
    const cen = pts => { const n = pts.length; return [pts.reduce((a, p) => a + p[0], 0) / n, pts.reduce((a, p) => a + p[1], 0) / n] }
    return { tx, ty, p2s, cen }
  }, [bbox])

  /* ───────── Opciones de filtros (derivadas de la data) ───────── */
  const opts = useMemo(() => {
    const uniq = arr => [...new Set(arr.filter(v => !isEmpty(v)))].sort((a, b) => String(a).localeCompare(String(b), 'es', { numeric: true }))
    return {
      tipo: uniq(lots.map(l => l.tipo_inmueble)),
      negocio: uniq(lots.map(l => l.negocio_comercial)),
      etapa: uniq(lots.map(l => l.etapa)),
      avance: uniq(lots.map(l => l.avance_obra)),
      manzana: uniq(lots.map(l => l.manzana)),
    }
  }, [lots])

  const scheme = SCHEMES[colorMode]
  const colorOf = useCallback(l => scheme.colors[scheme.getKey(l)] || FALLBACK, [scheme])

  const matches = useCallback(l => {
    if (legendFilters.size > 0 && !legendFilters.has(scheme.getKey(l))) return false
    if (fTipo.length && !fTipo.includes(l.tipo_inmueble)) return false
    if (fNegocio && l.negocio_comercial !== fNegocio) return false
    if (fEtapa && l.etapa !== fEtapa) return false
    if (fAvance && l.avance_obra !== fAvance) return false
    if (fManzana && l.manzana !== fManzana) return false
    return true
  }, [legendFilters, scheme, fTipo, fNegocio, fEtapa, fAvance, fManzana])

  /* ───────── KPIs (sobre lotes visibles) ───────── */
  const kpis = useMemo(() => {
    let total = 0, totalUSD = 0, disp = 0, dispUSD = 0, adj = 0, adjUSD = 0, ent = 0, entUSD = 0
    lots.forEach(l => {
      if (!matches(l)) return
      const c = parseFloat(l.costo) || 0
      total++; totalUSD += c
      if (l.estado === 'Disponible') { disp++; dispUSD += c }
      else if (l.estado === 'Adjudicado') { adj++; adjUSD += c }
      else if (l.estado === 'Entregado') { ent++; entUSD += c }
    })
    return { total, totalUSD, disp, dispUSD, adj, adjUSD, ent, entUSD }
  }, [lots, matches])

  /* ───────── Leyenda (totales por clave, no filtrado) ───────── */
  const legend = useMemo(() => scheme.order
    .map(key => ({ key, color: scheme.colors[key], count: lots.filter(l => scheme.getKey(l) === key).length }))
    .filter(x => x.count > 0), [lots, scheme])

  const sel = lots.find(l => l.id === selId) || null

  /* ───────── Pan / Zoom (imperativo para que sea fluido) ───────── */
  const applyTf = useCallback(() => {
    if (!svgRef.current) return
    const { x, y, z } = view.current
    svgRef.current.style.transform = `translate(${x}px,${y}px) scale(${z})`
  }, [])

  const fit = useCallback(() => {
    if (!wrapRef.current) return
    const r = wrapRef.current.getBoundingClientRect()
    if (!r.width) return
    const z = Math.min(r.width / W, r.height / H) * 0.94
    view.current = { x: (r.width - W * z) / 2, y: (r.height - H * z) / 2, z }
    applyTf()
  }, [applyTf])

  useEffect(() => {
    if (loading || !bbox) return
    fit()
    const w = wrapRef.current
    if (!w) return
    const ro = new ResizeObserver(() => fit())
    ro.observe(w)
    const onWheel = ev => {
      ev.preventDefault()
      const r = w.getBoundingClientRect()
      const mx = ev.clientX - r.left, my = ev.clientY - r.top, v = view.current
      const nz = Math.min(Math.max(v.z * (ev.deltaY > 0 ? 0.85 : 1.18), 0.4), 16)
      v.x = mx - (mx - v.x) * (nz / v.z); v.y = my - (my - v.y) * (nz / v.z); v.z = nz
      applyTf()
    }
    w.addEventListener('wheel', onWheel, { passive: false })
    return () => { ro.disconnect(); w.removeEventListener('wheel', onWheel) }
  }, [loading, bbox, fit, applyTf])

  function onMouseDown(e) { if (e.button !== 0) return; drag.current = { x: e.clientX, y: e.clientY, moved: false } }
  function onMouseMove(e) {
    const d = drag.current
    if (!d) return
    if ((e.buttons & 1) === 0) { drag.current = null; return } // botón ya soltado (p.ej. afuera)
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true
    view.current.x += dx; view.current.y += dy
    d.x = e.clientX; d.y = e.clientY
    applyTf()
  }
  function onMouseUp() { movedRef.current = !!(drag.current && drag.current.moved); drag.current = null }
  function zoomCenter(f) {
    if (!wrapRef.current) return
    const r = wrapRef.current.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2, v = view.current
    const nz = Math.min(Math.max(v.z * f, 0.4), 16)
    v.x = cx - (cx - v.x) * (nz / v.z); v.y = cy - (cy - v.y) * (nz / v.z); v.z = nz; applyTf()
  }

  function toggleLegend(key, e) {
    setLegendFilters(prev => {
      const next = new Set(prev)
      if (e.ctrlKey || e.metaKey) { next.has(key) ? next.delete(key) : next.add(key) }
      else if (next.size === 1 && next.has(key)) next.clear()
      else { next.clear(); next.add(key) }
      return next
    })
  }
  function resetFilters() {
    setFTipo([]); setFNegocio(''); setFEtapa(''); setFAvance(''); setFManzana(''); setLegendFilters(new Set())
  }
  function onWrapClick() {
    if (!movedRef.current) setSelId(null)
  }
  async function logout() { await supabase.auth.signOut() }

  /* ───────── Estados de carga ───────── */
  if (loading) return (
    <div className="tablero tablero-msg"><div className="t-spinner" /><p>Cargando {codigo}…</p></div>
  )
  if (notFound) return (
    <div className="tablero tablero-msg">
      <p>No encontramos el emprendimiento <strong>{codigo}</strong>.</p>
      <Link to="/" className="t-msg-link">← Volver a emprendimientos</Link>
    </div>
  )

  const hasComercial = lots.some(l => l.estadoRaw)

  return (
    <div className="tablero">
      <header className="t-header">
        <Link to="/" className="t-back" title="Volver a emprendimientos">←</Link>
        <div className="t-logo">{emp.codigo}</div>
        <div className="t-titles">
          <div className="t-title-main">{emp.codigo} {emp.nombre} · Tablero de Stock y Obra</div>
          <div className="t-title-sub">{[emp.ubicacion, emp.ciudad, emp.provincia].filter(Boolean).join(', ')}</div>
        </div>
        <div className="t-header-links">
          {emp.link_sitio && (
            <a href={emp.link_sitio} target="_blank" rel="noopener noreferrer" className="t-header-link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/></svg>
              Sitio web
            </a>
          )}
          {emp.link_pipeline && (
            <a href={emp.link_pipeline} target="_blank" rel="noopener noreferrer" className="t-header-link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Pipeline
            </a>
          )}
        </div>
        <div className="t-spacer" />
        <button className="t-logout" onClick={logout}>Salir</button>
      </header>

      <div className="t-kpibar">
        <div className="t-kpi-spacer">
          {Object.keys(infra).length > 0 ? (
            <div className="t-infra">
              <div className="t-infra-ttl">Infraestructura</div>
              {INFRA_ITEMS.filter(it => infra[it.tipo] != null).map(it => (
                <div className="t-infra-item" key={it.tipo} title={`${it.name}: ${infra[it.tipo]}%`}>
                  <InfraIcon tipo={it.tipo} color={it.color} size={14} />
                  <div className="t-infra-meta">
                    <span className="t-infra-name">{it.short}</span>
                    <div className="t-infra-bar"><div className="t-infra-fill" style={{ width: `${infra[it.tipo]}%`, background: it.color }} /></div>
                  </div>
                  <span className="t-infra-pct">{infra[it.tipo]}%</span>
                </div>
              ))}
            </div>
          ) : !hasComercial ? (
            <span className="t-warn">Sin datos comerciales · actualizá el Excel en <code>data_src</code> y regenerá</span>
          ) : null}
        </div>
        <div className="t-kpi-group">
          <Kpi label="Total Stock" q={kpis.total} usd={kpis.totalUSD} sub="unidades visibles"   c="#28283D" />
          <Kpi label="Disponibles" q={kpis.disp}  usd={kpis.dispUSD}  sub="para la venta"        c="#16a34a" />
          <Kpi label="Adjudicados" q={kpis.adj}   usd={kpis.adjUSD}   sub="adj. + reservados"    c="#FB7520" />
          <Kpi label="Entregados"  q={kpis.ent}   usd={kpis.entUSD}   sub="entregados + escrit." c="#7dd3fc" />
        </div>
      </div>

      <div className="t-main">
        <aside className="t-sidebar">
          <div className="t-sb-scroll">
            <div className="t-seclbl">Vista de color</div>
            <div className="t-modetabs">
              {Object.entries(SCHEMES).map(([k, s]) => (
                <div key={k} className={'t-modetab' + (colorMode === k ? ' active' : '')}
                  onClick={() => { setColorMode(k); setLegendFilters(new Set()) }}>{s.tab}</div>
              ))}
            </div>

            <div className="t-seclbl">Leyenda <span>(Ctrl+clic = múltiple)</span></div>
            <div className="t-legend">
              {legend.map(it => (
                <div key={it.key} className={'t-leg' + (legendFilters.has(it.key) ? ' on' : '')}
                  onClick={e => toggleLegend(it.key, e)}>
                  <span className="t-leg-dot" style={{ background: it.color }} />
                  <span className="t-leg-label">{it.key}</span>
                  <span className="t-leg-count">{it.count}</span>
                </div>
              ))}
            </div>

            {opts.tipo.length > 0 && (<>
              <div className="t-seclbl">Tipo de Inmueble <span>(Ctrl+clic)</span></div>
              <select multiple size="4" className="t-multi" value={fTipo}
                onChange={e => setFTipo(Array.from(e.target.selectedOptions, o => o.value))}>
                {opts.tipo.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </>)}

            <div className="t-seclbl">Filtros</div>
            <Drop label="Negocio Comercial" value={fNegocio} set={setFNegocio} options={opts.negocio} all="Todos" />
            <Drop label="Etapa"             value={fEtapa}   set={setFEtapa}   options={opts.etapa}   all="Todas" />
            <Drop label="Avance de Obra"    value={fAvance}  set={setFAvance}  options={opts.avance}  all="Todos" />
            <Drop label="Manzana"           value={fManzana} set={setFManzana} options={opts.manzana} all="Todas" />
            <button className="t-reset" onClick={resetFilters}>↺ Limpiar todo</button>
          </div>
        </aside>

        <div className="t-mapwrap" ref={wrapRef}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onClick={onWrapClick}>
          <svg ref={svgRef} className="t-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
            {tf && (<>
              <g>
                {greens.map((g, gi) => {
                  const cs = g.pts.map(p => [tf.tx(p[0]), tf.ty(p[1])])
                  const ccx = cs.reduce((a, p) => a + p[0], 0) / cs.length
                  const ccy = cs.reduce((a, p) => a + p[1], 0) / cs.length
                  const mids = cs.map((p, k) => { const q = cs[(k + 1) % cs.length]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] })
                  const trees = [...cs, ...mids].map(p => [ccx + (p[0] - ccx) * 0.6, ccy + (p[1] - ccy) * 0.6]).slice(0, 12)
                  return (
                    <g key={'v' + gi}>
                      <polygon className="t-verde" points={cs.map(p => p.join(',')).join(' ')} />
                      {trees.map((t, ti) => (
                        <g key={ti}>
                          <circle cx={t[0]} cy={t[1]} r="3.6" fill="#3f8f5b" opacity="0.85" />
                          <circle cx={t[0]} cy={t[1]} r="1.9" fill="#62b884" />
                        </g>
                      ))}
                    </g>
                  )
                })}
              </g>
              <g>
                {mzns.map((m, i) => {
                  const [cx, cy] = tf.cen(m.pts)
                  return (
                    <g key={'m' + i}>
                      <polygon className="t-mzn" points={tf.p2s(m.pts)} />
                      <text className="t-mznlbl" x={tf.tx(cx)} y={tf.ty(cy)}>MZA {m.label || ''}</text>
                    </g>
                  )
                })}
              </g>
              <g>
                {lots.map(l => {
                  const [cx, cy] = tf.cen(l.pts)
                  return (
                    <g key={l.id}>
                      <polygon
                        className={'t-lot' + (!matches(l) ? ' dimmed' : '') + (selId === l.id ? ' sel' : '')}
                        points={tf.p2s(l.pts)} fill={colorOf(l)} fillOpacity="0.82"
                        onClick={e => { e.stopPropagation(); if (!movedRef.current) setSelId(l.id) }} />
                      <text className="t-lotlbl" x={tf.tx(cx)} y={tf.ty(cy)}>{l.lote}</text>
                    </g>
                  )
                })}
              </g>
            </>)}
          </svg>
          {satView && georef && (
            <SatelliteView lots={rawLots} manzanas={mzns} georef={georef} onSelect={null} />
          )}
          {georef && (
            <button className="t-sat-toggle" onClick={() => setSatView(!satView)}>
              {satView ? '🗺️ Plano' : '🛰️ Satélite'}
            </button>
          )}
          <div className="t-zoom">
            <button className="t-zoombtn" onClick={() => zoomCenter(1.3)}>+</button>
            <button className="t-zoombtn" onClick={() => zoomCenter(0.77)}>−</button>
          </div>
          <button className="t-fit" onClick={fit}>⊡ Ajustar</button>
        </div>

        <aside className="t-detail">
          <div className="t-det-hdr">
            <div className="t-det-pre">Producto seleccionado</div>
            <div className="t-det-name">{sel ? sel.nombre : '—'}</div>
            {sel && (
              <div className="t-det-badge" style={{ background: colorOf(sel) + '28', color: colorOf(sel), border: `1px solid ${colorOf(sel)}45` }}>
                <span className="t-det-dot" style={{ background: colorOf(sel) }} />{sel.estado}
              </div>
            )}
          </div>
          <div className="t-det-body">
            {!sel ? (
              <div className="t-det-empty">Hacé clic en un lote<br />para ver sus detalles</div>
            ) : (<>
              <DetGrp title="Ubicación">
                <DetRow k="Manzana" v={fv(sel.manzana)} />
                <DetRow k="Lote" v={fv(sel.lote)} />
                <DetRow k="Etapa" v={fv((sel.etapa || '').replace('Nuevo Maipu - ', '')) || '—'} />
              </DetGrp>
              <DetGrp title="Producto">
                <DetRow k="Tipo" v={fv(sel.tipo_inmueble)} />
                <DetRow k="Estilo" v={fv(sel.estilo)} />
                <DetRow k="Dormitorios" v={fv(sel.dormitorios)} />
              </DetGrp>
              <DetGrp title="Superficies">
                <DetRow k="Terreno total" v={fm2(sel.m2_terreno)} />
                <DetRow k="Construido" v={fm2(sel.m2_construido)} />
              </DetGrp>
              <DetGrp title="Comercial">
                <DetRow k="Negocio" v={fv(sel.negocio_comercial)} />
                <DetRow k="Avance obra" v={fv(sel.avance_obra)} />
                <DetRow k="Entrega planif." v={fdate(sel.fecha_entrega)} />
              </DetGrp>
              {!isEmpty(sel.observaciones) && (
                <DetGrp title="Notas"><div className="t-det-note">{sel.observaciones}</div></DetGrp>
              )}
              <DetGrp title="Precio">
                <DetRow k="Costo" v={fusd(sel.costo)} mono />
              </DetGrp>
            </>)}
          </div>
        </aside>
      </div>
    </div>
  )
}

/* ───────── Subcomponentes ───────── */
function Kpi({ label, q, usd, sub, c }) {
  return (
    <div className="t-kpi">
      <div className="t-kpi-label">{label}</div>
      <div className="t-kpi-top">
        <div className="t-kpi-q" style={{ color: c }}>{q}</div>
        <div className="t-kpi-usd">{fkpi(usd)}</div>
      </div>
      <div className="t-kpi-sub">{sub}</div>
    </div>
  )
}
function Drop({ label, value, set, options, all }) {
  return (
    <div className="t-flt">
      <div className="t-flt-lbl">{label}</div>
      <select className="t-drop" value={value} onChange={e => set(e.target.value)}>
        <option value="">{all}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
function DetGrp({ title, children }) {
  return (<div className="t-det-grp"><div className="t-det-grp-ttl">{title}</div>{children}</div>)
}
function DetRow({ k, v, mono }) {
  return (<div className="t-det-row"><span className="t-det-k">{k}</span><span className={'t-det-v' + (mono ? ' mono' : '')}>{v}</span></div>)
}
