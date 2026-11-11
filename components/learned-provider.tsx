'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LEARNED_KEY, readLearned, toggleLearned, toggleStored } from '@/lib/learned'
import { revertToggle } from '@/lib/learned-sync'
import { safeLocalStorage } from '@/lib/audience'
import { authClient } from '@/lib/auth-client'

type LearnedState = {
  learned: ReadonlySet<string>
  ready: boolean
  toggle: (id: string) => void
  signedIn: boolean
  error: string | null
  serverIds: readonly string[] | null
  setFromServer: (ids: string[]) => void
}

const LearnedContext = createContext<LearnedState>({
  learned: new Set(), ready: false, toggle: () => {}, signedIn: false, error: null, serverIds: null, setFromServer: () => {},
})

export function LearnedProvider({ knownIds, children }: { knownIds: string[]; children: ReactNode }) {
  const known = useMemo(() => new Set(knownIds), [knownIds])
  const { data: session, isPending } = authClient.useSession()
  const signedIn = Boolean(session)
  const [ids, setIds] = useState<string[]>([])
  const [serverIds, setServerIds] = useState<string[] | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const setFromServer = useCallback((all: string[]) => {
    const visible = all.filter((id) => known.has(id))
    setServerIds(visible)
    setIds(visible)
  }, [known])

  // Sin sesión: localStorage, igual que en 5a. Con sesión: la API
  useEffect(() => {
    if (isPending) return
    setReady(false)
    if (!signedIn) {
      setServerIds(null)
      setIds(readLearned(safeLocalStorage(), known))
      setReady(true)
      const onStorage = (e: StorageEvent) => {
        if (e.key === LEARNED_KEY || e.key === null) setIds(readLearned(safeLocalStorage(), known))
      }
      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    }
    let alive = true
    setError(null)
    setLoadFailed(false)
    fetch('/api/learned')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { ids: string[] }) => { if (alive) { setFromServer(body.ids); setReady(true) } })
      .catch(() => { if (alive) { setError('No se pudo cargar tu avance.'); setLoadFailed(true) } })
    return () => { alive = false }
  }, [isPending, signedIn, known, setFromServer, reloadKey])

  const toggle = useCallback(
    (id: string) => {
      if (!ready) return
      if (!signedIn) {
        setIds(toggleStored(safeLocalStorage(), known, ids, id))
        return
      }
      const wanted = !ids.includes(id)
      setError(null)
      setLoadFailed(false)
      setIds(toggleLearned(ids, id))
      fetch('/api/learned', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nodeId: id, learned: wanted }) })
        .then((r) => { if (!r.ok) throw new Error(String(r.status)) })
        .catch(() => {
          // El updater solo calcula; el aviso va aparte
          setIds((cur) => revertToggle(cur, id, wanted))
          setError('No se pudo guardar. Inténtalo de nuevo.')
        })
    },
    [ready, signedIn, known, ids],
  )

  const learned = useMemo(() => new Set(ids), [ids])
  return (
    <LearnedContext.Provider value={{ learned, ready, toggle, signedIn, error, serverIds, setFromServer }}>
      {children}
      {error && (
        <p role="alert" data-testid="learned-error" className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-destructive px-4 py-2 text-sm text-white shadow">
          {error}
          {loadFailed && (
            <button type="button" data-testid="learned-retry" className="ml-3 underline" onClick={() => setReloadKey((k) => k + 1)}>
              Reintentar
            </button>
          )}
        </p>
      )}
    </LearnedContext.Provider>
  )
}

export const useLearned = () => useContext(LearnedContext)
