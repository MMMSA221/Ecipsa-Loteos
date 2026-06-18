import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import ArgentinaMap from '../components/ArgentinaMap'
import MANIFEST from '../data/manifest.json'

const INFRA_ITEMS = [
  { tipo: 'gas',             name: 'Gas',                        short: 'Gas',    color: '#ef4444' },
  { tipo: 'agua',            name: 'Agua',                       short: 'Agua',   color: '#2563eb' },
  { tipo: 'cloacas',         name: 'Cloacas',                    short: 'Cloacas',color: '#7c3aed' },
  { tipo: 'electricidad',    name: 'Electricidad e Iluminación', short: 'Elec.',  color: '#f59e0b' },
  { tipo: 'espacios_verdes', name: 'Espacios Verdes',            short: 'Esp.V.', color: '#16a34a' },
  { tipo: 'red_vial',        name: 'Red Vial',                   short: 'Vial',   color: '#64748b' },
]
const ESTADO_BADGE = {
  'En ejecución': 'badge-green', 'Finalizado': 'badge-navy', 'Preventa': 'badge-orange',
}


/* ══════ Dashboard ══════ */
export default function Dashboard() {
  const [activeProv, setActiveProv] = useState(null)
  const emps = activeProv ? MANIFEST.filter(e => e.provincia === activeProv) : MANIFEST
  const totalLotes = emps.reduce((s, e) => s + (e.kpis?.total || 0), 0)
  const totalDisp  = emps.reduce((s, e) => s + (e.kpis?.disponibles || 0), 0)

  const grupos = emps.reduce((acc, e) => {
    const p = e.provincia || 'Sin plaza'
    if (!acc[p]) acc[p] = []
    acc[p].push(e)
    return acc
  }, {})

  function infraVals(emp) {
    const m = emp.infra || {}
    return INFRA_ITEMS.map(i => ({ ...i, pct: m[i.tipo] }))
  }
  function infraAvg(emp) {
    const vals = infraVals(emp).map(i => i.pct).filter(v => v != null)
    if (!vals.length) return null
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }

  return (
    <>
      <Navbar />
      <div className="page dash-layout">
        <aside className="dash-sidebar">
          <ArgentinaMap activeProv={activeProv} setActiveProv={setActiveProv} />
        </aside>

        <div className="dash-main">
          <div className="page-header">
            <div>
              <h1 className="page-title">Emprendimientos</h1>
              <p className="page-sub">
                {emps.length} desarrollos · {totalLotes} lotes · {totalDisp} disponibles
                {activeProv && <span className="dash-filter-tag"> · Filtro: {activeProv}</span>}
              </p>
            </div>
          </div>

          {Object.entries(grupos).map(([plaza, lista]) => (
            <div key={plaza} className="plaza-group">
              <div className="plaza-header">
                <h2 className="plaza-title">{plaza}</h2>
                <span className="plaza-count">{lista.length} {lista.length === 1 ? 'desarrollo' : 'desarrollos'}</span>
              </div>
              <div className="emp-grid">
                {lista.map(emp => {
                  const k = emp.kpis || {}
                  const pctCom = k.pct_comercializado || 0
                  const pctInfra = infraAvg(emp)
                  return (
                    <Link key={emp.codigo} className="emp-card" to={`/emprendimiento/${emp.codigo}`}>
                      <div className="emp-card-header" />
                      <div className="emp-card-body">
                        <div className="emp-card-code">{emp.codigo}</div>
                        <div className="emp-card-name">{emp.nombre_full || emp.nombre}</div>
                        <div className="emp-card-loc">📍 {emp.ubicacion}, {emp.ciudad}</div>

                        <div className="emp-kpis">
                          <div className="emp-kpi">
                            <div className="emp-kpi-val" style={{ color: '#16a34a' }}>{k.disponibles ?? '—'}</div>
                            <div className="emp-kpi-lbl">Disponibles</div>
                          </div>
                          <div className="emp-kpi">
                            <div className="emp-kpi-val" style={{ color: 'var(--orange)' }}>{(k.reservados ?? 0) + (k.adjudicados ?? 0)}</div>
                            <div className="emp-kpi-lbl">Adjudicados</div>
                          </div>
                          <div className="emp-kpi">
                            <div className="emp-kpi-val" style={{ color: 'var(--navy-mid)' }}>{k.total ?? '—'}</div>
                            <div className="emp-kpi-lbl">Total</div>
                          </div>
                        </div>

                        <div className="emp-progress">
                          <div className="emp-progress-label">
                            <span>Comercialización</span><strong>{pctCom}%</strong>
                          </div>
                          <div className="emp-progress-bar">
                            <div className="emp-progress-fill" style={{ width: `${pctCom}%` }} />
                          </div>
                        </div>

                        {pctInfra != null && (
                          <div className="emp-infra-section">
                            <div className="emp-progress-label" style={{ marginBottom: 6 }}>
                              <span>Infraestructura</span>
                              <strong style={{ color: pctInfra === 100 ? '#16a34a' : pctInfra > 50 ? '#f59e0b' : '#64748b' }}>{pctInfra}%</strong>
                            </div>
                            <div className="infra-mini-grid">
                              {infraVals(emp).filter(i => i.pct > 0).map(item => (
                                <div key={item.tipo} className="infra-mini-item" title={`${item.name}: ${item.pct ?? 0}%`}>
                                  <div className="infra-mini-icon" style={{ color: item.color }}>{item.short}</div>
                                  <div className="infra-mini-bar">
                                    <div className="infra-mini-fill" style={{ width: `${item.pct ?? 0}%`, background: item.color }} />
                                  </div>
                                  <div className="infra-mini-pct">{item.pct ?? 0}%</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div style={{ marginTop: 10 }}>
                          <span className={`badge ${ESTADO_BADGE[emp.estado_general] || 'badge-navy'}`}>
                            {emp.estado_general}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}

          {emps.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
              No hay emprendimientos en <strong>{activeProv}</strong>.
              <br/><button className="arg-clear" style={{marginTop:12}} onClick={() => setActiveProv(null)}>Mostrar todos</button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
