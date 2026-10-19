'use client'
import { useEffect, useState } from 'react'
import { useLearned } from './learned-provider'
import { Button } from './ui/button'
import { readLearned } from '@/lib/learned'
import { IMPORT_DONE_KEY, pendingImport } from '@/lib/learned-sync'
import { safeLocalStorage } from '@/lib/audience'

export function ImportOffer({ knownIds }: { knownIds: string[] }) {
  const { signedIn, serverIds, setFromServer } = useLearned()
  const [pending, setPending] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!signedIn || !serverIds) return setPending([])
    const storage = safeLocalStorage()
    let done = false
    try { done = storage?.getItem(IMPORT_DONE_KEY) === '1' } catch {}
    setPending(pendingImport(readLearned(storage, new Set(knownIds)), serverIds, done))
  }, [signedIn, serverIds, knownIds])

  const finish = () => {
    try { safeLocalStorage()?.setItem(IMPORT_DONE_KEY, '1') } catch {}
    setPending([])
  }
  const bring = async () => {
    setBusy(true)
    setFailed(false)
    try {
      const res = await fetch('/api/learned/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: pending }) })
      if (!res.ok) throw new Error(String(res.status))
      setFromServer(((await res.json()) as { ids: string[] }).ids)
      finish()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  if (!pending.length) return null
  return (
    <div data-testid="import-offer" className="mx-auto mt-4 flex max-w-6xl flex-wrap items-center gap-3 rounded-md border px-4 py-3 text-sm">
      <span>Tienes avance guardado en este navegador.</span>
      <Button size="sm" onClick={bring} disabled={busy}>Traer tu avance de este navegador ({pending.length} {pending.length === 1 ? 'nodo' : 'nodos'})</Button>
      <Button size="sm" variant="ghost" onClick={finish}>Descartar</Button>
      {failed && <span role="alert" className="text-destructive">No se pudo traer tu avance. Inténtalo de nuevo.</span>}
    </div>
  )
}
