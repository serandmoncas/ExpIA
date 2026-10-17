import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { load, JSON_SCHEMA } from 'js-yaml'
import { nodeFrontmatterSchema, taxonomySchema } from './schema'
import { splitSections, type NodeSections } from './sections'
import type { Catalog, CatalogNode } from './types'
import { parseReleased, compareDates } from '@/lib/dates'
import { detectCycle } from '@/lib/graph'

export class ContentError extends Error {
  constructor(public errors: string[]) {
    super(`Contenido inválido:\n- ${errors.join('\n- ')}`)
    this.name = 'ContentError'
  }
}

// JSON_SCHEMA evita que YAML convierta 2020-05-22 en Date
const loadYaml = (s: string) => load(s, { schema: JSON_SCHEMA })
const matterOptions = { engines: { yaml: (s: string) => (loadYaml(s) ?? {}) as object } }

export function loadCatalog(contentDir = path.join(process.cwd(), 'content')): Catalog {
  const tax = taxonomySchema.safeParse(loadYaml(fs.readFileSync(path.join(contentDir, 'taxonomy.yaml'), 'utf8')))
  if (!tax.success) {
    throw new ContentError(tax.error.issues.map((i) => `taxonomy.yaml › ${i.path.join('.')}: ${i.message}`))
  }
  const categoryIds = new Set(tax.data.categories.map((c) => c.id))

  const errors: string[] = []
  const nodes: CatalogNode[] = []
  const nodesDir = path.join(contentDir, 'nodes')
  const files = fs.readdirSync(nodesDir).filter((f) => f.endsWith('.mdx')).sort()

  for (const fileName of files) {
    const rel = `nodes/${fileName}`
    const { data, content } = matter(fs.readFileSync(path.join(nodesDir, fileName), 'utf8'), matterOptions)
    const parsed = nodeFrontmatterSchema.safeParse(data)
    if (!parsed.success) {
      for (const i of parsed.error.issues) errors.push(`${rel} › ${i.path.join('.') || '(raíz)'}: ${i.message}`)
      continue
    }
    const front = parsed.data
    const expectedId = fileName.replace(/\.mdx$/, '')
    if (front.id !== expectedId) errors.push(`${rel} › id: "${front.id}" no coincide con el nombre del archivo`)
    for (const c of front.category) {
      if (!categoryIds.has(c)) errors.push(`${rel} › category: "${c}" no existe en taxonomy.yaml`)
    }
    const { sections, missing, unknown, duplicates } = splitSections(content)
    for (const h of missing) errors.push(`${rel} › cuerpo: falta la sección "## ${h}"`)
    for (const h of unknown) errors.push(`${rel} › cuerpo: sección desconocida "## ${h}" (usa ### para subsecciones)`)
    for (const h of duplicates) errors.push(`${rel} › cuerpo: sección duplicada "## ${h}"`)
    nodes.push({ ...front, date: parseReleased(front.released), sections: sections as NodeSections })
  }

  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const n of nodes) {
    for (const field of ['requires', 'related'] as const) {
      for (const ref of n[field]) {
        if (!byId.has(ref)) errors.push(`nodes/${n.id}.mdx › ${field}: "${ref}" no existe`)
      }
    }
  }
  const cycle = detectCycle(nodes)
  if (cycle) errors.push(`requires: ciclo ${cycle.join(' → ')}`)

  if (errors.length) throw new ContentError(errors)
  nodes.sort((a, b) => compareDates(a.date, b.date) || a.id.localeCompare(b.id))
  return { nodes, byId, categories: tax.data.categories }
}

let cached: Catalog | undefined
export function getCatalog(): Catalog {
  return (cached ??= loadCatalog())
}
