import { getDb } from '@/lib/db/client'
import { getCatalog } from '@/lib/content/load'
import { getActor } from '@/lib/session'
import { learnedApi } from '@/lib/api/learned'

export const dynamic = 'force-dynamic'

const api = async () =>
  learnedApi({
    db: await getDb(),
    userId: async (req) => (await getActor(req.headers))?.id ?? null,
    known: new Set(getCatalog().nodes.map((n) => n.id)),
  })

export async function GET(req: Request) {
  return (await api()).list(req)
}

export async function POST(req: Request) {
  return (await api()).toggle(req)
}
