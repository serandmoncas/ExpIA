import type { ReleasedDate } from '@/lib/dates'
import type { NodeFrontmatter, PersonFrontmatter, Category, RadarFrontmatter, Source } from './schema'
import type { NodeSections } from './sections'

export type NodeMeta = NodeFrontmatter & { date: ReleasedDate }
export type CatalogNode = NodeMeta & { sections: NodeSections }
export type Person = PersonFrontmatter & { why: string }
export type Highlight = Person['highlights'][number]
export type Report = RadarFrontmatter & { summary: string }

export interface Catalog {
  nodes: CatalogNode[]
  byId: Map<string, CatalogNode>
  categories: Category[]
  people: Person[]
  peopleById: Map<string, Person>
  reports: Report[]
  sources: Source[]
}

export function toMeta(n: CatalogNode): NodeMeta {
  const { sections: _sections, ...meta } = n
  return meta
}
