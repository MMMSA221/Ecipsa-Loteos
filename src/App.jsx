import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Emprendimiento from './pages/Emprendimiento'
import Actividad from './pages/Actividad'
import CambiarPassword from './pages/CambiarPassword'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return (
    <div className="loading-screen">
      <div className="loading-spinner"/>
      <p>Cargando…</p>
    </div>
  )

  const esAdmin = session?.user?.user_metadata?.role === 'admin'

  return (
    <Routes>
      <Route path="/login" element={!session ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/" element={session ? <Dashboard /> : <Navigate to="/login" replace />} />
      <Route path="/emprendimiento/:codigo" element={session ? <Emprendimiento /> : <Navigate to="/login" replace />} />
      <Route path="/actividad" element={
        session ? (esAdmin ? <Actividad /> : <Navigate to="/" replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/cambiar-password" element={
        session ? <CambiarPassword /> : <Navigate to="/login" replace />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
