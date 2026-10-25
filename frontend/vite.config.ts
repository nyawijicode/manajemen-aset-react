import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backend = 'http://127.0.0.1:8000'

export default defineConfig(({ command }) => {
  const isBuild = command === 'build'

  return {
    // Build statis disajikan dari /ui/ agar tidak bertabrakan dengan rute
    // aplikasi /app pada PHP built-in server (direktori + index.html).
    base: isBuild ? '/ui/' : '/app/',
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: backend, changeOrigin: false },
        '/sanctum': { target: backend, changeOrigin: false },
      },
    },
    build: {
      outDir: isBuild ? '../backend/public/ui' : '../backend/public/app',
      emptyOutDir: true,
      sourcemap: false,
    },
  }
})
