import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  // PGlite (WASM) tarda ~1 s solo y ~11 s con ~10 archivos en paralelo: el hook por defecto (10 s) no alcanza
  test: { environment: 'node', include: ['tests/**/*.test.ts'], hookTimeout: 60_000 },
})
