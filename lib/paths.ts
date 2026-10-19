import type { AudiencePref } from '@/lib/audience'
import type { CatalogNode, Person } from '@/lib/content/types'
import type { ReviewItem } from '@/lib/content/schema'

export interface PathLike {
  id: string
  after?: string
  audience: readonly string[]
  steps: readonly { node: string; note?: string }[]
}

export function stepIds(p: Pick<PathLike, 'steps'>): string[] {
  return p.steps.map((s) => s.node)
}

export function resolveAfterChain(paths: Pick<PathLike, 'id' | 'after'>[], id: string): { chain: string[]; error?: string } {
  const byId = new Map(paths.map((p) => [p.id, p]))
  const chain: string[] = []
  const seen = new Set([id])
  let next = byId.get(id)?.after
  while (next) {
    if (seen.has(next)) return { chain, error: `ciclo en after: ${[id, ...chain, next].join(' → ')}` }
    if (!byId.has(next)) return { chain, error: `after: la ruta "${next}" no existe` }
    seen.add(next)
    chain.push(next)
    next = byId.get(next)!.after
  }
  return { chain }
}

// Basta con revisar los requires directos: si cada paso tiene los suyos antes, por inducción tiene todos
export function checkPathOrder(
  steps: string[],
  requiresOf: (id: string) => readonly string[] | undefined,
  covered: ReadonlySet<string>,
  after?: string,
): string[] {
  const seen = new Set(covered)
  const errors: string[] = []
  for (const id of steps) {
    for (const r of requiresOf(id) ?? []) {
      if (!seen.has(r)) errors.push(`"${id}" requiere "${r}", que no aparece antes${after ? ` ni en la ruta "${after}"` : ''}`)
    }
    seen.add(id)
  }
  return errors
}

export function sortPaths<T extends PathLike>(paths: T[]): T[] {
  const depth = new Map(paths.map((p) => [p.id, resolveAfterChain(paths, p.id).chain.length]))
  return [...paths].sort((a, b) => depth.get(a.id)! - depth.get(b.id)! || a.id.localeCompare(b.id))
}

export function pathProgress(ids: readonly string[], learned: ReadonlySet<string>): { done: number; total: number } {
  return { done: ids.filter((id) => learned.has(id)).length, total: ids.length }
}

export function nextStep(ids: readonly string[], learned: ReadonlySet<string>): string | undefined {
  return ids.find((id) => !learned.has(id))
}

export function pathsContaining<T extends PathLike>(paths: T[], nodeId: string): T[] {
  return paths.filter((p) => p.steps.some((s) => s.node === nodeId))
}

export function orderPathsForAudience<T extends PathLike>(paths: T[], pref: AudiencePref): T[] {
  if (pref === 'all') return [...paths]
  return [...paths.filter((p) => p.audience.includes(pref)), ...paths.filter((p) => !p.audience.includes(pref))]
}

export function pickContinue<T extends PathLike>(
  paths: T[],
  learned: ReadonlySet<string>,
): { path: T; next: string; done: number; total: number } | undefined {
  let best: { path: T; next: string; done: number; total: number } | undefined
  for (const path of paths) {
    const ids = stepIds(path)
    const { done, total } = pathProgress(ids, learned)
    if (done === 0 || done === total) continue
    if (!best || done / total > best.done / best.total) best = { path, next: nextStep(ids, learned)!, done, total }
  }
  return best
}

export type StepView = {
  node: { id: string; title: string; level: string; summary: string; review?: ReviewItem[] }
  note?: string
  voices: Person[]
}

// Solo lo que la vista necesita: las secciones del nodo no viajan al cliente
export function toStepViews(steps: readonly { node: string; note?: string }[], byId: Map<string, CatalogNode>, people: Person[]): StepView[] {
  return steps.map(({ node: id, note }) => {
    const n = byId.get(id)!
    return {
      node: { id: n.id, title: n.title, level: n.level, summary: n.summary, review: n.review },
      note,
      voices: people.filter((p) => p.topics.includes(id)),
    }
  })
}
