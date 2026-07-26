import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('exceljs')) {
            return 'export-excel'
          }

          if (id.includes('yaml')) {
            return 'export-yaml'
          }

          if (id.includes('dexie')) {
            return 'storage'
          }

          if (id.includes('react-router-dom')) {
            return 'routing'
          }

          if (id.includes('lucide-react')) {
            return 'icons'
          }

          if (id.includes('node_modules')) {
            return 'vendor'
          }

          return undefined
        },
      },
    },
  },
})
