import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const API_TARGET = 'http://127.0.0.1:8000'

/**
 * Forward requests to the FastAPI backend — but ONLY real API calls.
 *
 * Several frontend routes share a path prefix with an API endpoint
 * (e.g. `/users`, `/products`, `/categories`). A full page load or refresh
 * on those routes sends `Accept: text/html`; without this guard it would be
 * proxied to the backend and come back as a JSON 404 instead of the app.
 * Axios requests send `Accept: application/json` (no `text/html`), so those
 * are still proxied normally.
 */
function apiProxy(): ProxyOptions {
  return {
    target: API_TARGET,
    bypass: (req) => {
      const accept = req.headers.accept ?? ''
      if (accept.includes('text/html')) return '/index.html'
      return undefined
    },
  }
}

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
      '/auth': apiProxy(),
      '/users': apiProxy(),
      '/category': apiProxy(),
      '/categories': apiProxy(),
      '/brands': apiProxy(),
      '/companies': apiProxy(),
      '/products': apiProxy(),
      '/variants': apiProxy(),
      '/product-variants': apiProxy(),
      '/party': apiProxy(),
      '/product-batch': apiProxy(),
      '/stock-movement': apiProxy(),
      '/purchases': apiProxy(),
      '/sales': apiProxy(),
    },
  },
})
