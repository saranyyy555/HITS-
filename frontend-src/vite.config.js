import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // server.py serves static files straight out of ../public and
    // do_GET() only special-cases paths starting with /api, so we
    // build the React bundle directly into that same folder. No
    // backend code changes are required.
    outDir: '../extracted/public',
    emptyOutDir: true,
  },
  server: {
    // During `npm run dev` the Vite dev server runs on its own port,
    // so proxy API calls to the unmodified Python backend (port 3000)
    // exactly like the browser would hit it in production (same-origin).
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
