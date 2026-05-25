import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import POSPage from './pages/POSPage'
import VentasPage from './pages/VentasPage'
import ProductosPage from './pages/ProductosPage'
import IngredientesPage from './pages/IngredientesPage'
import InventarioPage from './pages/InventarioPage'
import UsuariosPage from './pages/UsuariosPage'

function RequireAuth() {
  const { user } = useAuth()
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function RequireAdmin() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/pos" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/pos" replace />} />
          <Route path="/pos" element={<POSPage />} />
          <Route path="/ventas" element={<VentasPage />} />

          <Route element={<RequireAdmin />}>
            <Route path="/productos" element={<ProductosPage />} />
            <Route path="/ingredientes" element={<IngredientesPage />} />
            <Route path="/inventario" element={<InventarioPage />} />
            <Route path="/usuarios" element={<UsuariosPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
