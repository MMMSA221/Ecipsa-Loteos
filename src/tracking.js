// ============================================
// Sistema de tracking de actividad · ECIPSA
// ============================================
import { supabase } from './supabase'

/**
 * Registra un evento de actividad del usuario.
 * Si falla no rompe la app: el tracking no debe afectar la UX.
 */
export async function track(evento, datos = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const esAdmin = user.user_metadata?.role === 'admin'

    const payload = {
      user_id:        user.id,
      user_email:     user.email,
      evento,
      emprendimiento: datos.emprendimiento || null,
      manzana:        datos.manzana || null,
      lote:           datos.lote || null,
      detalle: {
        ...(datos.detalle || {}),
        es_admin: esAdmin,
      },
      user_agent: navigator.userAgent,
      // La IP la setea Supabase Edge Function si la configurás;
      // si no, queda null y se puede inferir desde logs.
      ip: null,
    }

    await supabase.from('actividad').insert(payload)
  } catch (err) {
    // Tracking silencioso: no romper la app si falla
    console.warn('[tracking]', err?.message || err)
  }
}
