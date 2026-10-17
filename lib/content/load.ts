import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { load, JSON_SCHEMA } from 'js-yaml'
import type { ZodIssue } from 'zod'
import { nodeFrontmatterSchema, personFrontmatterSchema, taxonomySchema, sourcesSchema, radarFrontmatterSchema, pathFrontmatterSchema, type Source } from './schema'
import { splitSections, splitSectionsBy, PERSON_SECTION_HEADINGS, RADAR_SECTION_HEADINGS, type NodeSections } from './sections'
import type { Catalog, CatalogNode, Person, Report, LearningPath } from './types'
import { parseReleased, compareDates } from '@/lib/dates'
import { detectCycle } from '@/lib/graph'
import { resolveAfterChain, checkPathOrder, sortPaths, stepIds } from '@/lib/paths'

export class ContentError extends Error {
  constructor(public errors: string[]) {
    super(`Contenido inválido:\n- ${errors.join('\n- ')}`)
    this.name = 'ContentError'
  }
}

// JSON_SCHEMA evita que YAML convierta 2020-05-22 en Date
const loadYaml = (s: string) => load(s, { schema: JSON_SCHEMA })
const matterOptions = { engines: { yaml: (s: string) => (loadYaml(s) ?? {}) as object } }

function readMdx(dir: string): { fileName: string; data: unknown; content: string }[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .sort()
    .map((fileName) => {
      const { data, content } = matter(fs.readFileSync(path.join(dir, fileName), 'utf8'), matterOptions)
      return { fileName, data, content }
    })
}

function schemaErrors(rel: string, issues: ZodIssue[]): string[] {
  return issues.map((i) => `${rel} › ${i.path.join('.') || '(raíz)'}: ${i.message}`)
}

function sectionErrors(rel: string, r: { missing: string[]; unknown: string[]; duplicates: string[] }): string[] {
  return [
    ...r.missing.map((h) => `${rel} › cuerpo: falta la sección "## ${h}"`),
    ...r.unknown.map((h) => `${rel} › cuerpo: sección desconocida "## ${h}" (usa ### para subsecciones)`),
    ...r.duplicates.map((h) => `${rel} › cuerpo: sección duplicada "## ${h}"`),
  ]
}

function idMismatch(rel: string, fileName: string, id: string): string[] {
  return id === fileName.replace(/\.mdx$/, '') ? [] : [`${rel} › id: "${id}" no coincide con el nombre del archivo`]
}

export function loadCatalog(contentDir = path.join(process.cwd(), 'content')): Catalog {
  const tax = taxonomySchema.safeParse(loadYaml(fs.readFileSync(path.join(contentDir, 'taxonomy.yaml'), 'utf8')))
  if (!tax.success) {
    throw new ContentError(tax.error.issues.map((i) => `taxonomy.yaml › ${i.path.join('.')}: ${i.message}`))
  }
  const categoryIds = new Set(tax.data.categories.map((c) => c.id))
  const errors: string[] = []

  const nodes: CatalogNode[] = []
  for (const { fileName, data, content } of readMdx(path.join(contentDir, 'nodes'))) {
    const rel = `nodes/${fileName}`
    const parsed = nodeFrontmatterSchema.safeParse(data)
    if (!parsed.success) {
      errors.push(...schemaErrors(rel, parsed.error.issues))
      continue
    }
    const front = parsed.data
    errors.push(...idMismatch(rel, fileName, front.id))
    for (const c of front.category) {
      if (!categoryIds.has(c)) errors.push(`${rel} › category: "${c}" no existe en taxonomy.yaml`)
    }
    const split = splitSections(content)
    errors.push(...sectionErrors(rel, split))
    nodes.push({ ...front, date: parseReleased(front.released), sections: split.sections as NodeSections })
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

  const people: Person[] = []
  for (const { fileName, data, content } of readMdx(path.join(contentDir, 'people'))) {
    const rel = `people/${fileName}`
    const parsed = personFrontmatterSchema.safeParse(data)
    if (!parsed.success) {
      errors.push(...schemaErrors(rel, parsed.error.issues))
      continue
    }
    const front = parsed.data
    errors.push(...idMismatch(rel, fileName, front.id))
    for (const t of front.topics) {
      if (!byId.has(t)) errors.push(`${rel} › topics: "${t}" no existe`)
    }
    front.highlights.forEach((h, i) => {
      if (h.topic && !byId.has(h.topic)) errors.push(`${rel} › highlights.${i}.topic: "${h.topic}" no existe`)
    })
    const split = splitSectionsBy(content, PERSON_SECTION_HEADINGS)
    errors.push(...sectionErrors(rel, split))
    people.push({ ...front, why: split.sections.why ?? '' })
  }
  const peopleIds = new Set(people.map((p) => p.id))

  let sources: Source[] = []
  const sourcesPath = path.join(contentDir, 'sources.yaml')
  if (fs.existsSync(sourcesPath)) {
    const parsed = sourcesSchema.safeParse(loadYaml(fs.readFileSync(sourcesPath, 'utf8')))
    if (!parsed.success) errors.push(...schemaErrors('sources.yaml', parsed.error.issues))
    else {
      sources = parsed.data.sources
      const seen = new Set<string>()
      sources.forEach((s, i) => {
        if (seen.has(s.id)) errors.push(`sources.yaml › sources.${i}.id: "${s.id}" está duplicado`)
        if (peopleIds.has(s.id)) errors.push(`sources.yaml › sources.${i}.id: "${s.id}" coincide con un referente`)
        seen.add(s.id)
      })
    }
  }
  const sourceIds = new Set([...sources.map((s) => s.id), ...peopleIds])

  const reports: Report[] = []
  for (const { fileName, data, content } of readMdx(path.join(contentDir, 'radar'))) {
    const rel = `radar/${fileName}`
    const parsed = radarFrontmatterSchema.safeParse(data)
    if (!parsed.success) {
      errors.push(...schemaErrors(rel, parsed.error.issues))
      continue
    }
    const front = parsed.data
    if (front.week !== fileName.replace(/\.mdx$/, '')) errors.push(`${rel} › week: "${front.week}" no coincide con el nombre del archivo`)
    front.items.forEach((it, i) => {
      if (!sourceIds.has(it.source)) errors.push(`${rel} › items.${i}.source: "${it.source}" no es una fuente ni un referente`)
      for (const t of it.topics) if (!byId.has(t)) errors.push(`${rel} › items.${i}.topics: "${t}" no existe`)
    })
    front.proposals.forEach((p, i) => {
      const onNode = p.type === 'status' || p.type === 'new-node'
      if (onNode ? !byId.has(p.target) : !peopleIds.has(p.target)) errors.push(`${rel} › proposals.${i}.target: "${p.target}" no existe`)
    })
    const split = splitSectionsBy(content, RADAR_SECTION_HEADINGS)
    errors.push(...sectionErrors(rel, split))
    reports.push({ ...front, summary: split.sections.summary ?? '' })
  }

  const paths: LearningPath[] = []
  for (const { fileName, data, content } of readMdx(path.join(contentDir, 'paths'))) {
    const rel = `paths/${fileName}`
    const parsed = pathFrontmatterSchema.safeParse(data)
    if (!parsed.success) {
      errors.push(...schemaErrors(rel, parsed.error.issues))
      continue
    }
    const front = parsed.data
    errors.push(...idMismatch(rel, fileName, front.id))
    const seenSteps = new Set<string>()
    front.steps.forEach((s, i) => {
      const where = `${rel} › steps.${i}.node`
      const node = byId.get(s.node)
      if (!node) errors.push(`${where}: "${s.node}" no existe`)
      else if (seenSteps.has(s.node)) errors.push(`${where}: "${s.node}" está repetido`)
      else if ((node.review?.length ?? 0) < 2) errors.push(`${where}: "${s.node}" necesita al menos 2 preguntas de repaso`)
      seenSteps.add(s.node)
    })
    const headings = splitSectionsBy(content, {} as Record<never, string>).unknown
    if (headings.length) errors.push(`${rel} › cuerpo: la introducción no lleva títulos ## (${headings.map((h) => `"${h}"`).join(', ')})`)
    paths.push({ ...front, intro: content.trim() })
  }
  const pathsById = new Map(paths.map((p) => [p.id, p]))
  for (const p of paths) {
    const rel = `paths/${p.id}.mdx`
    const { chain, error } = resolveAfterChain(paths, p.id)
    if (error) {
      errors.push(`${rel} › ${error}`)
      continue
    }
    const covered = new Set(chain.flatMap((id) => stepIds(pathsById.get(id)!)))
    for (const e of checkPathOrder(stepIds(p), (id) => byId.get(id)?.requires, covered, p.after)) errors.push(`${rel} › steps: ${e}`)
  }

  if (errors.length) throw new ContentError(errors)
  nodes.sort((a, b) => compareDates(a.date, b.date) || a.id.localeCompare(b.id))
  people.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  reports.sort((a, b) => b.week.localeCompare(a.week))
  return {
    nodes,
    byId,
    categories: tax.data.categories,
    people,
    peopleById: new Map(people.map((p) => [p.id, p])),
    reports,
    sources,
    paths: sortPaths(paths),
  }
}

let cached: Catalog | undefined
export function getCatalog(): Catalog {
  return (cached ??= loadCatalog())
}
