import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { joinRedeem } from '@/lib/join'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

const redeem = async (req: Request, { params }: Ctx) =>
  joinRedeem(req, (await params).token, { db: await getDb(), actor: await getActor(req.headers) })

// GET solo sirve para volver del enlace mágico o de Google (son navegaciones).
// El botón «Unirme al grupo» usa POST: un GET lo dispararía la precarga de Next
export { redeem as GET, redeem as POST }
