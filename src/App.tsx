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
import EquilibrioPage from './pages/EquilibrioPage'
import CosteoPage from './pages/CosteoPage'
import CosteoReportePage from './pages/CosteoReportePage'
import DesbloquearPage from './pages/DesbloquearPage'
import CrearPinPage from './pages/CrearPinPage'
import ActivarPinPage from './pages/ActivarPinPage'
import CocinaPage from './pages/CocinaPage'

function RequireAuth() {
  const { user, hayPin } = useAuth()
  if (user) return <Outlet />
  // Con PIN guardado se puede volver a entrar sin internet; el login normal no.
  if (hayPin === null) return null // aún consultando IndexedDB
  return <Navigate to={hayPin ? '/desbloquear' : '/login'} replace />
}

function RequireAdmin() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/pos" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/desbloquear" element={<DesbloquearPage />} />
      {/* Pública a propósito: la tablet de cocina no inicia sesión. Se entra
          con el botón del login y se queda puesta todo el día. */}
      <Route path="/cocina" element={<CocinaPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/pin" element={<CrearPinPage />} />
        <Route path="/pin/activar" element={<ActivarPinPage />} />

        {/* Fuera del Layout a propósito: lo que se imprime es un documento, no
            una pantalla de la app con barra lateral y navegación. */}
        <Route element={<RequireAdmin />}>
          <Route path="/costeo/reporte" element={<CosteoReportePage />} />
        </Route>

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
            <Route path="/equilibrio" element={<EquilibrioPage />} />
            <Route path="/costeo" element={<CosteoPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
