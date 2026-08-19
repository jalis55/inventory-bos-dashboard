import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/users': 'http://127.0.0.1:8000',
      '/categories': 'http://127.0.0.1:8000',
      '/brands': 'http://127.0.0.1:8000',
      '/companies': 'http://127.0.0.1:8000',
      '/products': 'http://127.0.0.1:8000',
      '/product-variants': 'http://127.0.0.1:8000',
      '/party': 'http://127.0.0.1:8000',
      '/purchases': 'http://127.0.0.1:8000',
      '/sales': 'http://127.0.0.1:8000',
    },
  },
})
