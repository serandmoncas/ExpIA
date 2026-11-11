import { getDb } from '@/lib/db/client'
import { getCatalog } from '@/lib/content/load'
import { getActor } from '@/lib/session'
import { learnedApi } from '@/lib/api/learned'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const api = learnedApi({
    db: await getDb(),
    userId: async (r) => (await getActor(r.headers))?.id ?? null,
    known: new Set(getCatalog().nodes.map((n) => n.id)),
  })
  return api.importIds(req)
}
