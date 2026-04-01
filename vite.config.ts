import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/app',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/app')
    }
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true
  },
  server: {
    port: 4281,
    strictPort: true
  }
})
