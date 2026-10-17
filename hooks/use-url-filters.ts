'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  parseFilters, serializeFilters, parsePeopleFilters, serializePeopleFilters,
  type Filters, type PeopleFilters,
} from '@/lib/filters'

// El estado local es la fuente de verdad para renderizar; la URL solo se sincroniza.
// router.replace pediría un payload RSC por cada tecla y, con latencia, perdería
// caracteres y clics. history.replaceState no hace petición y Next lo integra con useSearchParams.
export function useUrlState<T>(parse: (params: URLSearchParams) => T, serialize: (value: T) => string): [T, (value: T) => void] {
  const params = useSearchParams()
  const [value, setLocal] = useState(() => parse(new URLSearchParams(params.toString())))

  useEffect(() => {
    const onPopState = () => setLocal(parse(new URLSearchParams(window.location.search)))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [parse])

  const setValue = useCallback(
    (v: T) => {
      setLocal(v)
      const qs = serialize(v)
      window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
    },
    [serialize],
  )

  return [value, setValue]
}

export function useUrlFilters(categoryIds: readonly string[]): [Filters, (f: Filters) => void] {
  const parse = useCallback((p: URLSearchParams) => parseFilters(p, categoryIds), [categoryIds])
  return useUrlState(parse, serializeFilters)
}

export function useUrlPeopleFilters(topicIds: readonly string[]): [PeopleFilters, (f: PeopleFilters) => void] {
  const parse = useCallback((p: URLSearchParams) => parsePeopleFilters(p, topicIds), [topicIds])
  return useUrlState(parse, serializePeopleFilters)
}
