type Env = Record<string, string | undefined>

// Origen público del sitio para armar enlaces en correos.
// En producción se exige BETTER_AUTH_URL: las cabeceras las controla quien hace la petición.
export function siteUrl(h: Headers, env: Env = process.env): string {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL.replace(/\/$/, '')
  if (env.NODE_ENV === 'production' && env.EXPIA_E2E !== '1') throw new Error('Falta BETTER_AUTH_URL')
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
