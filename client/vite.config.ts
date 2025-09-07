import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    https: {
      key: '../ssl/key.pem',
      cert: '../ssl/cert.pem',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  define: {
    // Передаем переменные окружения в клиент
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || '/api'),
    __CLIENT_URL__: JSON.stringify(process.env.VITE_CLIENT_URL || 'https://localhost:5173'),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Vite 7 uses 'baseline-widely-available' as default target
    // which targets Chrome 107+, Edge 107+, Firefox 104+, Safari 16.0+
    target: 'baseline-widely-available',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
