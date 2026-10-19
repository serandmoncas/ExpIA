export const LEARNED_KEY = 'expia.learned'

export function parseLearned(raw: string | null | undefined, known: ReadonlySet<string>): string[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  // Un nodo renombrado o borrado deja ids viejos: se ignoran
  return [...new Set(data.filter((x): x is string => typeof x === 'string' && known.has(x)))]
}

export function readLearned(storage: Pick<Storage, 'getItem'> | undefined, known: ReadonlySet<string>): string[] {
  try {
    return parseLearned(storage?.getItem(LEARNED_KEY), known)
  } catch {
    return []
  }
}

export function writeLearned(storage: Pick<Storage, 'setItem'> | undefined, ids: readonly string[]): void {
  try {
    storage?.setItem(LEARNED_KEY, JSON.stringify(ids))
  } catch {
    // almacenamiento bloqueado o lleno: el progreso vive solo en memoria
  }
}

export function toggleLearned(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

// Parte de lo guardado y no del estado en memoria: un clic justo al hidratar, antes de leer
// el almacenamiento, no debe sobrescribir el progreso con una lista vacía
export function toggleStored(
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined,
  known: ReadonlySet<string>,
  current: readonly string[],
  id: string,
): string[] {
  let base = current
  if (storage) {
    try {
      base = parseLearned(storage.getItem(LEARNED_KEY), known)
    } catch {
      // lectura bloqueada: se usa el estado en memoria
    }
  }
  const next = toggleLearned(base, id)
  writeLearned(storage, next)
  return next
}
