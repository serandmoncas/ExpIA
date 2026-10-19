import { getAuth } from '@/lib/auth'
import { accountsConfigured } from '@/lib/accounts-config'

export const dynamic = 'force-dynamic'

const handle = async (req: Request) => {
  if (!accountsConfigured()) {
    // Sin base de datos nadie tiene sesión; el resto de peticiones de cuentas no se pueden atender
    if (new URL(req.url).pathname.endsWith('/get-session')) return Response.json(null)
    return Response.json({ message: 'Las cuentas todavía no están disponibles.' }, { status: 503 })
  }
  return (await getAuth()).handler(req)
}

export { handle as GET, handle as POST }
