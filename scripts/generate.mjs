// generate.mjs — Genera los datos del tablero a partir de data_src/.
// Corre en Node (sin Python). Se ejecuta solo en cada build (ver package.json).
//   data_src/config.json + Excels + *_geo.json  →  src/data/<CODIGO>.json + manifest.json
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'data_src')
const OUT = path.join(ROOT, 'src', 'data')
fs.mkdirSync(OUT, { recursive: true })

const NUMERIC = /^[0-9]+[A-Za-z]?$/
const GREEN_HINT = /reservado|verde|plaza|parque|espacio/i
const NOMBRE_RE = /lote\s+([0-9]+[a-z]?)\s*-?\s*mza\s+([a-z0-9]+)/i
const ESTADO_MAP = {
  'reservado saat': 'Reservado', 'directorio - reservado': 'Reservado', 'directorio-reservado': 'Reservado',
  'disponible': 'Disponible', 'adjudicado': 'Adjudicado', 'entregado': 'Entregado',
  'escriturado': 'Escriturado', 'no disponible': 'No Disponible',
}
const canon = v => v ? (ESTADO_MAP[String(v).trim().toLowerCase()] || String(v).trim()) : 'Disponible'
const S = v => { if (v === null || v === undefined) return null; const s = String(v).trim(); return (s && s.toLowerCase() !== 'nan') ? s : null }
const NUM = v => { const s = S(v); if (s === null) return null; const n = parseFloat(s.replace(/,/g, '')); return isNaN(n) ? null : n }
const INT = v => { const n = NUM(v); return n === null ? null : Math.round(n) }
const fmtDate = v => {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) { const y = v.getFullYear(), m = String(v.getMonth() + 1).padStart(2, '0'), d = String(v.getDate()).padStart(2, '0'); return `${y}-${m}-${d}` }
  return String(v).slice(0, 10)
}
const centroid = pts => { const n = pts.length; return [pts.reduce((a, p) => a + p[0], 0) / n, pts.reduce((a, p) => a + p[1], 0) / n] }
const baseNum = s => { const m = /^([0-9]+)/.exec(s); return m ? m[1] : s }

// Extrae (manzana, lote) del campo "Nombre".
// Si la obra define manzana_rules (N65, N74), aplica esas reglas para que el nombre
// del Excel coincida con el del plano. Si no, usa el patrón "Lote N - Mza X" estándar.
function extractMznLote(nom, rules) {
  if (!nom) return [null, null]
  if (rules && rules.length) {
    for (const rule of rules) {
      const re = new RegExp('lote\\s+([0-9]+[a-z]?)\\s*-?\\s*' + rule.match + '\\s+([0-9a-z]+)', 'i')
      const m = re.exec(nom)
      if (m) {
        const lote = m[1].toUpperCase()
        const tok = m[2].toUpperCase()
        let mzn = rule.map ? (rule.map[tok] || rule.map[m[2]] || null) : ((rule.prefix || '') + tok)
        if (mzn) return [String(mzn).toUpperCase(), lote]
      }
    }
    return [null, null]
  }
  const m = NOMBRE_RE.exec(nom)
  return m ? [m[2].toUpperCase(), m[1].toUpperCase()] : [null, null]
}

const FIELDS = ['estado', 'negocio_comercial', 'tipo_inmueble', 'estilo', 'm2_construido',
  'avance_obra', 'fecha_entrega', 'costo', 'etapa', 'dormitorios', 'terreno']
const applyComercial = (lot, d) => { for (const f of FIELDS) lot[f] = d ? (d[f] ?? null) : null }

function readExcel(file, mergeAb, rules) {
  const wb = XLSX.readFile(file, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false })
  const hdr = (rows[0] || []).map(h => h === null ? '' : String(h).trim())
  const COLS = ['Nombre', 'Tipo Inmueble', 'Cantidad Dormitorio', 'Negocio Comercial', 'Razón para el estado',
    'Manzana', 'Numero Lote Actual', 'M2 Construido', 'Metros Cuadrados Totales Actual',
    'Avance de Obra', 'Fecha Entrega Planificada (técnica)', 'Estilo Producto', 'Etapa', 'Costo de Producto']
  const col = {}; COLS.forEach(n => { col[n] = hdr.indexOf(n) })
  const c = (row, n) => { const i = col[n]; return (i >= 0 && i < row.length) ? row[i] : null }

  const out = {}; const seen = new Set()
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || !row.some(x => x !== null && x !== '')) continue
    const nom = S(c(row, 'Nombre'))
    let [mzn, lote] = extractMznLote(nom, rules)
    if (!mzn && (!rules || !rules.length)) {
      mzn = c(row, 'Manzana') ? String(c(row, 'Manzana')).split(' - ')[0].trim().toUpperCase() : null
      lote = ((S(c(row, 'Numero Lote Actual')) || '').toUpperCase()) || null
    }
    if (!mzn || !lote) continue
    if (mergeAb) lote = baseNum(lote)
    const key = mzn + '|' + lote
    if (seen.has(key)) continue
    seen.add(key)
    out[key] = {
      estado: canon(S(c(row, 'Razón para el estado'))),
      negocio_comercial: S(c(row, 'Negocio Comercial')),
      tipo_inmueble: S(c(row, 'Tipo Inmueble')),
      estilo: S(c(row, 'Estilo Producto')),
      m2_construido: NUM(c(row, 'M2 Construido')),
      avance_obra: S(c(row, 'Avance de Obra')),
      fecha_entrega: fmtDate(c(row, 'Fecha Entrega Planificada (técnica)')),
      costo: NUM(c(row, 'Costo de Producto')),
      etapa: S(c(row, 'Etapa')),
      dormitorios: INT(c(row, 'Cantidad Dormitorio')),
      terreno: NUM(c(row, 'Metros Cuadrados Totales Actual')),
    }
  }
  return out
}

function build(emp, infraMap) {
  const cod = emp.codigo
  const geo = JSON.parse(fs.readFileSync(path.join(SRC, emp.geo), 'utf-8'))
  const geoLots = geo.lots || []
  const comercial = readExcel(path.join(SRC, emp.excel), !!emp.merge_ab, emp.manzana_rules)
  const greenMznRe = emp.green_manzana ? new RegExp(emp.green_manzana, 'i') : null

  const lots = []; let matched = 0
  const usedKeys = new Set(); const pending = []  // geo lotes sin match (para fallback)
  for (const l of geoLots) {
    const mzn = String(l.manzana).toUpperCase(), num = String(l.lote).toUpperCase()
    let [cx, cy] = [l.cx, l.cy]
    if (cx === undefined || cx === null || cy === undefined || cy === null) [cx, cy] = centroid(l.pts)
    if (greenMznRe && greenMznRe.test(mzn)) {
      lots.push({ manzana: mzn, numero: l.lote, tipo: 'verde', pts: l.pts, cx, cy })
    } else if (NUMERIC.test(num)) {
      const key = mzn + '|' + num
      const lot = { manzana: mzn, numero: l.lote, tipo: 'lote', pts: l.pts, cx, cy }
      const d = comercial[key]
      applyComercial(lot, d)
      if (d) { matched++; usedKeys.add(key) }
      else if (emp.lote_fallback) pending.push({ lot, mzn, num })
      lots.push(lot)
    } else if (GREEN_HINT.test(num) || num === '') {
      lots.push({ manzana: mzn, numero: l.lote, tipo: 'verde', pts: l.pts, cx, cy })
    }
  }

  // Fallback opcional (N74): cuando el plano rotula los sublotes distinto al Excel,
  // empareja por (manzana, número base) SOLO si queda 1 polígono y 1 fila sin usar.
  let byFallback = 0
  if (emp.lote_fallback && pending.length) {
    const remExcel = {}
    for (const key in comercial) {
      if (usedKeys.has(key)) continue
      const [mz, lt] = key.split('|'); const bk = mz + '|' + baseNum(lt)
      ;(remExcel[bk] = remExcel[bk] || []).push(key)
    }
    const remGeo = {}
    for (const p of pending) { const bk = p.mzn + '|' + baseNum(p.num); (remGeo[bk] = remGeo[bk] || []).push(p) }
    for (const bk in remGeo) {
      const gs = remGeo[bk], es = remExcel[bk]
      if (gs.length === 1 && es && es.length === 1) {
        applyComercial(gs[0].lot, comercial[es[0]]); usedKeys.add(es[0]); matched++; byFallback++
      }
    }
  }

  const manzanas = (geo.manzanas || []).map(m => { const [cx, cy] = centroid(m.pts); return { label: m.label || '', pts: m.pts, cx, cy } })
  const skipped = Object.keys(comercial).filter(k => !usedKeys.has(k)).length

  const keep = ['codigo', 'nombre', 'nombre_full', 'ubicacion', 'ciudad', 'provincia', 'estado_general', 'link_sitio', 'link_pipeline']
  const empMeta = {}; keep.forEach(k => { empMeta[k] = emp[k] })
  const data = { codigo: cod, emp: empMeta, manzanas, lots, georef: emp.georef || null }
  fs.writeFileSync(path.join(OUT, `${cod}.json`), JSON.stringify(data))

  const cnt = {}; lots.forEach(l => { if (l.tipo === 'lote' && l.estado) cnt[l.estado] = (cnt[l.estado] || 0) + 1 })
  const g = k => cnt[k] || 0
  const total = lots.filter(l => l.tipo === 'lote').length
  const com = g('Adjudicado') + g('Entregado') + g('Escriturado')
  const kpis = {
    total, disponibles: g('Disponible'), reservados: g('Reservado'), adjudicados: g('Adjudicado'),
    entregados: g('Entregado'), escriturados: g('Escriturado'), no_disponible: g('No Disponible'),
    pct_comercializado: total ? Math.round(com / total * 1000) / 10 : 0,
  }
  const fb = byFallback ? ` (+${byFallback} x descarte)` : ''
  console.log(`  ${cod}: ${total} lotes · ${matched} con datos${fb} · ${lots.length - total} verdes · Excel sin polígono ${skipped}`)
  return { ...empMeta, infra: infraMap[(emp.pipeline || '').trim()] || {}, kpis }
}

function readInfra(file) {
  if (!file) return {}
  let wb
  try { wb = XLSX.readFile(path.join(SRC, file)) } catch { return {} }
  let rows = null
  for (const name of wb.SheetNames) {
    const r = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, blankrows: false })
    if (r.some(row => row.some(c => String(c).trim().toLowerCase() === 'id pipeline'))) { rows = r; break }
  }
  if (!rows) return {}
  const hi = rows.findIndex(row => row.some(c => String(c).trim().toLowerCase() === 'id pipeline'))
  const hdr = rows[hi].map(c => (c === null ? '' : String(c).trim().toLowerCase()))
  const idCol = hdr.indexOf('id pipeline')
  const find = sub => hdr.findIndex(h => h.includes(sub))
  const SERV = [
    ['gas', 'tiene gas', 'avance obra gas'],
    ['agua', 'tiene agua', 'avance obra agua'],
    ['cloacas', 'tiene cloacas', 'avance obra cloacas'],
    ['electricidad', 'tiene electricidad', 'avance obra electricidad'],
    ['espacios_verdes', 'tiene espacios verdes', 'avance obra espacios verdes'],
    ['red_vial', 'tiene red vial', 'avance obra red vial'],
  ].map(([key, t, p]) => ({ key, tCol: find(t), pCol: find(p) }))
  const map = {}
  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r]
    const id = row[idCol] != null ? String(row[idCol]).trim() : ''
    if (!id) continue
    const infra = {}
    for (const s of SERV) {
      const tiene = s.tCol >= 0 ? String(row[s.tCol] ?? '').trim().toLowerCase() : ''
      if (tiene === 'si' || tiene === 'sí') {
        const raw = s.pCol >= 0 ? row[s.pCol] : null
        const n = (raw === null || raw === '' || isNaN(parseFloat(raw))) ? 0 : parseFloat(raw)
        infra[s.key] = n > 1.0001 ? Math.round(n) : Math.round(n * 100)
      }
    }
    map[id] = infra
  }
  return map
}

const cfg = JSON.parse(fs.readFileSync(path.join(SRC, 'config.json'), 'utf-8'))
const infraMap = readInfra(cfg.infra_source)
const manifest = cfg.emprendimientos.map(emp => build(emp, infraMap))
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`\nOK · ${manifest.length} emprendimientos → src/data/`)
