import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { track } from '../tracking'

export default function Navbar() {
  const [email, setEmail] = useState('')
  const [esAdmin, setEsAdmin] = useState(false)
  const location = useLocation()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setEmail(data.user.email || '')
        setEsAdmin(data.user.user_metadata?.role === 'admin')
      }
    })
  }, [])

  async function handleLogout() {
    await track('logout')
    await supabase.auth.signOut()
  }

  const initial = email ? email[0].toUpperCase() : 'E'
  const display = email ? email.split('@')[0] : 'Usuario'
  const enActividad = location.pathname === '/actividad'

  return (
    <nav className="navbar">
      <Link className="navbar-logo" to="/">
        <div className="navbar-logo-mark">E</div>
        <div className="navbar-logo-text">
          <span>Grupo</span>
          <span>ECIPSA</span>
        </div>
      </Link>
      <div className="navbar-spacer" />

      {esAdmin && !enActividad && (
        <Link to="/actividad" style={{
          marginRight: 12, padding: '6px 12px',
          background: 'rgba(251,117,32,.1)', color: '#FB7520',
          border: '1px solid rgba(251,117,32,.3)', borderRadius: 6,
          fontSize: 12, fontWeight: 600, textDecoration: 'none'
        }}>
          📊 Métricas
        </Link>
      )}

      <div className="navbar-user">
        <div className="navbar-avatar">{initial}</div>
        <span>{display}</span>
      </div>
      <button className="navbar-logout" onClick={handleLogout}>Salir</button>
    </nav>
  )
}
