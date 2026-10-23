import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { TurnoProvider } from './contexts/TurnoContext'
import App from './App'
import { isAndroidApp } from './services/printer/androidBridge'
import './index.css'

// Para los ajustes de pantalla que solo aplican dentro de la app de Android
if (isAndroidApp()) document.documentElement.classList.add('app-android')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TurnoProvider>
          <App />
        </TurnoProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
