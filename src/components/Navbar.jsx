import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { track } from '../tracking'

export default function Navbar() {
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setEmail(data.user.email)
    })
  }, [])

  async function handleLogout() {
    await track('logout')
    await supabase.auth.signOut()
  }

  const initial = email ? email[0].toUpperCase() : 'E'
  const display = email ? email.split('@')[0] : 'Usuario'

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
      <div className="navbar-user">
        <div className="navbar-avatar">{initial}</div>
        <span>{display}</span>
      </div>
      <button className="navbar-logout" onClick={handleLogout}>Salir</button>
    </nav>
  )
}
