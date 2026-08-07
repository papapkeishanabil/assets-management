import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      includeAssets: ['favicon.ico', 'favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Harmas Asset Management',
        short_name: 'Harmas Assets',
        description: 'Aplikasi pengelolaan aset dan jadwal pemeliharaan CV Harmas Industri Sandang',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#1e40af',
        background_color: '#0f172a',
        lang: 'id-ID',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/harmas-logo.png', sizes: '192x192', type: 'image/png' },
          { src: '/harmas-logo.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      injectManifest: {
        rollupFormat: 'iife',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ],
  server: {
    port: 7000,
    strictPort: true,
    host: true
  }
})