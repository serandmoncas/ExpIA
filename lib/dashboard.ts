import { compareDates } from '@/lib/dates'
import type { NodeMeta } from '@/lib/content/types'
import type { Category } from '@/lib/content/schema'

export function countByCategory(nodes: NodeMeta[], categories: Category[]) {
  return categories
    .map((category) => ({ category, count: nodes.filter((n) => n.category.includes(category.id)).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
}

export function selectTrending(nodes: NodeMeta[], limit = 8): NodeMeta[] {
  return nodes
    .filter((n) => n.status === 'emerging' || n.status === 'rising')
    .sort((a, b) => compareDates(b.date, a.date))
    .slice(0, limit)
}

export function selectLatestAdded(nodes: NodeMeta[], limit = 6): NodeMeta[] {
  return [...nodes].sort((a, b) => b.added.localeCompare(a.added) || a.title.localeCompare(b.title)).slice(0, limit)
}

export function selectFundamentals(nodes: NodeMeta[]): NodeMeta[] {
  return nodes.filter((n) => n.level === 'fundamentals').sort((a, b) => compareDates(a.date, b.date))
}
