// Carga los datos generados (src/data/*.json) sin depender de ninguna base.
// Los archivos los genera scripts/generate.py a partir de data_src/.
const files = import.meta.glob('./*.json', { eager: true })

export function getEmprendimiento(codigo) {
  const mod = files[`./${codigo}.json`]
  if (!mod) return null
  return mod.default || mod
}
