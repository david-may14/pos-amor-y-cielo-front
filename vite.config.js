import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Amor y Cielo · POS',
        short_name: 'Amor y Cielo POS',
        description: 'Punto de venta para Amor y Cielo cafetería',
        theme_color: '#4d6335',
        background_color: '#faf7f2',
        display: 'standalone',
        start_url: '/',
        lang: 'es',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // La app depende de datos en vivo (ventas, inventario); no cachear llamadas a la API,
        // solo precachear el app shell (JS/CSS/HTML) para que la instalación funcione offline.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  publicDir: 'assets',
  server: {
    allowedHosts: true,
  },
})
