import { useState } from 'react'
import { supabase } from '../supabase'

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
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(translateError(err.message))
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-mark">E</div>
          <p>Grupo</p>
          <p>ECIPSA</p>
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
            <input className="form-input" type="password" required placeholder="••••••••"
              autoComplete="current-password" value={password} onChange={e => setPass(e.target.value)} />
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
