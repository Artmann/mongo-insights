import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/app',
  plugins: [react()],
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true
  },
  server: {
    port: 4281,
    strictPort: true
  }
})
