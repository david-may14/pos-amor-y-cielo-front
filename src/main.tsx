import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { TurnoProvider } from './contexts/TurnoContext'
import App from './App'
import './index.css'

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
