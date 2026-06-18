# Setup inicial (una sola vez)

## 1. Repositorio GitHub

El repo ya está creado y público en:
**github.com/MMMSA221/Ecipsa-Loteos**

## 2. GitHub Pages

Configurado con GitHub Actions (`.github/workflows/deploy.yml`).
Cada push a `main` → build automático → publica en:
**https://mmmsa221.github.io/Ecipsa-Loteos/**

## 3. Secrets (variables de entorno)

En el repo → Settings → Secrets and variables → Actions:
- `VITE_SUPABASE_URL` → URL del proyecto Supabase
- `VITE_SUPABASE_ANON_KEY` → Clave anon pública de Supabase

## 4. Supabase (solo autenticación)

- Proyecto: sqmbrcpioajvaknmjyga.supabase.co
- Se usa SOLO para login (email + contraseña)
- Los datos de lotes NO están en Supabase — salen de los archivos en `data_src/`
- Crear usuarios: Supabase Dashboard → Authentication → Users

## 5. Actualización

Ver [ACTUALIZACION_MENSUAL.md](ACTUALIZACION_MENSUAL.md)
