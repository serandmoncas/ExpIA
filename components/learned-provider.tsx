'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LEARNED_KEY, readLearned, toggleStored } from '@/lib/learned'
import { safeLocalStorage } from '@/lib/audience'

type LearnedState = { learned: ReadonlySet<string>; ready: boolean; toggle: (id: string) => void }

const LearnedContext = createContext<LearnedState>({ learned: new Set(), ready: false, toggle: () => {} })

export function LearnedProvider({ knownIds, children }: { knownIds: string[]; children: ReactNode }) {
  const known = useMemo(() => new Set(knownIds), [knownIds])
  const [ids, setIds] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  // El HTML estático sale sin marcas; se leen tras hidratar para no provocar diferencias
  useEffect(() => {
    setIds(readLearned(safeLocalStorage(), known))
    setReady(true)
    const onStorage = (e: StorageEvent) => {
      if (e.key === LEARNED_KEY || e.key === null) setIds(readLearned(safeLocalStorage(), known))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [known])

  // Hasta leer el almacenamiento no se acepta ningún cambio; la escritura va fuera del updater
  const toggle = useCallback(
    (id: string) => {
      if (!ready) return
      setIds(toggleStored(safeLocalStorage(), known, ids, id))
    },
    [ready, known, ids],
  )

  const learned = useMemo(() => new Set(ids), [ids])
  return <LearnedContext.Provider value={{ learned, ready, toggle }}>{children}</LearnedContext.Provider>
}

export const useLearned = () => useContext(LearnedContext)
