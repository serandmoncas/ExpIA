import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // PGlite trae archivos .wasm que no deben empaquetarse
  serverExternalPackages: ['@electric-sql/pglite'],
  // Las páginas dinámicas leen content/ en cada visita: hay que incluirlo en las funciones
  outputFileTracingIncludes: { '/**': ['./content/**/*'] },
}

export default nextConfig
