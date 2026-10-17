import {
  KINDS, AUDIENCES, LEVELS, STATUSES, LICENSES, PRICINGS,
  type Kind, type Audience, type Level, type Status, type License, type Pricing,
} from '@/lib/content/enums'

export interface Filters {
  q: string
  cat: string[]
  kind: Kind[]
  aud: Audience[]
  level: Level[]
  status: Status[]
  license: License[]
  pricing: Pricing[]
  from?: number
  to?: number
}

export const EMPTY_FILTERS: Filters = {
  q: '', cat: [], kind: [], aud: [], level: [], status: [], license: [], pricing: [],
}

export interface FilterableNode {
  category: string[]
  kind: Kind
  audience: Audience[]
  level: Level
  status: Status
  license?: License
  pricing?: Pricing
  date: { year: number }
}

const LIST_KEYS = ['cat', 'kind', 'aud', 'level', 'status', 'license', 'pricing'] as const

function parseList<T extends string>(params: URLSearchParams, key: string, allowed?: readonly T[]): T[] {
  const raw = params.get(key)
  if (!raw) return []
  const values = raw.split(',').map((v) => v.trim()).filter(Boolean)
  const valid = allowed ? values.filter((v): v is T => (allowed as readonly string[]).includes(v)) : (values as T[])
  return [...new Set(valid)]
}

function parseYear(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key)
  return raw && /^\d{4}$/.test(raw) ? Number(raw) : undefined
}

export function parseFilters(params: URLSearchParams, knownCategories?: readonly string[]): Filters {
  let from = parseYear(params, 'from')
  let to = parseYear(params, 'to')
  if (from !== undefined && to !== undefined && from > to) [from, to] = [to, from]
  return {
    q: params.get('q') ?? '',
    cat: parseList(params, 'cat', knownCategories),
    kind: parseList(params, 'kind', KINDS),
    aud: parseList(params, 'aud', AUDIENCES),
    level: parseList(params, 'level', LEVELS),
    status: parseList(params, 'status', STATUSES),
    license: parseList(params, 'license', LICENSES),
    pricing: parseList(params, 'pricing', PRICINGS),
    from,
    to,
  }
}

export function serializeFilters(f: Filters): string {
  const parts: string[] = []
  if (f.q) parts.push(`q=${encodeURIComponent(f.q)}`)
  for (const key of LIST_KEYS) {
    const values = f[key] as string[]
    if (values.length) parts.push(`${key}=${values.map(encodeURIComponent).join(',')}`)
  }
  if (f.from !== undefined) parts.push(`from=${f.from}`)
  if (f.to !== undefined) parts.push(`to=${f.to}`)
  return parts.join('&')
}

// OR dentro de un grupo; un grupo vacío no filtra
function matchAny<T>(selected: T[], values: T[]): boolean {
  return selected.length === 0 || values.some((v) => selected.includes(v))
}

// Para campos opcionales: si se filtra por ellos, el nodo sin valor queda fuera
function matchOptional<T>(selected: T[], value: T | undefined): boolean {
  return selected.length === 0 || (value !== undefined && selected.includes(value))
}

// AND entre grupos; el rango de años es inclusivo; q lo resuelve la búsqueda aparte
export function applyFilters<T extends FilterableNode>(nodes: T[], f: Filters): T[] {
  return nodes.filter((n) =>
    matchAny(f.cat, n.category) &&
    matchAny(f.kind, [n.kind]) &&
    matchAny(f.aud, n.audience) &&
    matchAny(f.level, [n.level]) &&
    matchAny(f.status, [n.status]) &&
    matchOptional(f.license, n.license) &&
    matchOptional(f.pricing, n.pricing) &&
    (f.from === undefined || n.date.year >= f.from) &&
    (f.to === undefined || n.date.year <= f.to),
  )
}

export function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}
