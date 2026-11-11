import type { Catalog } from '@/lib/content/types'
import { getLearningPath } from '@/lib/graph'
import { stepIds } from '@/lib/paths'

export type ResolvedPath = { ref: string; title: string; ids: string[]; href: string }

export const curatedRef = (id: string): string => `curated:${id}`
export const generatedRef = (nodeId: string): string => `generated:${nodeId}`

// La spec 2 agregará `guide:<id>`; hasta entonces devuelve null
export function resolvePathRef(ref: string, catalog: Catalog): ResolvedPath | null {
  const sep = ref.indexOf(':')
  if (sep < 0) return null
  const kind = ref.slice(0, sep)
  const id = ref.slice(sep + 1)
  if (kind === 'curated') {
    const p = catalog.paths.find((x) => x.id === id)
    return p ? { ref, title: p.title, ids: stepIds(p), href: `/paths/${p.id}` } : null
  }
  if (kind === 'generated') {
    const node = catalog.byId.get(id)
    return node ? { ref, title: `Hasta ${node.title}`, ids: getLearningPath(catalog.nodes, id), href: `/learn/${id}` } : null
  }
  return null
}
