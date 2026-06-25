import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { track } from '../tracking'

export default function Navbar() {
  const [email, setEmail] = useState('')
  const [esAdmin, setEsAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const menuRef = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setEmail(data.user.email || '')
        setEsAdmin(data.user.user_metadata?.role === 'admin')
      }
    })
  }, [])

  // Cerrar menú al clickear fuera
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  async function handleLogout() {
    await track('logout')
    await supabase.auth.signOut()
  }

  function irACambiarPassword() {
    setMenuOpen(false)
    navigate('/cambiar-password')
  }

  const initial = email ? email[0].toUpperCase() : 'E'
  const display = email ? email.split('@')[0] : 'Usuario'
  const enActividad = location.pathname === '/actividad'

  return (
    <nav className="navbar">
      <Link className="navbar-logo" to="/" style={{ display:'flex', alignItems:'center', gap:8 }}>
        <img
          src={import.meta.env.BASE_URL + 'logo_ecipsa.svg'}
          alt="Grupo ECIPSA"
          style={{ height: 32, width: 'auto' }}
        />
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

      {/* Menú del usuario */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="navbar-user"
          style={{ background:'transparent', border:'none', cursor:'pointer', padding: 0 }}>
          <div className="navbar-avatar">{initial}</div>
          <span>{display}</span>
          <span style={{ marginLeft: 6, fontSize: 10, color: '#64748b' }}>▾</span>
        </button>

        {menuOpen && (
          <div style={{
            position: 'absolute', top: '110%', right: 0,
            background: '#fff', border: '1px solid #e4e7ef', borderRadius: 8,
            boxShadow: '0 6px 24px rgba(0,0,0,.08)', minWidth: 220, zIndex: 100,
            overflow: 'hidden'
          }}>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid #f1f5f9' }}>
              <div style={{ fontSize:11, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', fontWeight:600 }}>Sesión</div>
              <div style={{ fontSize:12, color:'#1e2535', marginTop:2, wordBreak:'break-all' }}>{email}</div>
            </div>
            <button onClick={irACambiarPassword} style={itemMenu}>
              🔒 Cambiar contraseña
            </button>
          </div>
        )}
      </div>

      <button className="navbar-logout" onClick={handleLogout}>Salir</button>
    </nav>
  )
}

const itemMenu = {
  width:'100%', padding:'10px 14px', textAlign:'left',
  background:'transparent', border:'none', cursor:'pointer',
  fontSize:13, color:'#1e2535', fontFamily:'inherit'
}
