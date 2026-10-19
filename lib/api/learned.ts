import { z } from 'zod'
import type { Db } from '@/lib/db/client'
import { getLearned, importLearned, MAX_IMPORT, setLearned } from '@/lib/progress'

const toggleSchema = z.object({ nodeId: z.string(), learned: z.boolean() })
const importSchema = z.object({ ids: z.array(z.unknown()).max(MAX_IMPORT) })

const json = (body: unknown, status = 200) => Response.json(body, { status })

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return undefined
  }
}

export function learnedApi(deps: { db: Db; userId: (req: Request) => Promise<string | null>; known: ReadonlySet<string> }) {
  const { db, known } = deps
  return {
    async list(req: Request) {
      const userId = await deps.userId(req)
      if (!userId) return json({ error: 'sin-sesion' }, 401)
      return json({ ids: await getLearned(db, userId) })
    },
    async toggle(req: Request) {
      const userId = await deps.userId(req)
      if (!userId) return json({ error: 'sin-sesion' }, 401)
      const body = toggleSchema.safeParse(await readJson(req))
      if (!body.success || !known.has(body.data.nodeId)) return json({ error: 'cuerpo-invalido' }, 400)
      await setLearned(db, userId, body.data.nodeId, body.data.learned)
      return json({ ok: true })
    },
    async importIds(req: Request) {
      const userId = await deps.userId(req)
      if (!userId) return json({ error: 'sin-sesion' }, 401)
      const body = importSchema.safeParse(await readJson(req))
      if (!body.success) return json({ error: 'cuerpo-invalido' }, 400)
      const ids = body.data.ids.filter((x): x is string => typeof x === 'string' && known.has(x))
      return json({ ids: await importLearned(db, userId, ids) })
    },
  }
}
