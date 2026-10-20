import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  server: {
    port: 5180,
    watch: {
      ignored: [
        '**/dist/**',
        '**/release/**',
        '**/docs/**',
        '**/local_docs/**',
        '**/*.~tmp',
        '**/~tmp*',
        '**/tmp/**',
        '**/.preview/**',
        '**/.edge-profile/**',
        '**/GPUPersistentCache/**',
        '**/*.tmpdir/**',
        '**/.*.tmp*',
        '**/*.tmp',
      ],
    },
  },
  build: {
    assetsInlineLimit: 1024 * 1024,
    rollupOptions: {
      input: resolve(process.cwd(), 'index.html'),
    },
  },
}))
