import path from 'node:path'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

// Lista os arquivos do build para o service worker pré-cachear (offline já na 1ª visita).
const precache = (): Plugin => ({
  name: 'precache',
  apply: 'build',
  generateBundle(_, bundle) {
    this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(Object.keys(bundle)) })
  },
})

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss(), precache()],
  // PWA local, carregado uma vez e servido do cache: um bundle só é mais simples que code-splitting
  build: { chunkSizeWarningLimit: 700 },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
})
