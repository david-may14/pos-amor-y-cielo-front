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
import ModificadoresPage from './pages/ModificadoresPage'
import CategoriasPage from './pages/CategoriasPage'
import DescuentosPage from './pages/DescuentosPage'
import AnalyticsPage from './pages/AnalyticsPage'
import CajaPage from './pages/CajaPage'
import ConfiguracionPage from './pages/ConfiguracionPage'
import TicketsPage from './pages/TicketsPage'
import PlantillasPage from './pages/PlantillasPage'
import InsumosPage from './pages/InsumosPage'

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
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/ventas" element={<VentasPage />} />
          <Route path="/caja" element={<CajaPage />} />

          <Route element={<RequireAdmin />}>
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/productos" element={<ProductosPage />} />
            <Route path="/insumos" element={<InsumosPage />} />
            <Route path="/ingredientes" element={<Navigate to="/insumos" replace />} />
            <Route path="/plantillas" element={<Navigate to="/insumos" replace />} />
            <Route path="/inventario" element={<InventarioPage />} />
            <Route path="/usuarios" element={<UsuariosPage />} />
            <Route path="/modificadores" element={<ModificadoresPage />} />
            <Route path="/categorias" element={<CategoriasPage />} />
            <Route path="/descuentos" element={<DescuentosPage />} />
            <Route path="/configuracion" element={<ConfiguracionPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
