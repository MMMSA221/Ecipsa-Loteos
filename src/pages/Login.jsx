import { useState } from 'react'
import { supabase } from '../supabase'
import { track } from '../tracking'

const ERROR_MAP = {
  'Invalid login credentials': 'Email o contraseña incorrectos',
  'Email not confirmed': 'Confirmá tu email antes de ingresar',
  'User not found': 'No existe una cuenta con ese email',
  'Too many requests': 'Demasiados intentos. Esperá unos minutos.',
}
function translateError(msg) {
  return ERROR_MAP[msg] || msg || 'Error al iniciar sesión'
}

export default function Login() {
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(translateError(err.message))
    } else {
      track('login', { detalle: { metodo: 'password' } })
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src={import.meta.env.BASE_URL + 'logo_ecipsa.svg'}
            alt="Grupo ECIPSA"
            style={{ width: 180, height: 'auto', display: 'inline-block' }}
          />
        </div>
        <h1 className="login-title">Gestión de Loteos</h1>
        <p className="login-sub">Ingresá con tu cuenta corporativa</p>
        <form onSubmit={handleSubmit} autoComplete="on">
          <div className="form-group">
            <label className="form-label">Correo electrónico</label>
            <input className="form-input" type="email" required placeholder="usuario@ecipsa.com"
              autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={mostrar ? 'text' : 'password'}
                required
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={e => setPass(e.target.value)}
                style={{ paddingRight: 70 }}
              />
              <button
                type="button"
                onClick={() => setMostrar(!mostrar)}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#64748b', fontSize: 11, fontWeight: 600, padding: 4
                }}>
                {mostrar ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
