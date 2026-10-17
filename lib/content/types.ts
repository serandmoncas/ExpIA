import type { ReleasedDate } from '@/lib/dates'
import type { NodeFrontmatter, Category } from './schema'
import type { NodeSections } from './sections'

export type NodeMeta = NodeFrontmatter & { date: ReleasedDate }
export type CatalogNode = NodeMeta & { sections: NodeSections }

export interface Catalog {
  nodes: CatalogNode[]
  byId: Map<string, CatalogNode>
  categories: Category[]
}

export function toMeta(n: CatalogNode): NodeMeta {
  const { sections: _sections, ...meta } = n
  return meta
}
