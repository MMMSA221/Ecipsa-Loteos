# Actualización mensual (todo desde el navegador)

## Stock de lotes (cada obra)

1. Exportá el Excel actualizado del CRM.
2. Entrá a **github.com/MMMSA221/Ecipsa-Loteos** → carpeta **`data_src`**.
3. **"Add file" → "Upload files"** → arrastrá el Excel nuevo.
   - Usá el **mismo nombre** que el anterior (ej. `06_2026_Natania_73.xlsx`).
4. **"Commit changes"**.
5. GitHub Actions regenera y publica solo en ~1 minuto.
   - Verificá en la pestaña **Actions** que el build esté ✅.

## Infraestructura (gas, agua, cloacas, etc.)

La infra sale de **`data_src/Base_emprendimientos.xlsx`**.
Para actualizar un porcentaje:
1. Descargá el archivo, editalo en Excel, y volvé a subirlo a `data_src/`.
2. Commit → deploy automático.

El sistema lee la columna "Id Pipeline" para matchear cada obra, y los pares
"Tiene X" / "Porcentaje avance obra X" para cada servicio.

## Si cambia un plano (rara vez)

Subí el nuevo `*_geo.json` a `data_src/` igual que el Excel.
Si te pasan un DXF, usá `python scripts/import_dxf.py archivo.dxf` para convertirlo.

## Agregar un emprendimiento nuevo

1. Subí el geo.json y el Excel CRM a `data_src/`.
2. Editá `data_src/config.json` y agregá la entrada (copiar una existente como modelo).
3. Para habilitar la **vista satelital**, agregá `georef` con 2 puntos de referencia.
4. Commit → aparece en el dashboard automáticamente.

## Vista satelital (georef)

Para habilitar el fondo satelital en un emprendimiento, necesitás 2 coordenadas
de referencia (lat/lon de 2 vértices del loteo identificables en Google Maps).
Agregarlas en `config.json` dentro del campo `georef` de la obra.

---

*No necesitás instalar nada. Todo se hace desde el navegador.*
