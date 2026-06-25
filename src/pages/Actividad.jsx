import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { supabase } from '../supabase'

const EVENTO_LABEL = {
  login: 'Inicio de sesión',
  logout: 'Cierre de sesión',
  abrir_emprendimiento: 'Abrió emprendimiento',
  ver_lote: 'Consultó lote',
}
const EVENTO_COLOR = {
  login: '#16a34a',
  logout: '#64748b',
  abrir_emprendimiento: '#FB7520',
  ver_lote: '#2563eb',
}

export default function Actividad() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rango, setRango] = useState('7d')
  const [filtroUser, setFiltroUser] = useState('')
  const [filtroEvento, setFiltroEvento] = useState('')
  const [filtroEmp, setFiltroEmp] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      const desde = new Date()
      if (rango === '24h') desde.setHours(desde.getHours() - 24)
      else if (rango === '7d')  desde.setDate(desde.getDate() - 7)
      else if (rango === '30d') desde.setDate(desde.getDate() - 30)
      else desde.setFullYear(desde.getFullYear() - 5)

      const { data, error: err } = await supabase
        .from('actividad')
        .select('*')
        .gte('created_at', desde.toISOString())
        .order('created_at', { ascending: false })
        .limit(2000)

      if (cancelled) return
      if (err) setError(err.message)
      else setRows(data || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [rango])

  /* ───── Filtrado en memoria ───── */
  const filtered = useMemo(() => rows.filter(r => {
    if (filtroUser && !(r.user_email || '').toLowerCase().includes(filtroUser.toLowerCase())) return false
    if (filtroEvento && r.evento !== filtroEvento) return false
    if (filtroEmp && r.emprendimiento !== filtroEmp) return false
    return true
  }), [rows, filtroUser, filtroEvento, filtroEmp])

  /* ───── KPIs ───── */
  const kpis = useMemo(() => {
    const usuariosUnicos = new Set(filtered.map(r => r.user_email)).size
    const logins = filtered.filter(r => r.evento === 'login').length
    const aperturas = filtered.filter(r => r.evento === 'abrir_emprendimiento').length
    const lotesVistos = filtered.filter(r => r.evento === 'ver_lote').length
    return { total: filtered.length, usuariosUnicos, logins, aperturas, lotesVistos }
  }, [filtered])

  /* ───── Ranking emprendimientos ───── */
  const rankEmp = useMemo(() => {
    const m = {}
    filtered.filter(r => r.emprendimiento).forEach(r => {
      m[r.emprendimiento] = (m[r.emprendimiento] || 0) + 1
    })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [filtered])

  /* ───── Ranking lotes ───── */
  const rankLotes = useMemo(() => {
    const m = {}
    filtered.filter(r => r.evento === 'ver_lote' && r.manzana && r.lote).forEach(r => {
      const k = `${r.emprendimiento} · Mza ${r.manzana} · Lote ${r.lote}`
      m[k] = (m[k] || 0) + 1
    })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [filtered])

  /* ───── Ranking usuarios ───── */
  const rankUsers = useMemo(() => {
    const m = {}
    filtered.forEach(r => {
      m[r.user_email] = (m[r.user_email] || 0) + 1
    })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 15)
  }, [filtered])

  const empOptions = useMemo(
    () => [...new Set(rows.map(r => r.emprendimiento).filter(Boolean))].sort(),
    [rows]
  )

  function fmtDate(iso) {
    const d = new Date(iso)
    return d.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <>
      <Navbar />
      <div className="page" style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Métricas de uso</h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
              Actividad de usuarios en el sistema
            </p>
          </div>
          <Link to="/" style={{
            background:'#0e1525', color:'#fff', padding:'8px 16px',
            borderRadius:6, textDecoration:'none', fontSize:13, fontWeight:600
          }}>← Volver al portal</Link>
        </div>

        {/* ── Filtros ──────────────────────── */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom: 20,
          padding:16, background:'#fff', borderRadius:8, border:'1px solid #e4e7ef'
        }}>
          <div>
            <label style={{ fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase' }}>Rango</label>
            <select value={rango} onChange={e=>setRango(e.target.value)} style={inputStyle}>
              <option value="24h">Últimas 24 horas</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="all">Todo</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase' }}>Usuario</label>
            <input type="text" value={filtroUser} onChange={e=>setFiltroUser(e.target.value)}
              placeholder="email..." style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase' }}>Evento</label>
            <select value={filtroEvento} onChange={e=>setFiltroEvento(e.target.value)} style={inputStyle}>
              <option value="">Todos</option>
              {Object.entries(EVENTO_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase' }}>Emprendimiento</label>
            <select value={filtroEmp} onChange={e=>setFiltroEmp(e.target.value)} style={inputStyle}>
              <option value="">Todos</option>
              {empOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {error && <div style={{ background:'#fee2e2', color:'#991b1b', padding:12, borderRadius:6, marginBottom:16 }}>
          {error}
        </div>}

        {/* ── KPIs ──────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom: 20 }}>
          <Kpi label="Total eventos" value={kpis.total} color="#0e1525" />
          <Kpi label="Usuarios únicos" value={kpis.usuariosUnicos} color="#FB7520" />
          <Kpi label="Logins" value={kpis.logins} color="#16a34a" />
          <Kpi label="Aperturas" value={kpis.aperturas} color="#2563eb" />
          <Kpi label="Lotes vistos" value={kpis.lotesVistos} color="#7c3aed" />
        </div>

        {/* ── Rankings + Tabla ──────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom: 20 }}>
          <Ranking title="Emprendimientos más vistos" data={rankEmp} />
          <Ranking title="Usuarios más activos" data={rankUsers} />
          <Ranking title="Top 10 lotes consultados" data={rankLotes} />
        </div>

        {/* ── Tabla detalle ──────────────────────── */}
        <div style={{ background:'#fff', borderRadius:8, border:'1px solid #e4e7ef', overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #e4e7ef', display:'flex', justifyContent:'space-between' }}>
            <strong style={{ fontSize:13 }}>Detalle de eventos</strong>
            <span style={{ fontSize:12, color:'#64748b' }}>{filtered.length} registros</span>
          </div>
          <div style={{ maxHeight: 480, overflowY:'auto' }}>
            <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
              <thead style={{ position:'sticky', top:0, background:'#f5f7fb' }}>
                <tr>
                  <th style={th}>Fecha</th>
                  <th style={th}>Usuario</th>
                  <th style={th}>Evento</th>
                  <th style={th}>Emp.</th>
                  <th style={th}>Manzana</th>
                  <th style={th}>Lote</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:20, color:'#94a3b8' }}>Cargando...</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:20, color:'#94a3b8' }}>Sin datos para este filtro</td></tr>
                )}
                {!loading && filtered.map(r => (
                  <tr key={r.id} style={{ borderTop:'1px solid #f1f5f9' }}>
                    <td style={td}>{fmtDate(r.created_at)}</td>
                    <td style={td}>{r.user_email}</td>
                    <td style={td}>
                      <span style={{
                        background: (EVENTO_COLOR[r.evento]||'#64748b') + '20',
                        color: EVENTO_COLOR[r.evento]||'#64748b',
                        padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600
                      }}>{EVENTO_LABEL[r.evento] || r.evento}</span>
                    </td>
                    <td style={td}>{r.emprendimiento || '—'}</td>
                    <td style={td}>{r.manzana || '—'}</td>
                    <td style={td}>{r.lote || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

/* ───── Subcomponentes ───── */
function Kpi({ label, value, color }) {
  return (
    <div style={{ background:'#fff', padding:16, borderRadius:8, border:'1px solid #e4e7ef' }}>
      <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', fontWeight:600, letterSpacing:'.05em' }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:700, color, marginTop:4 }}>{value.toLocaleString('es-AR')}</div>
    </div>
  )
}

function Ranking({ title, data }) {
  const max = data[0]?.[1] || 1
  return (
    <div style={{ background:'#fff', padding:16, borderRadius:8, border:'1px solid #e4e7ef' }}>
      <h3 style={{ fontSize:13, fontWeight:600, margin:'0 0 12px', color:'#0e1525' }}>{title}</h3>
      {data.length === 0 && <p style={{ fontSize:12, color:'#94a3b8' }}>Sin datos</p>}
      {data.slice(0,8).map(([k, v]) => (
        <div key={k} style={{ marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'80%' }}>{k}</span>
            <strong>{v}</strong>
          </div>
          <div style={{ height:5, background:'#f1f5f9', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${(v/max)*100}%`, background:'#FB7520', borderRadius:3 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const inputStyle = {
  width:'100%', marginTop:4, padding:'7px 10px', border:'1px solid #d1d5e0',
  borderRadius:5, fontSize:13, fontFamily:'inherit', outline:'none', background:'#fff'
}
const th = { textAlign:'left', padding:'10px 12px', fontSize:11, fontWeight:600,
  color:'#64748b', textTransform:'uppercase', letterSpacing:'.05em' }
const td = { padding:'8px 12px', color:'#1e2535' }
