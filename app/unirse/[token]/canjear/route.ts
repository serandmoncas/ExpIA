import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { joinRedeem } from '@/lib/join'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

const redeem = async (req: Request, { params }: Ctx) =>
  joinRedeem(req, (await params).token, { db: await getDb(), actor: await getActor(req.headers) })

// GET solo canjea al volver de iniciar sesión en el mismo navegador (cookie de invitación);
// si no, lleva a la invitación para confirmar. El botón «Unirme al grupo» usa POST del mismo sitio
export { redeem as GET, redeem as POST }
