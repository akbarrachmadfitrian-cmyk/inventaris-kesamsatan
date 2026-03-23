import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Inventaris Perangkat Kesamsatan',
        short_name: 'Inventaris',
        description: 'Aplikasi inventaris perangkat Kesamsatan Bapenda Prov Kalsel',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1E293B',
        icons: [
          {
            src: '/bapenda-kalsel.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/bapenda-kalsel.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      includeAssets: ['bapenda-kalsel.svg'],
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ],
})
