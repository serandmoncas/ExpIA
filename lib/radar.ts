import { STATUSES, type Status } from '@/lib/content/enums'
import type { ReportItem } from '@/lib/content/schema'
import type { Report } from '@/lib/content/types'

export function getLatestReport(reports: Report[]): Report | undefined {
  return reports.reduce<Report | undefined>((best, r) => (!best || r.week > best.week ? r : best), undefined)
}

export function getTopItems(report: Report, limit = 3): ReportItem[] {
  return report.items.filter((i) => i.relevance === 'high').slice(0, limit)
}

export interface Mention {
  item: ReportItem
  week: string
}

export function getMentionsForTopic(reports: Report[], nodeId: string, limit = 3): Mention[] {
  return [...reports]
    .sort((a, b) => b.week.localeCompare(a.week))
    .flatMap((r) => r.items.filter((i) => i.topics.includes(nodeId)).map((item) => ({ item, week: r.week })))
    .slice(0, limit)
}

// El orden de STATUSES es el ciclo de vida: emerging → rising → mainstream → declining
export function isAdjacentStatus(from: Status, to: Status): boolean {
  return Math.abs(STATUSES.indexOf(from) - STATUSES.indexOf(to)) === 1
}

const weekFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export function formatWeek(week: string): string {
  return weekFormat.format(new Date(`${week}T00:00:00Z`))
}

export function sourceNames(sources: { id: string; name: string }[], people: { id: string; name: string }[]): Record<string, string> {
  return Object.fromEntries([...sources, ...people].map((s) => [s.id, s.name]))
}
