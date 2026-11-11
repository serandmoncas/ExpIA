import { toggleLearned } from '@/lib/learned'

export const IMPORT_DONE_KEY = 'expia.importOffered'

export const mergeLearned = (a: readonly string[], b: readonly string[]): string[] => [...new Set([...a, ...b])]

// Si el servidor falla, se deshace el cambio, pero solo si nadie lo cambió de nuevo mientras tanto
export function revertToggle(current: readonly string[], id: string, wanted: boolean): string[] {
  return current.includes(id) === wanted ? toggleLearned(current, id) : [...current]
}

export const pendingImport = (local: readonly string[], server: readonly string[], done: boolean): string[] =>
  done ? [] : local.filter((id) => !server.includes(id))
