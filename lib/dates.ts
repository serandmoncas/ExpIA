export type Precision = 'year' | 'month' | 'day'

export interface ReleasedDate {
  raw: string
  year: number
  month?: number
  day?: number
  precision: Precision
}

const DATE_RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function parseReleased(raw: string): ReleasedDate {
  const fail = (why: string): never => {
    throw new Error(`Fecha inválida "${raw}": ${why}`)
  }
  const m = DATE_RE.exec(raw.trim())
  if (!m) return fail('usa YYYY, YYYY-MM o YYYY-MM-DD')
  const year = Number(m[1])
  const month = m[2] ? Number(m[2]) : undefined
  const day = m[3] ? Number(m[3]) : undefined
  if (month !== undefined && (month < 1 || month > 12)) fail('mes fuera de rango')
  if (day !== undefined && (day < 1 || day > daysInMonth(year, month!))) fail('día fuera de rango')
  return { raw, year, month, day, precision: day ? 'day' : month ? 'month' : 'year' }
}

function sortKey(d: ReleasedDate): number {
  return d.year * 10000 + (d.month ?? 1) * 100 + (d.day ?? 1)
}

export function compareDates(a: ReleasedDate, b: ReleasedDate): number {
  return sortKey(a) - sortKey(b)
}

export function toFractionalYear(d: ReleasedDate): number {
  return d.year + ((d.month ?? 1) - 1) / 12 + ((d.day ?? 1) - 1) / 365
}

export function formatReleased(d: ReleasedDate): string {
  if (d.precision === 'year') return String(d.year)
  const month = `${MONTHS[d.month! - 1]} ${d.year}`
  return d.precision === 'month' ? month : `${d.day} ${month}`
}
