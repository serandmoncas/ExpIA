import { KINDS, type Kind } from '@/lib/content/enums'
import { compareDates, formatReleased, toFractionalYear, type Precision, type ReleasedDate } from '@/lib/dates'

export interface TimelineInput { id: string; title: string; kind: Kind; category: string[]; date: ReleasedDate }
export interface TimelineItem {
  id: string; title: string; kind: Kind; color: string
  x: number; width: number; row: number; precision: Precision; dateLabel: string
}
export interface TimelineLayout {
  items: TimelineItem[]
  lanes: { kind: Kind; startRow: number; rows: number }[]
  totalRows: number
  minYear: number
  maxYear: number
  width: number
}

export function layoutTimeline(
  nodes: TimelineInput[],
  colorOf: (categoryId: string) => string,
  opts: { pxPerYear: number; maxYear: number; labelWidth: number },
): TimelineLayout {
  const { pxPerYear, maxYear, labelWidth } = opts
  if (nodes.length === 0) {
    return { items: [], lanes: [], totalRows: 0, minYear: maxYear - 10, maxYear, width: 10 * pxPerYear }
  }
  const minYear = Math.floor(Math.min(...nodes.map((n) => n.date.year)) / 10) * 10
  const sorted = [...nodes].sort((a, b) => compareDates(a.date, b.date) || a.id.localeCompare(b.id))
  const items: TimelineItem[] = []
  const lanes: TimelineLayout['lanes'] = []
  let startRow = 0

  for (const kind of KINDS) {
    const inLane = sorted.filter((n) => n.kind === kind)
    if (inLane.length === 0) continue
    const rowEnds: number[] = []
    for (const n of inLane) {
      const x = (toFractionalYear(n.date) - minYear) * pxPerYear
      const width = n.date.precision === 'year' ? pxPerYear : 0
      const end = x + Math.max(width, labelWidth)
      let row = rowEnds.findIndex((e) => e <= x)
      if (row === -1) {
        row = rowEnds.length
        rowEnds.push(end)
      } else {
        rowEnds[row] = end
      }
      items.push({
        id: n.id, title: n.title, kind, color: colorOf(n.category[0]),
        x, width, row: startRow + row, precision: n.date.precision, dateLabel: formatReleased(n.date),
      })
    }
    lanes.push({ kind, startRow, rows: rowEnds.length })
    startRow += rowEnds.length
  }
  return { items, lanes, totalRows: startRow, minYear, maxYear, width: (maxYear - minYear) * pxPerYear }
}

export function tickStep(pxPerYear: number): number {
  return pxPerYear >= 80 ? 1 : pxPerYear >= 30 ? 5 : 10
}
