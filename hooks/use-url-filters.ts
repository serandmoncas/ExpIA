'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { parseFilters, serializeFilters, type Filters } from '@/lib/filters'

// El estado local es la fuente de verdad para renderizar; la URL solo se sincroniza.
// router.replace pediría un payload RSC por cada tecla y, con latencia, perdería
// caracteres y clics. history.replaceState no hace petición y Next lo integra con useSearchParams.
export function useUrlFilters(categoryIds: readonly string[]): [Filters, (f: Filters) => void] {
  const params = useSearchParams()
  const [filters, setLocal] = useState(() => parseFilters(new URLSearchParams(params.toString()), categoryIds))

  useEffect(() => {
    const onPopState = () => setLocal(parseFilters(new URLSearchParams(window.location.search), categoryIds))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [categoryIds])

  const setFilters = useCallback((f: Filters) => {
    setLocal(f)
    const qs = serializeFilters(f)
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
  }, [])

  return [filters, setFilters]
}
