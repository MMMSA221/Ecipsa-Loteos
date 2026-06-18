# Grupo ECIPSA — Tablero de Stock y Obra

App web interna para visualizar loteos con datos del CRM.  
React + Vite · Supabase (solo login) · GitHub Pages

🔗 **https://mmmsa221.github.io/Ecipsa-Loteos/**

---

## Arquitectura

Los datos se **generan en cada build** a partir de archivos en `data_src/`.  
No hay base de datos para los lotes — los archivos del repo son la fuente de verdad.  
Supabase se usa **solo para autenticación** (email + contraseña).

```
data_src/           ← Insumos (editá estos)
├── config.json          Configuración de emprendimientos
├── Base_emprendimientos.xlsx  Infraestructura (gas, agua, etc.)
├── 06_2026_Natania_73.xlsx    Excel CRM por obra
├── N73_geo.json               Plano (desde DXF)
└── ...

scripts/generate.mjs  ← Lee data_src → genera src/data/*.json
src/data/              ← Generado automáticamente (NO editar)
```

## Emprendimientos activos

| Código | Nombre | Provincia | Lotes |
|--------|--------|-----------|-------|
| N73 | Nuevo Maipú | Mendoza | 181 |
| N62 | Carrodilla I | Mendoza | 174 |
| N65 | Meglioli | San Juan | 348 |
| N74 | Santa Lucía II | San Juan | 69 |

## Deploy automático

Cada commit a `main` dispara GitHub Actions → build → publica en GitHub Pages.  
Las variables de Supabase están en **Settings → Secrets** del repo.

## Actualización mensual

Ver [ACTUALIZACION_MENSUAL.md](ACTUALIZACION_MENSUAL.md)

## Agregar un emprendimiento nuevo

1. Convertir el DXF a geo.json: `python scripts/import_dxf.py archivo.dxf`
2. Poner el geo.json + Excel CRM en `data_src/`
3. Agregar la entrada en `data_src/config.json`
4. Commit → deploy automático

## Funcionalidades

- **Dashboard**: tarjetas por provincia, mapa de Argentina interactivo
- **Vista emprendimiento**: plano SVG con pan/zoom, 3 modos de color (estado/tipo/estilo)
- **Filtros**: leyenda (Ctrl+clic múltiple), tipo inmueble, negocio, etapa, avance, manzana
- **KPIs**: Total/Disponibles/Adjudicados/Entregados (reflejan filtros activos)
- **Panel detalle**: clic en lote → info completa
- **Infraestructura**: barras de avance por servicio (desde Base_emprendimientos.xlsx)
- **Vista satelital**: superposición del plano sobre imagen satelital (requiere georef)
- **Links externos**: sitio web y pipeline por emprendimiento (configurables)

## Stack

- React 18 + React Router 6
- Vite 5 (build)
- Leaflet (mapa satelital)
- xlsx (lectura de Excel en el generador)
- Supabase (solo auth)
- GitHub Actions + GitHub Pages (CI/CD + hosting)

---

*Grupo ECIPSA · Proceso de Inteligencia Comercial*
