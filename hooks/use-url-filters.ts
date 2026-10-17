'use client'
import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { parseFilters, serializeFilters, type Filters } from '@/lib/filters'

export function useUrlFilters(categoryIds: readonly string[]): [Filters, (f: Filters) => void] {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const filters = useMemo(
    () => parseFilters(new URLSearchParams(params.toString()), categoryIds),
    [params, categoryIds],
  )
  const setFilters = useCallback(
    (f: Filters) => {
      const qs = serializeFilters(f)
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname],
  )
  return [filters, setFilters]
}
