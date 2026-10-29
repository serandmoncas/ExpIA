type Env = Record<string, string | undefined>

// Las cuentas necesitan base de datos: DATABASE_URL, o la local de las pruebas E2E.
// Sin ninguna, el sitio sigue funcionando sin cuentas en lugar de dar errores 500
export function accountsConfigured(env: Env = process.env): boolean {
  return Boolean(env.DATABASE_URL) || env.EXPIA_E2E === '1'
}
