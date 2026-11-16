import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'

/**
 * Injects the Content-Security-Policy. The dev build has to allow Vite's inline
 * React-refresh preamble and its websocket; the production build is strict.
 */
function csp(): Plugin {
  return {
    name: 'freely-csp',
    transformIndexHtml(html, ctx) {
      const dev = !!ctx.server
      const policy = [
        "default-src 'self'",
        `script-src 'self'${dev ? " 'unsafe-inline'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "media-src 'self' blob: mediastream:",
        "font-src 'self' data:",
        `connect-src 'self'${dev ? ' ws: http://localhost:*' : ''}`,
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; ')
      return html.replace('%CSP%', policy)
    },
  }
}

export default defineConfig({
  main: {
    build: { rollupOptions: { input: { index: resolve('src/main/main.ts') } } },
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/preload.ts'), region: resolve('src/preload/region.ts') },
        // Sandboxed preloads must be CommonJS.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react(), tailwindcss(), csp()],
    build: {
      rollupOptions: {
        input: { index: resolve('src/renderer/index.html'), region: resolve('src/renderer/region.html') },
      },
    },
  },
})
