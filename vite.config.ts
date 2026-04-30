import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src')
    }
  },
  plugins: [
    TanStackRouterVite({
      routesDirectory: resolve(__dirname, 'src/renderer/src/routes'),
      generatedRouteTree: resolve(__dirname, 'src/renderer/src/routeTree.gen.ts')
    }),
    react(),
    tailwindcss()
  ],
  build: {
    outDir: resolve(__dirname, 'out/renderer'),
    emptyOutDir: true
  }
})
