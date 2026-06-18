#!/usr/bin/env python3
"""
import_dxf.py — Parse DXF file → insert into Supabase

Usage:
    pip install supabase python-dotenv --break-system-packages
    python scripts/import_dxf.py N62_Carrodilla_geo.json  --codigo N62 --nombre "Carrodilla" --ciudad "Mendoza"

Or with raw DXF:
    python scripts/import_dxf.py path/to/file.dxf --codigo N62 --nombre "Carrodilla" --ciudad "Mendoza"

Env vars (or .env file):
    SUPABASE_URL=https://xxx.supabase.co
    SUPABASE_SERVICE_KEY=eyJ...  (service key, not anon)
"""
import os, sys, json, math, argparse
from pathlib import Path

# ── CLI ────────────────────────────────────────────────────────
ap = argparse.ArgumentParser()
ap.add_argument('file',   help='GeoJSON (N62_*_geo.json) or DXF file')
ap.add_argument('--codigo',  required=True)
ap.add_argument('--nombre',  required=True)
ap.add_argument('--ciudad',  default='Mendoza')
ap.add_argument('--estado',  default='En ejecución')
ap.add_argument('--ubicacion', default='')
ap.add_argument('--dry-run',   action='store_true')
args = ap.parse_args()

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

if not args.dry_run and (not SUPABASE_URL or not SUPABASE_KEY):
    print('❌  Set SUPABASE_URL and SUPABASE_SERVICE_KEY (or use --dry-run)')
    sys.exit(1)

if not args.dry_run:
    try:
        from supabase import create_client
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    except ImportError:
        print('❌  pip install supabase --break-system-packages')
        sys.exit(1)

# ── Load geometry ──────────────────────────────────────────────
fp = Path(args.file)
if fp.suffix == '.json':
    geo = json.loads(fp.read_text('utf-8'))
elif fp.suffix == '.dxf':
    print('Parsing DXF…')
    # minimal DXF parser — reproduce the logic from the project
    text = fp.read_text('utf-8', errors='ignore').splitlines()
    pairs = [(text[i].strip(), text[i+1].strip()) for i in range(0, len(text)-1, 2)]

    def in_section(pairs, section_name):
        out, inside = [], False
        for code, val in pairs:
            if code == '2' and val == section_name: inside = True
            if code == '0' and val == 'ENDSEC':     inside = False
            if inside: out.append((code, val))
        return out

    ents = in_section(pairs, 'ENTITIES')
    entities = []
    cur = None
    for code, val in ents:
        if code == '0':
            if cur: entities.append(cur)
            cur = {'type': val, 'pts': [], 'flags': 0}
        elif code == '8':  cur['layer'] = val
        elif code == '1':  cur['text']  = val
        elif code == '10': cur.setdefault('x', float(val))
        elif code == '20': cur.setdefault('y', float(val))
        elif code == '70': cur['flags'] = int(val) if val.lstrip('-').isdigit() else 0
        elif code == '42': pass
        elif cur and cur['type'] == 'LWPOLYLINE' and code == '10':
            pass  # handled below
    if cur: entities.append(cur)

    # Re-parse polyline pts properly
    def parse_entities(pairs):
        out, cur = [], None
        pts_x, pts_y = [], []
        for code, val in pairs:
            if code == '0':
                if cur:
                    cur['pts'] = list(zip(pts_x, pts_y))
                    out.append(cur)
                cur = {'type': val, 'layer': '', 'pts': [], 'flags': 0}
                pts_x, pts_y = [], []
            elif code == '8':  cur['layer'] = val
            elif code == '1':  cur['text']  = val
            elif code == '10':
                if cur and cur['type'] == 'LWPOLYLINE': pts_x.append(float(val))
                else: cur['cx'] = float(val)
            elif code == '20':
                if cur and cur['type'] == 'LWPOLYLINE': pts_y.append(float(val))
                else: cur['cy'] = float(val)
            elif code == '70': cur['flags'] = int(val) if val.lstrip('-').isdigit() else 0
        if cur:
            cur['pts'] = list(zip(pts_x, pts_y))
            out.append(cur)
        return out

    entities = parse_entities(ents)
    layer_up = lambda e, l: e.get('layer','').upper().startswith(l.upper())

    polys  = [e for e in entities if e['type'] == 'LWPOLYLINE' and int(e.get('flags',0)) & 1]
    texts  = [e for e in entities if e['type'] in ('TEXT','MTEXT')]

    def pip(px, py, pts):
        n, inside, j = len(pts), False, len(pts)-1
        for i in range(n):
            xi, yi = pts[i]; xj, yj = pts[j]
            if (yi > py) != (yj > py) and px < (xj-xi)*(py-yi)/(yj-yi)+xi:
                inside = not inside
            j = i
        return inside

    def centroid(pts):
        return sum(p[0] for p in pts)/len(pts), sum(p[1] for p in pts)/len(pts)

    def poly_area(pts):
        n = len(pts); a = 0
        for i in range(n):
            j = (i+1) % n
            a += pts[i][0]*pts[j][1] - pts[j][0]*pts[i][1]
        return abs(a)/2

    lot_polys  = [e for e in polys if layer_up(e,'LOT')]
    mzn_polys  = [e for e in polys if layer_up(e,'MAN') or layer_up(e,'MZN')]
    serv_polys = [e for e in polys if layer_up(e,'SERV')]
    verde_polys= [e for e in polys if layer_up(e,'ZON') or layer_up(e,'EQUIP') or layer_up(e,'VERD')]

    # Lot numbers via point-in-poly
    lot_texts  = [t for t in texts if layer_up(t,'LOT')]
    mzn_texts  = [t for t in texts if layer_up(t,'MAN') or layer_up(t,'MZN')]

    lotes_out = []
    for p in lot_polys:
        cx, cy = centroid(p['pts'])
        numero = None
        for t in lot_texts:
            if pip(t.get('cx', cx), t.get('cy', cy), p['pts']):
                numero = t.get('text',''); break
        # manzana via nearest anchor
        mzn_label = None
        if mzn_texts:
            best_d, best_t = float('inf'), None
            for t in mzn_texts:
                d = (t.get('cx',0)-cx)**2 + (t.get('cy',0)-cy)**2
                if d < best_d: best_d, best_t = d, t
            if best_t: mzn_label = best_t.get('text','').strip()
        lotes_out.append({'numero': numero, 'manzana': mzn_label, 'pts': p['pts'], 'cx': cx, 'cy': cy, 'sup': poly_area(p['pts'])})

    mzns_out = []
    for p in mzn_polys:
        cx, cy = centroid(p['pts'])
        label = None
        for t in mzn_texts:
            if pip(t.get('cx', cx), t.get('cy', cy), p['pts']):
                label = t.get('text',''); break
        if not label:
            best_d, best_t = float('inf'), None
            for t in mzn_texts:
                d = (t.get('cx',0)-cx)**2 + (t.get('cy',0)-cy)**2
                if d < best_d: best_d, best_t = d, t
            if best_t: label = best_t.get('text','')
        mzns_out.append({'label': label, 'pts': p['pts'], 'cx': cx, 'cy': cy})

    serv_out  = [{'pts': e['pts'], 'cx': centroid(e['pts'])[0], 'cy': centroid(e['pts'])[1]} for e in serv_polys]
    verde_out = []
    verde_texts = [t for t in texts if layer_up(t,'ZON') or layer_up(t,'EQUIP') or layer_up(t,'VERD')]
    for p in verde_polys:
        cx, cy = centroid(p['pts'])
        label = None
        for t in verde_texts:
            if pip(t.get('cx', cx), t.get('cy', cy), p['pts']):
                label = t.get('text',''); break
        verde_out.append({'label': label, 'pts': p['pts'], 'cx': cx, 'cy': cy})

    all_pts = [pt for l in lotes_out for pt in l['pts']]
    bb = {'minx': min(p[0] for p in all_pts), 'miny': min(p[1] for p in all_pts),
          'maxx': max(p[0] for p in all_pts), 'maxy': max(p[1] for p in all_pts)}
    geo = {'lotes': lotes_out, 'manzanas': mzns_out, 'servidumbres': serv_out, 'zonas_verdes': verde_out, 'bbox': bb}
    print(f'  Parsed: {len(lotes_out)} lotes, {len(mzns_out)} manzanas')
else:
    print(f'Unknown file type: {fp.suffix}'); sys.exit(1)

# ── Insert / upsert ────────────────────────────────────────────
def upsert(table, rows, conflict='id'):
    if args.dry_run:
        print(f'[dry-run] Would upsert {len(rows)} rows into {table}')
        return [{'id': f'fake-{i}'} for i in range(len(rows))]
    r = sb.table(table).upsert(rows, on_conflict=conflict).execute()
    return r.data

print(f'\nInserting emprendimiento {args.codigo}…')
emp_row = {
    'codigo': args.codigo, 'nombre': args.nombre, 'nombre_full': args.nombre,
    'ciudad': args.ciudad, 'ubicacion': args.ubicacion, 'estado_general': args.estado,
}
emp_data = upsert('emprendimientos', [emp_row], conflict='codigo')
emp_id = emp_data[0]['id'] if emp_data else None
print(f'  emp_id = {emp_id}')

# Manzanas
if geo.get('manzanas'):
    mzn_rows = [{'emprendimiento_id': emp_id, 'label': m['label'], 'closed': True,
                 'pts': m['pts'], 'cx': m['cx'], 'cy': m['cy']} for m in geo['manzanas']]
    upsert('manzanas', mzn_rows)
    print(f'  Inserted {len(mzn_rows)} manzanas')

# Lotes
if geo.get('lotes'):
    lot_rows = [{'emprendimiento_id': emp_id, 'tipo': 'lote',
                 'numero': l.get('numero') or l.get('lote'),
                 'manzana_label': l.get('manzana') or l.get('manzana',''),
                 'pts': l['pts'], 'cx': l['cx'], 'cy': l['cy'],
                 'superficie_m2': round(l.get('sup', l.get('superficie_m2', 0)), 1)}
                for l in geo['lotes']]
    upsert('lotes', lot_rows)
    print(f'  Inserted {len(lot_rows)} lotes')

# Zonas especiales
zonas = []
for s in geo.get('servidumbres', []):
    zonas.append({'emprendimiento_id': emp_id, 'tipo': 'servidumbre', 'label': 'Servidumbre',
                  'pts': s['pts'], 'cx': s['cx'], 'cy': s['cy']})
for z in geo.get('zonas_verdes', []):
    zonas.append({'emprendimiento_id': emp_id, 'tipo': 'zona_verde',
                  'label': z.get('label','Zona verde'),
                  'pts': z['pts'], 'cx': z['cx'], 'cy': z['cy']})
if zonas:
    upsert('zonas_especiales', zonas)
    print(f'  Inserted {len(zonas)} zonas especiales')

print('\n✅  Import complete')
