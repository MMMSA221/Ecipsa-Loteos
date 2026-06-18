-- ═══════════════════════════════════════════════════════════════
--  ECIPSA LOTEOS · Supabase Schema
--  Ejecutar en: Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Extensions
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────────────────────
-- 1. EMPRENDIMIENTOS
-- ──────────────────────────────────────────────────────────────
create table if not exists emprendimientos (
  id            uuid primary key default uuid_generate_v4(),
  codigo        text not null unique,          -- 'N62', 'N73'
  nombre        text not null,                  -- 'Carrodilla', 'Nuevo Maipú'
  nombre_full   text,                           -- 'N62 Carrodilla'
  ubicacion     text,                           -- 'Luján de Cuyo'
  ciudad        text,                           -- 'Mendoza'
  provincia     text default 'Mendoza',
  lat           numeric,                        -- coordenada para mapa general
  lng           numeric,
  estado_general text default 'En ejecución',  -- 'En ejecución','Finalizado','Preventa'
  descripcion   text,
  imagen_url    text,
  activo        boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ──────────────────────────────────────────────────────────────
-- 2. MANZANAS
-- ──────────────────────────────────────────────────────────────
create table if not exists manzanas (
  id                uuid primary key default uuid_generate_v4(),
  emprendimiento_id uuid references emprendimientos(id) on delete cascade,
  label             text not null,             -- 'A','B','C'...
  pts               jsonb not null,            -- [[x,y],[x,y]...]
  cx                numeric,
  cy                numeric,
  closed            boolean default true,
  created_at        timestamptz default now()
);
create index if not exists manzanas_emp_idx on manzanas(emprendimiento_id);

-- ──────────────────────────────────────────────────────────────
-- 3. LOTES (geometría pura del DXF)
-- ──────────────────────────────────────────────────────────────
create table if not exists lotes (
  id                uuid primary key default uuid_generate_v4(),
  emprendimiento_id uuid references emprendimientos(id) on delete cascade,
  manzana_id        uuid references manzanas(id),
  manzana_label     text,                      -- 'A','B'... (desnormalizado para queries rápidas)
  numero            text not null,             -- '1','2'...
  pts               jsonb not null,            -- [[x,y],[x,y]...]
  cx                numeric,
  cy                numeric,
  superficie_m2     numeric,
  tipo              text default 'lote',       -- 'lote','servidumbre','zona_verde','equipamiento'
  created_at        timestamptz default now()
);
create index if not exists lotes_emp_idx  on lotes(emprendimiento_id);
create index if not exists lotes_mzn_idx  on lotes(manzana_id);

-- ──────────────────────────────────────────────────────────────
-- 4. ZONAS ESPECIALES (servidumbres, zonas verdes)
-- ──────────────────────────────────────────────────────────────
create table if not exists zonas_especiales (
  id                uuid primary key default uuid_generate_v4(),
  emprendimiento_id uuid references emprendimientos(id) on delete cascade,
  tipo              text not null,             -- 'servidumbre','verde','equipamiento'
  label             text,
  pts               jsonb not null,
  cx                numeric,
  cy                numeric,
  created_at        timestamptz default now()
);

-- ──────────────────────────────────────────────────────────────
-- 5. ESTADOS DE LOTES (datos comerciales / CRM)
-- ──────────────────────────────────────────────────────────────
create table if not exists estados_lotes (
  id                uuid primary key default uuid_generate_v4(),
  lote_id           uuid references lotes(id) on delete cascade unique,
  emprendimiento_id uuid references emprendimientos(id),
  estado            text default 'Disponible',
    -- 'Disponible','Reservado','Adjudicado','Entregado','Escriturado','No Disponible'
  precio_usd        numeric,
  tipo_inmueble     text,                      -- 'Lote','Casa','Casa Futura','Macrolote'
  dormitorios       integer,
  m2_construido     numeric,
  avance_obra       text,                      -- 'En Construccion','Terminado','Sin Iniciar'
  fecha_entrega     date,
  negocio_comercial text,
  etapa             text,
  estilo            text,                      -- 'Europea','Americana','Mediterránea'
  observaciones     text,
  updated_at        timestamptz default now(),
  updated_by        text
);
create index if not exists estados_emp_idx on estados_lotes(emprendimiento_id);

-- ──────────────────────────────────────────────────────────────
-- 6. INFRAESTRUCTURA
-- ──────────────────────────────────────────────────────────────
create table if not exists infraestructura (
  id                uuid primary key default uuid_generate_v4(),
  emprendimiento_id uuid references emprendimientos(id) on delete cascade,
  tipo              text not null,             -- 'agua','cloacas','electricidad'...
  nombre            text not null,             -- 'Agua potable'
  icono             text,                      -- emoji '💧'
  porcentaje        integer default 0 check (porcentaje between 0 and 100),
  updated_at        timestamptz default now(),
  updated_by        text,
  unique(emprendimiento_id, tipo)
);

-- ──────────────────────────────────────────────────────────────
-- 7. AUDIT LOG (opcional)
-- ──────────────────────────────────────────────────────────────
create table if not exists audit_log (
  id          bigserial primary key,
  tabla       text,
  accion      text,       -- 'INSERT','UPDATE','DELETE'
  registro_id uuid,
  usuario     text,
  datos       jsonb,
  created_at  timestamptz default now()
);

-- ──────────────────────────────────────────────────────────────
-- TRIGGERS: updated_at automático
-- ──────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger emprendimientos_updated_at before update on emprendimientos
  for each row execute function set_updated_at();
create trigger estados_updated_at before update on estados_lotes
  for each row execute function set_updated_at();
create trigger infra_updated_at before update on infraestructura
  for each row execute function set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (solo usuarios autenticados)
-- ──────────────────────────────────────────────────────────────
alter table emprendimientos   enable row level security;
alter table manzanas          enable row level security;
alter table lotes             enable row level security;
alter table zonas_especiales  enable row level security;
alter table estados_lotes     enable row level security;
alter table infraestructura   enable row level security;

-- Política: cualquier usuario autenticado puede leer
create policy "auth_read" on emprendimientos   for select using (auth.role() = 'authenticated');
create policy "auth_read" on manzanas          for select using (auth.role() = 'authenticated');
create policy "auth_read" on lotes             for select using (auth.role() = 'authenticated');
create policy "auth_read" on zonas_especiales  for select using (auth.role() = 'authenticated');
create policy "auth_read" on estados_lotes     for select using (auth.role() = 'authenticated');
create policy "auth_read" on infraestructura   for select using (auth.role() = 'authenticated');

-- Política: solo authenticated puede escribir (podés restringir a roles específicos después)
create policy "auth_write" on estados_lotes   for all using (auth.role() = 'authenticated');
create policy "auth_write" on infraestructura for all using (auth.role() = 'authenticated');
create policy "auth_write" on emprendimientos for all using (auth.role() = 'authenticated');
create policy "auth_write" on lotes           for all using (auth.role() = 'authenticated');
create policy "auth_write" on manzanas        for all using (auth.role() = 'authenticated');
create policy "auth_write" on zonas_especiales for all using (auth.role() = 'authenticated');

-- ──────────────────────────────────────────────────────────────
-- VISTA RESUMEN (útil para el dashboard)
-- ──────────────────────────────────────────────────────────────
create or replace view resumen_emprendimientos as
select
  e.id, e.codigo, e.nombre, e.nombre_full, e.ubicacion, e.ciudad,
  e.estado_general, e.imagen_url,
  count(l.id)                                          as total_lotes,
  count(case when el.estado='Disponible'   then 1 end) as disponibles,
  count(case when el.estado='Reservado'    then 1 end) as reservados,
  count(case when el.estado='Adjudicado'   then 1 end) as adjudicados,
  count(case when el.estado='Entregado'    then 1 end) as entregados,
  count(case when el.estado='Escriturado'  then 1 end) as escriturados,
  round(
    count(case when el.estado in ('Adjudicado','Entregado','Escriturado') then 1 end)::numeric
    / nullif(count(l.id),0) * 100, 1
  ) as pct_comercializado
from emprendimientos e
left join lotes l on l.emprendimiento_id = e.id and l.tipo = 'lote'
left join estados_lotes el on el.lote_id = l.id
where e.activo = true
group by e.id, e.codigo, e.nombre, e.nombre_full, e.ubicacion, e.ciudad, e.estado_general, e.imagen_url;
