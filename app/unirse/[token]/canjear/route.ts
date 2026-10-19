import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { joinRedeem } from '@/lib/join'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return joinRedeem(req, (await params).token, { db: await getDb(), actor: await getActor(req.headers) })
}
