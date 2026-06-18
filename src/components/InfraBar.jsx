import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const ITEMS = [
  { tipo:'agua',        name:'Agua',          icon:'💧', color:'#2563eb' },
  { tipo:'cloacas',     name:'Cloacas',       icon:'🔩', color:'#7c3aed' },
  { tipo:'electricidad',name:'Electricidad',  icon:'⚡', color:'#f59e0b' },
  { tipo:'gas',         name:'Gas',           icon:'🔥', color:'#ef4444' },
  { tipo:'cordon_cuneta',name:'Cordón cuneta',icon:'🏗️', color:'#64748b' },
  { tipo:'alumbrado',   name:'Alumbrado',     icon:'💡', color:'#eab308' },
  { tipo:'forestacion', name:'Forestación',   icon:'🌳', color:'#16a34a' },
  { tipo:'veredas',     name:'Veredas',       icon:'🚶', color:'#0891b2' },
]

export default function InfraBar({ empId }) {
  const [data, setData] = useState({})
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    if (!empId) return
    supabase.from('infraestructura').select('*').eq('emprendimiento_id', empId)
      .then(({ data: rows }) => {
        const m = {}
        ;(rows || []).forEach(r => { m[r.tipo] = r })
        setData(m)
      })
  }, [empId])

  async function setPct(tipo, pct) {
    const row = { emprendimiento_id: empId, tipo, porcentaje: pct, updated_at: new Date().toISOString() }
    const existing = data[tipo]
    let result
    if (existing?.id) {
      const { data: upd } = await supabase.from('infraestructura').update(row).eq('id', existing.id).select().single()
      result = upd
    } else {
      const { data: ins } = await supabase.from('infraestructura').insert(row).select().single()
      result = ins
    }
    if (result) setData(prev => ({ ...prev, [tipo]: result }))
    setEditing(null)
  }

  if (!empId) return null

  return (
    <div className="infra-bar">
      <div className="infra-title">Infraestructura</div>
      <div className="infra-items">
        {ITEMS.map(item => {
          const pct = data[item.tipo]?.porcentaje ?? 0
          const isEd = editing === item.tipo
          return (
            <div key={item.tipo} className="infra-item" onClick={() => setEditing(isEd ? null : item.tipo)}>
              <div className="infra-icon">{item.icon}</div>
              <div className="infra-info">
                <div className="infra-name">{item.name}</div>
                {isEd ? (
                  <input className="infra-input" type="number" min="0" max="100" defaultValue={pct}
                    autoFocus onClick={e=>e.stopPropagation()}
                    onBlur={e=>setPct(item.tipo,Math.min(100,Math.max(0,parseInt(e.target.value)||0)))}
                    onKeyDown={e=>{ if(e.key==='Enter')e.target.blur() }}
                  />
                ) : (
                  <div className="infra-track" title="Clic para editar">
                    <div className="infra-fill" style={{width:`${pct}%`,background:item.color}}/>
                  </div>
                )}
              </div>
              <div className="infra-pct" style={{color: pct===100 ? '#16a34a' : 'var(--text2)'}}>
                {pct}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
