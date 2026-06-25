import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { supabase } from '../supabase'

export default function CambiarPassword() {
  const navigate = useNavigate()
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setOk(false)

    if (nueva.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (nueva !== repetir) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password: nueva })
    setLoading(false)

    if (err) {
      setError(err.message || 'No se pudo actualizar la contraseña')
    } else {
      setOk(true)
      setNueva(''); setRepetir('')
      setTimeout(() => navigate('/'), 1800)
    }
  }

  return (
    <>
      <Navbar />
      <div style={{
        maxWidth: 480, margin: '40px auto', padding: 24,
        background: '#fff', borderRadius: 10, border: '1px solid #e4e7ef'
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Cambiar contraseña</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
          Elegí una contraseña nueva. Mínimo 8 caracteres.
        </p>

        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="form-group">
            <label className="form-label">Nueva contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={mostrar ? 'text' : 'password'}
                required minLength={8}
                placeholder="••••••••"
                value={nueva}
                onChange={e => setNueva(e.target.value)}
                style={{ paddingRight: 70 }}
              />
              <button type="button" onClick={() => setMostrar(!mostrar)} style={btnVer}>
                {mostrar ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Repetir nueva contraseña</label>
            <input
              className="form-input"
              type={mostrar ? 'text' : 'password'}
              required minLength={8}
              placeholder="••••••••"
              value={repetir}
              onChange={e => setRepetir(e.target.value)}
            />
          </div>

          {error && <p className="form-error">{error}</p>}
          {ok && (
            <p style={{ color: '#16a34a', fontSize: 13, fontWeight: 600, margin: '12px 0' }}>
              ✓ Contraseña actualizada. Redirigiendo...
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                flex: 1, padding: '10px',
                background: '#fff', color: '#64748b',
                border: '1px solid #d1d5e0', borderRadius: 6,
                fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}>
              Cancelar
            </button>
            <button className="btn-primary" type="submit" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Actualizando…' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

const btnVer = {
  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: '#64748b', fontSize: 11, fontWeight: 600, padding: 4
}
