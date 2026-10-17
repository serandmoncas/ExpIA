# ExpIA — Tendencias y revisión tecnológica automática: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un agente semanal (script TypeScript en GitHub Actions) que lee fuentes curadas, usa Claude para elegir lo relevante y abre un PR con un informe publicado en `/radar` y propuestas ya aplicadas al catálogo.

**Architecture:** Los informes son archivos `content/radar/<YYYY-MM-DD>.mdx` validados con Zod al compilar, como el resto del contenido. El pipeline de `scripts/radar/` tiene fases deterministas (descargar, normalizar, deduplicar), una sola llamada a Claude con salida estructurada y una validación posterior que descarta todo lo que el modelo no pueda respaldar con URLs de la entrada. Las vistas del sitio leen los informes con funciones puras de `lib/radar.ts`.

**Tech Stack:** el mismo del sitio (Next.js 15 estático, TypeScript, Tailwind 4, shadcn/ui con Base UI, Zod 3, gray-matter, js-yaml 5, Vitest, Playwright) más `@anthropic-ai/sdk` 0.135, `fast-xml-parser` 5 y `tsx` 4.

**Spec:** `docs/superpowers/specs/2026-10-17-tendencias-design.md`

**Rama:** `feat/tendencias`, creada desde `feat/referentes` porque los PR #1 y #2 aún no están mergeados.

## Global Constraints

- UI y textos del informe solo en español.
- El sitio no llama a APIs externas: los informes son MDX que se compilan como el resto del contenido.
- Modelo `claude-opus-5-5`, `output_config.effort: "medium"`, salida estructurada con `client.beta.messages.parse` + `betaZodOutputFormat`, `fallbacks: "default"` con la beta `server-side-fallback-2026-07-01`. Sin herramientas ni bucle de agente.
- El esquema de la respuesta del modelo usa `zod/v4` (subruta incluida en zod 3.25): el helper del SDK no acepta esquemas de zod 3. Los esquemas del sitio siguen en `zod` (v3).
- Topes por informe: 15 ítems, 5 cambios de estado, 3 nodos nuevos, 5 recursos destacados; feeds sin tope. Máximo 150 ítems de entrada al modelo.
- Toda URL de un ítem o de la evidencia de una propuesta debe estar en la lista de entrada (comparando URLs normalizadas: sin `utm_*` ni fragmento).
- `status` solo pasa al estado adyacente en `emerging → rising → mainstream → declining`.
- Nodos nuevos con `verified: false`, `added` igual a la fecha del informe y `status` `emerging` o `rising`.
- Un recurso destacado solo se agrega si el referente tiene menos de 5 y el ítem viene de una fuente de ese referente (`item.source === personId`).
- Errores de contenido con el formato `radar/<archivo>.mdx › <campo>: <mensaje>` y `sources.yaml › <campo>: <mensaje>`.
- Única sección del cuerpo del informe: `## Resumen de la semana`.
- `ANTHROPIC_API_KEY` solo como secreto de GitHub Actions; si falta, el script termina con código 1 sin escribir nada.
- El pipeline se prueba sin red ni API: `fetch` y el cliente de Anthropic se inyectan.
- Los commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Una fuente devuelve HTML en vez de un feed** (página de captcha o de error con código 200): esa fuente cuenta como fallo y la ejecución sigue con las demás. Test en Task 4.
2. **El modelo devuelve una URL con parámetros de seguimiento o una URL inventada:** la primera se normaliza y se acepta; la segunda se descarta y aparece en "Propuestas descartadas". Tests en Task 6 y Task 8.
3. **El workflow se relanza o `applyProposals` corre dos veces:** no se duplican recursos, nodos ni feeds, y el estado no avanza dos pasos. Test en Task 7.
4. **Un referente con 5 recursos, o con `highlights` en formato de lista en línea:** la propuesta se descarta o se salta con un motivo, sin romper la ejecución. Tests en Task 6 y Task 7.
5. **Sin carpeta `content/radar/` ni `sources.yaml`:** el catálogo carga con `reports: []` y `sources: []`; el dashboard y las fichas ocultan los bloques del radar, y `/radar` muestra el estado vacío. Tests en Task 1 y Task 2.

---

## File Structure

```
content/sources.yaml                      # nuevo: fuentes curadas
content/radar/<YYYY-MM-DD>.mdx            # nuevo: un informe por semana
content/people/*.mdx                      # feeds.rss en referentes con blog
lib/content/enums.ts                      # +RELEVANCES, PROPOSAL_TYPES, SOURCE_KINDS, GENERATORS
lib/content/schema.ts                     # +sourceSchema, sourcesSchema, radarFrontmatterSchema
lib/content/sections.ts                   # +RADAR_SECTION_HEADINGS
lib/content/types.ts                      # +Report; Catalog.reports/sources
lib/content/load.ts                       # carga sources.yaml y content/radar
lib/radar.ts                              # nuevo: consultas puras sobre informes
scripts/radar/collect.ts                  # parseo de feeds/HN/GitHub, normalización, ventana, dedup
scripts/radar/fetch-sources.ts            # peticiones por fuente, tiempo límite, reintento
scripts/radar/resolve-feeds.ts            # ID de canal de YouTube desde la página
scripts/radar/judge.ts                    # llamada a Claude con salida estructurada
scripts/radar/validate.ts                 # reglas anti-invención, topes, referencias
scripts/radar/apply.ts                    # edición de archivos e informe
scripts/radar/pipeline.ts                 # orquestación probable con dependencias inyectadas
scripts/radar/run.ts                      # CLI (--dry-run, --collect-only)
.github/workflows/radar.yml               # cron semanal + PR
components/report-item-card.tsx  proposal-list.tsx  recent-mentions.tsx  this-week-block.tsx
app/radar/page.tsx  app/radar/[week]/page.tsx
app/page.tsx  app/node/[id]/page.tsx  components/site-header.tsx   # modificados
tests/fixtures/radar/*                    # rss.xml, atom.xml, hn.json, github.json, channel.html
tests/helpers/radar-content.ts            # contenido mínimo para pruebas de apply y pipeline
tests/*.test.ts  e2e/smoke.spec.ts
```

---

### Task 1: Esquemas y carga de fuentes e informes

**Files:**
- Modify: `lib/content/enums.ts`, `lib/content/schema.ts`, `lib/content/sections.ts`, `lib/content/types.ts`, `lib/content/load.ts` (reemplazar completo)
- Test: `tests/load.test.ts`

**Interfaces:**
- Produces:
  - `RELEVANCES = ['high','medium']`, `PROPOSAL_TYPES = ['status','new-node','highlight','feeds']`, `SOURCE_KINDS = ['rss','hackernews','github']`, `GENERATORS = ['radar-agent','manual']` y tipos `Relevance`, `ProposalType`, `SourceKind`
  - `sourceSchema` (unión discriminada por `kind`), `sourcesSchema`, `type Source`
  - `radarFrontmatterSchema`, `type RadarFrontmatter`, `type ReportItem`, `type Proposal`
  - `RADAR_SECTION_HEADINGS: Record<'summary', string>` = `{ summary: 'Resumen de la semana' }`
  - `type Report = RadarFrontmatter & { summary: string }`
  - `Catalog` gana `reports: Report[]` (semana más reciente primero) y `sources: Source[]`

- [ ] **Step 1: Escribir los tests que fallan**

En `tests/load.test.ts`, reemplazar `makeContent` por esta versión (agrega el cuarto parámetro):

```ts
function makeContent(
  nodes: Record<string, string>,
  taxonomy = TAXONOMY,
  people: Record<string, string> = {},
  extra: { radar?: Record<string, string>; sources?: string } = {},
): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expia-'))
  fs.mkdirSync(path.join(dir, 'nodes'))
  fs.writeFileSync(path.join(dir, 'taxonomy.yaml'), taxonomy)
  for (const [name, text] of Object.entries(nodes)) fs.writeFileSync(path.join(dir, 'nodes', `${name}.mdx`), text)
  if (Object.keys(people).length) {
    fs.mkdirSync(path.join(dir, 'people'))
    for (const [name, text] of Object.entries(people)) fs.writeFileSync(path.join(dir, 'people', `${name}.mdx`), text)
  }
  if (extra.sources !== undefined) fs.writeFileSync(path.join(dir, 'sources.yaml'), extra.sources)
  if (extra.radar) {
    fs.mkdirSync(path.join(dir, 'radar'))
    for (const [name, text] of Object.entries(extra.radar)) fs.writeFileSync(path.join(dir, 'radar', `${name}.mdx`), text)
  }
  return dir
}
```

Agregar al final del archivo:

```ts
const SOURCES = 'sources:\n  - { id: hn, name: Hacker News, kind: hackernews, minPoints: 100, keywords: [LLM] }\n'
const SUMMARY = '## Resumen de la semana\nPasaron cosas.\n'
const ITEM = '{ title: "Algo", url: "https://example.com/a", source: hn, publishedAt: 2026-10-20, topics: [a], relevance: high, summary: "Resumen" }'
function reportFile(week: string, extra: Record<string, string> = {}, body = SUMMARY): string {
  return file({
    week, from: '2026-10-16', sourcesChecked: '3', items: `[${ITEM}]`,
    generated: '{ by: manual, at: "2026-10-23T13:00:00Z" }', ...extra,
  }, body)
}
const withRadar = (radar: Record<string, string>, sources = SOURCES) =>
  makeContent({ a: file(fm('a')) }, TAXONOMY, {}, { radar, sources })
const W = 'radar/2026-10-23.mdx'

describe('loadCatalog: radar', () => {
  it('carga fuentes e informes, el más reciente primero', () => {
    const cat = loadCatalog(withRadar({ '2026-10-16': reportFile('2026-10-16'), '2026-10-23': reportFile('2026-10-23') }))
    expect(cat.reports.map((r) => r.week)).toEqual(['2026-10-23', '2026-10-16'])
    expect(cat.reports[0].summary).toBe('Pasaron cosas.')
    expect(cat.reports[0].items[0].publishedAt).toBe('2026-10-20')
    expect(cat.reports[0].proposals).toEqual([])
    expect(cat.sources.map((s) => s.id)).toEqual(['hn'])
  })
  it('sin carpeta radar ni sources.yaml carga vacío', () => {
    const cat = loadCatalog(makeContent({ a: file(fm('a')) }))
    expect(cat.reports).toEqual([])
    expect(cat.sources).toEqual([])
  })
  it('reporta un week distinto del nombre del archivo', () => {
    const errs = errorsOf(withRadar({ '2026-10-23': reportFile('2026-10-30') }))
    expect(errs.some((e) => e.startsWith(`${W} › week:`))).toBe(true)
  })
  it('reporta un tema inexistente en un ítem', () => {
    const items = `[${ITEM.replace('topics: [a]', 'topics: [zzz]')}]`
    expect(errorsOf(withRadar({ '2026-10-23': reportFile('2026-10-23', { items }) }))).toContain(`${W} › items.0.topics: "zzz" no existe`)
  })
  it('reporta una fuente que no es fuente ni referente', () => {
    const items = `[${ITEM.replace('source: hn', 'source: nope')}]`
    expect(errorsOf(withRadar({ '2026-10-23': reportFile('2026-10-23', { items }) }))).toContain(`${W} › items.0.source: "nope" no es una fuente ni un referente`)
  })
  it('limita los ítems a 15', () => {
    const items = `[${Array(16).fill(ITEM).join(', ')}]`
    const errs = errorsOf(withRadar({ '2026-10-23': reportFile('2026-10-23', { items }) }))
    expect(errs.some((e) => e.startsWith(`${W} › items`))).toBe(true)
  })
  it('exige from y to en un cambio de estado', () => {
    const proposals = '[{ type: status, target: a, reason: "r", evidence: ["https://example.com/a"] }]'
    expect(errorsOf(withRadar({ '2026-10-23': reportFile('2026-10-23', { proposals }) }))).toContain(`${W} › proposals.0.from: un cambio de estado requiere from y to`)
  })
  it('reporta el target inexistente de una propuesta', () => {
    const proposals = '[{ type: status, target: zzz, from: emerging, to: rising, reason: "r", evidence: ["https://example.com/a"] }]'
    expect(errorsOf(withRadar({ '2026-10-23': reportFile('2026-10-23', { proposals }) }))).toContain(`${W} › proposals.0.target: "zzz" no existe`)
  })
  it('reporta la sección faltante', () => {
    expect(errorsOf(withRadar({ '2026-10-23': reportFile('2026-10-23', {}, 'nada\n') }))).toContain(`${W} › cuerpo: falta la sección "## Resumen de la semana"`)
  })
  it('reporta un sources.yaml inválido', () => {
    const errs = errorsOf(withRadar({}, 'sources:\n  - { id: hn, name: HN, kind: hackernews, keywords: [LLM] }\n'))
    expect(errs.some((e) => e.startsWith('sources.yaml › sources.0'))).toBe(true)
  })
  it('reporta una fuente con el mismo id que un referente', () => {
    const dir = makeContent({ a: file(fm('a')) }, TAXONOMY, { p: personFile('p') }, {
      sources: 'sources:\n  - { id: p, name: P, kind: rss, url: "https://example.com/feed.xml" }\n',
    })
    expect(errorsOf(dir)).toContain('sources.yaml › sources.0.id: "p" coincide con un referente')
  })
})
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `npx vitest run tests/load.test.ts`
Expected: FAIL en los tests de `loadCatalog: radar` (`cat.reports` es `undefined` y no hay errores de radar). Los tests anteriores siguen pasando.

- [ ] **Step 3: Agregar enumeraciones y etiquetas**

En `lib/content/enums.ts`, después de los tipos de referentes:

```ts
export const RELEVANCES = ['high', 'medium'] as const
export const PROPOSAL_TYPES = ['status', 'new-node', 'highlight', 'feeds'] as const
export const SOURCE_KINDS = ['rss', 'hackernews', 'github'] as const
export const GENERATORS = ['radar-agent', 'manual'] as const

export type Relevance = (typeof RELEVANCES)[number]
export type ProposalType = (typeof PROPOSAL_TYPES)[number]
export type SourceKind = (typeof SOURCE_KINDS)[number]
```

Y agregar al final de `LABELS` (antes de la llave de cierre):

```ts
  high: 'Alta',
  medium: 'Media',
  status: 'Cambio de estado',
  'new-node': 'Nodo nuevo',
  highlight: 'Recurso destacado',
  feeds: 'Feed de YouTube',
  rss: 'RSS',
  hackernews: 'Hacker News',
```

- [ ] **Step 4: Agregar los esquemas**

En `lib/content/schema.ts`, ampliar el import de enums:

```ts
import {
  KINDS, AUDIENCES, LEVELS, STATUSES, LICENSES, PRICINGS, LANGUAGES, PERSON_KINDS, HIGHLIGHT_FORMATS,
  RELEVANCES, PROPOSAL_TYPES, GENERATORS,
} from './enums'
```

Y agregar al final del archivo:

```ts
const name = z.string().min(1)

export const sourceSchema = z.discriminatedUnion('kind', [
  z.object({ id, name, kind: z.literal('rss'), url }).strict(),
  z.object({ id, name, kind: z.literal('hackernews'), minPoints: z.number().int().positive(), keywords: z.array(z.string().min(1)).min(1) }).strict(),
  z.object({ id, name, kind: z.literal('github'), minStars: z.number().int().positive(), topics: z.array(z.string().min(1)).min(1) }).strict(),
])

export const sourcesSchema = z.object({ sources: z.array(sourceSchema).min(1) }).strict()

const reportItemSchema = z
  .object({
    title: z.string().min(1),
    url,
    source: id,
    publishedAt: added,
    topics: z.array(id).min(1),
    relevance: z.enum(RELEVANCES),
    summary: z.string().min(1).max(280),
  })
  .strict()

const proposalSchema = z
  .object({
    type: z.enum(PROPOSAL_TYPES),
    target: id,
    from: z.enum(STATUSES).optional(),
    to: z.enum(STATUSES).optional(),
    reason: z.string().min(1),
    evidence: z.array(url).min(1),
  })
  .strict()
  .refine((p) => p.type !== 'status' || (p.from !== undefined && p.to !== undefined), {
    message: 'un cambio de estado requiere from y to',
    path: ['from'],
  })

export const radarFrontmatterSchema = z
  .object({
    week: added,
    from: added,
    sourcesChecked: z.number().int().nonnegative(),
    items: z.array(reportItemSchema).max(15).default([]),
    proposals: z.array(proposalSchema).default([]),
    generated: z.object({ by: z.enum(GENERATORS), model: z.string().optional(), at: z.string().min(1) }).strict(),
  })
  .strict()

export type Source = z.infer<typeof sourceSchema>
export type RadarFrontmatter = z.infer<typeof radarFrontmatterSchema>
export type ReportItem = RadarFrontmatter['items'][number]
export type Proposal = RadarFrontmatter['proposals'][number]
```

- [ ] **Step 5: Agregar la sección y los tipos**

En `lib/content/sections.ts`, después de `PERSON_SECTION_HEADINGS`:

```ts
export const RADAR_SECTION_HEADINGS: Record<'summary', string> = { summary: 'Resumen de la semana' }
```

Reemplazar `lib/content/types.ts` completo:

```ts
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
```

- [ ] **Step 6: Reemplazar `lib/content/load.ts`**

```ts
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { load, JSON_SCHEMA } from 'js-yaml'
import type { ZodIssue } from 'zod'
import { nodeFrontmatterSchema, personFrontmatterSchema, taxonomySchema, sourcesSchema, radarFrontmatterSchema, type Source } from './schema'
import { splitSections, splitSectionsBy, PERSON_SECTION_HEADINGS, RADAR_SECTION_HEADINGS, type NodeSections } from './sections'
import type { Catalog, CatalogNode, Person, Report } from './types'
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
  }
}

let cached: Catalog | undefined
export function getCatalog(): Catalog {
  return (cached ??= loadCatalog())
}
```

- [ ] **Step 7: Correr los tests y verificar que pasan**

Run: `npm test && npx tsc --noEmit -p .`
Expected: todos PASS; `tsc` sin errores. Si algún test existente construye un `Catalog` a mano y `tsc` se queja de `reports`/`sources`, agregar `reports: [], sources: []` a ese objeto.

- [ ] **Step 8: Commit**

```bash
git add lib/content tests/load.test.ts
git commit -m "feat: esquemas y carga de fuentes e informes del radar"
```

---

### Task 2: `lib/radar.ts`

**Files:**
- Create: `lib/radar.ts`
- Test: `tests/radar.test.ts`

**Interfaces:**
- Consumes: `Report`, `ReportItem`, `STATUSES`, `Status` (Task 1)
- Produces:
  - `getLatestReport(reports: Report[]): Report | undefined`
  - `getTopItems(report: Report, limit = 3): ReportItem[]` (solo relevancia `high`, en orden)
  - `interface Mention { item: ReportItem; week: string }`
  - `getMentionsForTopic(reports: Report[], nodeId: string, limit = 3): Mention[]`
  - `isAdjacentStatus(from: Status, to: Status): boolean`
  - `formatWeek(week: string): string` (por ejemplo, `'23 de octubre de 2026'`)
  - `sourceNames(sources: { id: string; name: string }[], people: { id: string; name: string }[]): Record<string, string>`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/radar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getLatestReport, getTopItems, getMentionsForTopic, isAdjacentStatus, formatWeek, sourceNames } from '@/lib/radar'
import type { Report } from '@/lib/content/types'
import type { ReportItem } from '@/lib/content/schema'

const item = (url: string, o: Partial<ReportItem> = {}): ReportItem => ({
  title: url, url, source: 'hn', publishedAt: '2026-10-20', topics: ['rag'], relevance: 'medium', summary: 's', ...o,
})
const report = (week: string, items: ReportItem[] = []): Report => ({
  week, from: week, sourcesChecked: 1, items, proposals: [], generated: { by: 'manual', at: `${week}T00:00:00Z` }, summary: 'r',
})

describe('getLatestReport', () => {
  it('devuelve la semana más reciente sin depender del orden', () => {
    expect(getLatestReport([report('2026-10-16'), report('2026-10-23'), report('2026-10-09')])!.week).toBe('2026-10-23')
  })
  it('devuelve undefined sin informes', () => {
    expect(getLatestReport([])).toBeUndefined()
  })
})

describe('getTopItems', () => {
  it('devuelve solo ítems de relevancia alta, en orden y con tope', () => {
    const r = report('2026-10-23', [
      item('https://e.com/1', { relevance: 'high' }), item('https://e.com/2'),
      item('https://e.com/3', { relevance: 'high' }), item('https://e.com/4', { relevance: 'high' }),
      item('https://e.com/5', { relevance: 'high' }),
    ])
    expect(getTopItems(r).map((i) => i.url)).toEqual(['https://e.com/1', 'https://e.com/3', 'https://e.com/4'])
  })
})

describe('getMentionsForTopic', () => {
  it('junta menciones del tema, la semana más reciente primero', () => {
    const reports = [
      report('2026-10-16', [item('https://e.com/viejo')]),
      report('2026-10-23', [item('https://e.com/nuevo'), item('https://e.com/otro', { topics: ['llm'] })]),
    ]
    expect(getMentionsForTopic(reports, 'rag')).toEqual([
      { item: reports[1].items[0], week: '2026-10-23' },
      { item: reports[0].items[0], week: '2026-10-16' },
    ])
  })
  it('respeta el límite', () => {
    const r = report('2026-10-23', [1, 2, 3, 4].map((n) => item(`https://e.com/${n}`)))
    expect(getMentionsForTopic([r], 'rag', 2)).toHaveLength(2)
  })
})

describe('isAdjacentStatus', () => {
  it('acepta un paso hacia adelante o hacia atrás', () => {
    expect(isAdjacentStatus('emerging', 'rising')).toBe(true)
    expect(isAdjacentStatus('mainstream', 'rising')).toBe(true)
    expect(isAdjacentStatus('mainstream', 'declining')).toBe(true)
  })
  it('rechaza saltos y el mismo estado', () => {
    expect(isAdjacentStatus('emerging', 'mainstream')).toBe(false)
    expect(isAdjacentStatus('rising', 'rising')).toBe(false)
  })
})

describe('formatWeek', () => {
  it('formatea la fecha en español sin desfase de zona horaria', () => {
    expect(formatWeek('2026-10-23')).toBe('23 de octubre de 2026')
    expect(formatWeek('2026-01-01')).toBe('1 de enero de 2026')
  })
})

describe('sourceNames', () => {
  it('une nombres de fuentes y referentes por id', () => {
    expect(sourceNames([{ id: 'hn', name: 'Hacker News' }], [{ id: 'p', name: 'Persona' }])).toEqual({ hn: 'Hacker News', p: 'Persona' })
  })
})
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `npx vitest run tests/radar.test.ts`
Expected: FAIL con "Failed to resolve import '@/lib/radar'".

- [ ] **Step 3: Implementar `lib/radar.ts`**

```ts
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
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run tests/radar.test.ts && npx tsc --noEmit -p .`
Expected: PASS; `tsc` sin errores.

- [ ] **Step 5: Commit**

```bash
git add lib/radar.ts tests/radar.test.ts
git commit -m "feat: consultas puras sobre informes del radar"
```

---

### Task 3: Normalización y recolección (`collect.ts`)

**Files:**
- Create: `scripts/radar/collect.ts`, `tests/fixtures/radar/rss.xml`, `tests/fixtures/radar/atom.xml`, `tests/fixtures/radar/hn.json`, `tests/fixtures/radar/github.json`
- Modify: `package.json` (dependencia `fast-xml-parser`)
- Test: `tests/radar-collect.test.ts`

**Interfaces:**
- Produces:
  - `interface RawItem { title: string; url: string; source: string; publishedAt: string /* ISO */; excerpt: string }`
  - `parseFeed(body: string, source: string): RawItem[]` (RSS 2.0 y Atom; lanza `Error('no es un feed RSS ni Atom')`)
  - `parseHackerNews(body: string, source: string): RawItem[]`
  - `parseGitHub(body: string, source: string): RawItem[]`
  - `normalizeUrl(raw: string): string | null`
  - `seenUrls(reports: { items: { url: string }[] }[]): Set<string>`
  - `interface CollectOptions { now: Date; seen: Set<string>; max: number; days?: number }`
  - `collectItems(raw: RawItem[], options: CollectOptions): RawItem[]` (URLs normalizadas, más reciente primero)

- [ ] **Step 1: Instalar la dependencia**

Run: `npm install fast-xml-parser@^5.11.2`
Expected: `package.json` gana `"fast-xml-parser"` en `dependencies`.

- [ ] **Step 2: Crear los fixtures**

`tests/fixtures/radar/rss.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Blog de prueba</title>
    <item>
      <title>Nuevo modelo &amp; agentes</title>
      <link>https://blog.example.com/nuevo-modelo?utm_source=rss</link>
      <pubDate>Tue, 20 Oct 2026 10:00:00 GMT</pubDate>
      <description><![CDATA[<p>Un modelo <b>nuevo</b> para agentes.</p>]]></description>
    </item>
    <item>
      <title>Entrada vieja</title>
      <link>https://blog.example.com/vieja</link>
      <pubDate>Tue, 01 Sep 2026 10:00:00 GMT</pubDate>
      <description>Antigua</description>
    </item>
  </channel>
</rss>
```

`tests/fixtures/radar/atom.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>Canal de prueba</title>
  <entry>
    <title>Cómo funciona MCP</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/>
    <published>2026-10-21T15:00:00+00:00</published>
    <media:group>
      <media:description>Explicación de MCP paso a paso.</media:description>
    </media:group>
  </entry>
</feed>
```

`tests/fixtures/radar/hn.json`:

```json
{
  "hits": [
    { "title": "Show HN: Un agente open source", "url": "https://github.com/example/agente", "objectID": "1", "created_at": "2026-10-21T12:00:00Z", "points": 420 },
    { "title": "Ask HN: ¿Qué usan para RAG?", "url": null, "objectID": "2", "created_at": "2026-10-22T08:00:00Z", "points": 250, "story_text": "<p>Pregunta</p>" }
  ]
}
```

`tests/fixtures/radar/github.json`:

```json
{
  "items": [
    { "full_name": "example/fast-rag", "html_url": "https://github.com/example/fast-rag", "description": "RAG rápido", "created_at": "2026-10-19T09:00:00Z", "stargazers_count": 812 }
  ]
}
```

- [ ] **Step 3: Escribir los tests que fallan**

Crear `tests/radar-collect.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseFeed, parseHackerNews, parseGitHub, normalizeUrl, collectItems, seenUrls, type RawItem } from '@/scripts/radar/collect'

const fixture = (name: string) => fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/radar', name), 'utf8')
const NOW = new Date('2026-10-23T13:00:00Z')
const raw = (url: string, publishedAt: string, source = 's'): RawItem => ({ title: url, url, source, publishedAt, excerpt: '' })
const opts = (o: Partial<{ seen: Set<string>; max: number }> = {}) => ({ now: NOW, seen: new Set<string>(), max: 150, ...o })

describe('parseFeed', () => {
  it('lee RSS 2.0 con entidades, CDATA y HTML', () => {
    const items = parseFeed(fixture('rss.xml'), 'blog')
    expect(items).toHaveLength(2)
    expect(items[0]).toEqual({
      title: 'Nuevo modelo & agentes',
      url: 'https://blog.example.com/nuevo-modelo?utm_source=rss',
      source: 'blog',
      publishedAt: '2026-10-20T10:00:00.000Z',
      excerpt: 'Un modelo nuevo para agentes.',
    })
  })
  it('lee Atom de YouTube con la descripción de media:group', () => {
    expect(parseFeed(fixture('atom.xml'), 'canal')).toEqual([{
      title: 'Cómo funciona MCP',
      url: 'https://www.youtube.com/watch?v=abc123',
      source: 'canal',
      publishedAt: '2026-10-21T15:00:00.000Z',
      excerpt: 'Explicación de MCP paso a paso.',
    }])
  })
  it('falla con un documento que no es un feed', () => {
    expect(() => parseFeed('<html><body>Captcha</body></html>', 'x')).toThrow(/no es un feed/)
  })
})

describe('parseHackerNews', () => {
  it('usa el enlace de la discusión cuando la historia no tiene URL', () => {
    const items = parseHackerNews(fixture('hn.json'), 'hn')
    expect(items.map((i) => i.url)).toEqual(['https://github.com/example/agente', 'https://news.ycombinator.com/item?id=2'])
    expect(items[1].excerpt).toBe('Pregunta')
  })
})

describe('parseGitHub', () => {
  it('convierte repositorios en ítems con las estrellas en el extracto', () => {
    const [item] = parseGitHub(fixture('github.json'), 'gh')
    expect(item).toMatchObject({ title: 'example/fast-rag', url: 'https://github.com/example/fast-rag', source: 'gh', publishedAt: '2026-10-19T09:00:00.000Z' })
    expect(item.excerpt).toContain('★ 812')
  })
})

describe('normalizeUrl', () => {
  it('quita utm_* y el fragmento', () => {
    expect(normalizeUrl('https://Example.com/a?utm_source=x&id=3#top')).toBe('https://example.com/a?id=3')
  })
  it('rechaza esquemas que no son http(s) y textos inválidos', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeUrl('no es url')).toBeNull()
  })
})

describe('collectItems', () => {
  it('se queda con la ventana de 7 días y normaliza las URLs', () => {
    const items = collectItems(parseFeed(fixture('rss.xml'), 'blog'), opts())
    expect(items.map((i) => i.url)).toEqual(['https://blog.example.com/nuevo-modelo'])
  })
  it('quita lo ya publicado en informes anteriores', () => {
    const seen = seenUrls([{ items: [{ url: 'https://e.com/a?utm_medium=x' }] }])
    const items = collectItems([raw('https://e.com/a', '2026-10-22T00:00:00Z'), raw('https://e.com/b', '2026-10-22T00:00:00Z')], opts({ seen }))
    expect(items.map((i) => i.url)).toEqual(['https://e.com/b'])
  })
  it('deduplica la misma URL de dos fuentes y conserva la primera', () => {
    const items = collectItems([raw('https://e.com/a', '2026-10-22T00:00:00Z', 'uno'), raw('https://e.com/a#x', '2026-10-22T00:00:00Z', 'dos')], opts())
    expect(items.map((i) => i.source)).toEqual(['uno'])
  })
  it('recorta a max conservando los más recientes', () => {
    const items = collectItems([
      raw('https://e.com/1', '2026-10-17T00:00:00Z'),
      raw('https://e.com/2', '2026-10-22T00:00:00Z'),
      raw('https://e.com/3', '2026-10-20T00:00:00Z'),
    ], opts({ max: 2 }))
    expect(items.map((i) => i.url)).toEqual(['https://e.com/2', 'https://e.com/3'])
  })
  it('descarta fechas futuras', () => {
    expect(collectItems([raw('https://e.com/f', '2026-11-01T00:00:00Z')], opts())).toEqual([])
  })
})
```

- [ ] **Step 4: Correr los tests y ver que fallan**

Run: `npx vitest run tests/radar-collect.test.ts`
Expected: FAIL con "Failed to resolve import '@/scripts/radar/collect'".

- [ ] **Step 5: Implementar `scripts/radar/collect.ts`**

```ts
import { XMLParser } from 'fast-xml-parser'

export interface RawItem {
  title: string
  url: string
  source: string
  publishedAt: string
  excerpt: string
}

const DAY = 24 * 60 * 60 * 1000
const EXCERPT_MAX = 300

// parseTagValue: false evita que un título como "2026" se convierta en número
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false, parseAttributeValue: false })

type XmlNode = Record<string, unknown>
const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v])

function text(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (v && typeof v === 'object' && '#text' in v) return String((v as XmlNode)['#text'])
  return ''
}

function cleanText(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function excerpt(s: string): string {
  const t = cleanText(s)
  return t.length > EXCERPT_MAX ? `${t.slice(0, EXCERPT_MAX - 1)}…` : t
}

function iso(s: string): string | null {
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

function atomLink(v: unknown): string {
  const links = asArray(v as XmlNode | XmlNode[])
  const alt = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0]
  return alt ? text(alt['@_href']) : ''
}

export function parseFeed(body: string, source: string): RawItem[] {
  const doc = xml.parse(body) as XmlNode
  const channel = (doc.rss as XmlNode | undefined)?.channel as XmlNode | undefined
  const feed = doc.feed as XmlNode | undefined
  if (!channel && !feed) throw new Error('no es un feed RSS ni Atom')

  const out: RawItem[] = []
  const push = (title: string, url: string, date: string, desc: string) => {
    const publishedAt = iso(date)
    if (title.trim() && url.trim() && publishedAt) {
      out.push({ title: cleanText(title), url: url.trim(), source, publishedAt, excerpt: excerpt(desc) })
    }
  }
  for (const it of asArray(channel?.item as XmlNode | XmlNode[] | undefined)) {
    push(text(it.title), text(it.link), text(it.pubDate ?? it['dc:date']), text(it.description))
  }
  for (const e of asArray(feed?.entry as XmlNode | XmlNode[] | undefined)) {
    const media = e['media:group'] as XmlNode | undefined
    push(text(e.title), atomLink(e.link), text(e.published ?? e.updated), text(e.summary ?? e.content ?? media?.['media:description']))
  }
  return out
}

interface HnHit { title?: string | null; url?: string | null; objectID: string; created_at: string; story_text?: string | null }

export function parseHackerNews(body: string, source: string): RawItem[] {
  const { hits } = JSON.parse(body) as { hits: HnHit[] }
  return hits.flatMap((h) => {
    const publishedAt = iso(h.created_at)
    if (!h.title || !publishedAt) return []
    const url = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`
    return [{ title: cleanText(h.title), url, source, publishedAt, excerpt: excerpt(h.story_text ?? '') }]
  })
}

interface GhRepo { full_name: string; html_url: string; description: string | null; created_at: string; stargazers_count: number }

export function parseGitHub(body: string, source: string): RawItem[] {
  const { items } = JSON.parse(body) as { items: GhRepo[] }
  return items.flatMap((r) => {
    const publishedAt = iso(r.created_at)
    if (!publishedAt) return []
    return [{ title: r.full_name, url: r.html_url, source, publishedAt, excerpt: excerpt(`${r.description ?? ''} (★ ${r.stargazers_count})`) }]
  })
}

export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    for (const key of [...u.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_')) u.searchParams.delete(key)
    }
    return u.toString()
  } catch {
    return null
  }
}

export function seenUrls(reports: { items: { url: string }[] }[]): Set<string> {
  return new Set(reports.flatMap((r) => r.items.map((i) => normalizeUrl(i.url) ?? i.url)))
}

export interface CollectOptions {
  now: Date
  seen: Set<string>
  max: number
  days?: number
}

export function collectItems(raw: RawItem[], { now, seen, max, days = 7 }: CollectOptions): RawItem[] {
  const since = now.getTime() - days * DAY
  const until = now.getTime() + DAY
  const byUrl = new Map<string, RawItem>()
  for (const item of raw) {
    const url = normalizeUrl(item.url)
    const t = Date.parse(item.publishedAt)
    if (!url || seen.has(url) || byUrl.has(url) || t < since || t > until) continue
    byUrl.set(url, { ...item, url })
  }
  // Si hay más de `max`, se descartan los más antiguos
  return [...byUrl.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, max)
}
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npx vitest run tests/radar-collect.test.ts && npx tsc --noEmit -p .`
Expected: PASS; `tsc` sin errores.

- [ ] **Step 7: Commit**

```bash
git add scripts/radar/collect.ts tests/fixtures/radar tests/radar-collect.test.ts package.json package-lock.json
git commit -m "feat: parseo y normalización de fuentes del radar"
```

---

### Task 4: Descarga de fuentes y feeds de YouTube

**Files:**
- Create: `scripts/radar/fetch-sources.ts`, `scripts/radar/resolve-feeds.ts`, `tests/fixtures/radar/channel.html`
- Test: `tests/radar-fetch.test.ts`

**Interfaces:**
- Consumes: `RawItem`, `parseFeed`, `parseHackerNews`, `parseGitHub` (Task 3); `Source` (Task 1); `Person`
- Produces:
  - `type FetchFn = typeof fetch`
  - `interface SourceRequest { sourceId: string; kind: 'feed' | 'hackernews' | 'github'; url: string }`
  - `youtubeFeedUrl(channelId: string): string`
  - `buildRequests(sources: Source[], people: Person[], now: Date, extraChannelIds?: Record<string, string>): SourceRequest[]`
  - `fetchText(fetchFn: FetchFn, url: string, options?: { timeoutMs?: number; retries?: number; headers?: Record<string, string> }): Promise<string>`
  - `interface FetchFailure { sourceId: string; url: string; error: string }`
  - `interface FetchResult { items: RawItem[]; failures: FetchFailure[]; sourcesChecked: number }`
  - `fetchAll(requests: SourceRequest[], fetchFn: FetchFn, githubToken?: string): Promise<FetchResult>`
  - `extractChannelId(html: string): string | null`
  - `interface ResolvedFeed { personId: string; channelId: string; youtubeUrl: string }`
  - `resolveMissingFeeds(people: Person[], fetchFn: FetchFn): Promise<{ resolved: ResolvedFeed[]; failures: string[] }>`

- [ ] **Step 1: Crear el fixture**

`tests/fixtures/radar/channel.html`:

```html
<!DOCTYPE html>
<html><head>
<title>Canal - YouTube</title>
<link rel="canonical" href="https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv">
</head><body></body></html>
```

- [ ] **Step 2: Escribir los tests que fallan**

Crear `tests/radar-fetch.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildRequests, fetchAll, fetchText, youtubeFeedUrl, type FetchFn, type SourceRequest } from '@/scripts/radar/fetch-sources'
import { extractChannelId, resolveMissingFeeds } from '@/scripts/radar/resolve-feeds'
import type { Source } from '@/lib/content/schema'
import type { Person } from '@/lib/content/types'

const fixture = (name: string) => fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/radar', name), 'utf8')
const NOW = new Date('2026-10-23T13:00:00Z')

type Call = { url: string; init?: RequestInit }
function fakeFetch(routes: Record<string, string | number>, calls: Call[] = []): FetchFn {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    const hit = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))
    if (!hit) throw new Error(`sin ruta: ${url}`)
    return typeof hit[1] === 'number' ? new Response('error', { status: hit[1] }) : new Response(hit[1])
  }) as FetchFn
}

const person = (id: string, o: Partial<Person> = {}): Person => ({
  id, name: id, kind: 'person', languages: ['en'], topics: ['rag'], audience: ['technical'], level: 'intermediate',
  summary: 's', platforms: { x: `https://x.com/${id}` },
  highlights: [{ title: 'h', url: `https://example.com/${id}`, format: 'video' }],
  verified: false, added: '2026-10-17', why: 'w', ...o,
})

const SOURCES: Source[] = [
  { id: 'blog', name: 'Blog', kind: 'rss', url: 'https://blog.example.com/feed.xml' },
  { id: 'hn', name: 'HN', kind: 'hackernews', minPoints: 200, keywords: ['LLM', 'RAG'] },
  { id: 'gh', name: 'GitHub', kind: 'github', minStars: 300, topics: ['llm'] },
]

describe('buildRequests', () => {
  const reqs = buildRequests(SOURCES, [
    person('p', { feeds: { youtubeChannelId: 'UCx', rss: 'https://p.example.com/rss' } }),
    person('q'),
  ], NOW, { q: 'UCq' })

  it('genera una petición por palabra clave de Hacker News con la ventana y los puntos', () => {
    const hn = reqs.filter((r) => r.sourceId === 'hn')
    expect(hn).toHaveLength(2)
    const since = Math.floor((NOW.getTime() - 7 * 86_400_000) / 1000)
    expect(new URL(hn[0].url).searchParams.get('numericFilters')).toBe(`created_at_i>${since},points>=200`)
    expect(new URL(hn[0].url).searchParams.get('query')).toBe('LLM')
  })
  it('busca en GitHub repos creados en la ventana con estrellas mínimas', () => {
    const gh = reqs.find((r) => r.sourceId === 'gh')!
    expect(new URL(gh.url).searchParams.get('q')).toBe('topic:llm created:>=2026-10-16 stars:>=300')
  })
  it('incluye los feeds de los referentes, también los recién resueltos', () => {
    expect(reqs.filter((r) => r.sourceId === 'p').map((r) => r.url)).toEqual([youtubeFeedUrl('UCx'), 'https://p.example.com/rss'])
    expect(reqs.filter((r) => r.sourceId === 'q').map((r) => r.url)).toEqual([youtubeFeedUrl('UCq')])
  })
})

describe('fetchAll', () => {
  const requests: SourceRequest[] = [
    { sourceId: 'blog', kind: 'feed', url: 'https://blog.example.com/feed.xml' },
    { sourceId: 'hn', kind: 'hackernews', url: 'https://hn.algolia.com/api/v1/search?query=LLM' },
    { sourceId: 'gh', kind: 'github', url: 'https://api.github.com/search/repositories?q=x' },
  ]

  it('una fuente que falla no aborta la ejecución', async () => {
    const res = await fetchAll(requests, fakeFetch({
      'https://blog.example.com': fixture('rss.xml'),
      'https://hn.algolia.com': 500,
      'https://api.github.com': fixture('github.json'),
    }))
    expect(res.items).toHaveLength(3)
    expect(res.failures.map((f) => f.sourceId)).toEqual(['hn'])
    expect(res.failures[0].error).toBe('HTTP 500')
    expect(res.sourcesChecked).toBe(2)
  })
  it('una página HTML en lugar de un feed cuenta como fallo', async () => {
    const res = await fetchAll([requests[0]], fakeFetch({ 'https://blog.example.com': '<html><body>Captcha</body></html>' }))
    expect(res.items).toEqual([])
    expect(res.failures[0].error).toMatch(/no es un feed/)
  })
  it('envía el token a GitHub cuando existe', async () => {
    const calls: Call[] = []
    await fetchAll([requests[2]], fakeFetch({ 'https://api.github.com': fixture('github.json') }, calls), 't0k3n')
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer t0k3n')
  })
})

describe('fetchText', () => {
  it('reintenta una vez antes de fallar', async () => {
    let n = 0
    const flaky = (async () => (++n === 1 ? new Response('', { status: 503 }) : new Response('ok'))) as unknown as FetchFn
    expect(await fetchText(flaky, 'https://e.com')).toBe('ok')
    expect(n).toBe(2)
  })
})

describe('extractChannelId', () => {
  it('lee el ID desde el enlace canónico', () => {
    expect(extractChannelId(fixture('channel.html'))).toBe('UCabcdefghijklmnopqrstuv')
  })
  it('lee el ID desde los datos embebidos', () => {
    expect(extractChannelId('<script>var x = {"externalId":"UC1234567890123456789012"}</script>')).toBe('UC1234567890123456789012')
  })
  it('devuelve null si no lo encuentra', () => {
    expect(extractChannelId('<html></html>')).toBeNull()
  })
})

describe('resolveMissingFeeds', () => {
  it('resuelve solo referentes con YouTube y sin ID, y registra los fallos', async () => {
    const calls: Call[] = []
    const people = [
      person('a', { platforms: { youtube: 'https://www.youtube.com/@a' } }),
      person('b', { platforms: { youtube: 'https://www.youtube.com/@b' }, feeds: { youtubeChannelId: 'UCbbbbbbbbbbbbbbbbbbbbbb' } }),
      person('c'),
      person('d', { platforms: { youtube: 'https://www.youtube.com/@d' } }),
    ]
    const res = await resolveMissingFeeds(people, fakeFetch({ 'https://www.youtube.com/@a': fixture('channel.html'), 'https://www.youtube.com/@d': 404 }, calls))
    expect(res.resolved).toEqual([{ personId: 'a', channelId: 'UCabcdefghijklmnopqrstuv', youtubeUrl: 'https://www.youtube.com/@a' }])
    expect(res.failures).toHaveLength(1)
    expect(res.failures[0]).toMatch(/^d: /)
    expect(calls.some((c) => c.url.includes('@b'))).toBe(false)
  })
})
```

- [ ] **Step 3: Correr los tests y ver que fallan**

Run: `npx vitest run tests/radar-fetch.test.ts`
Expected: FAIL con "Failed to resolve import '@/scripts/radar/fetch-sources'".

- [ ] **Step 4: Implementar `scripts/radar/fetch-sources.ts`**

```ts
import type { Source } from '@/lib/content/schema'
import type { Person } from '@/lib/content/types'
import { parseFeed, parseHackerNews, parseGitHub, type RawItem } from './collect'

export type FetchFn = typeof fetch

export interface SourceRequest {
  sourceId: string
  kind: 'feed' | 'hackernews' | 'github'
  url: string
}

export interface FetchFailure {
  sourceId: string
  url: string
  error: string
}

export interface FetchResult {
  items: RawItem[]
  failures: FetchFailure[]
  sourcesChecked: number
}

const DAY = 86_400_000
const USER_AGENT = 'expia-radar (+https://github.com/serandmoncas/ExpIA)'

export const youtubeFeedUrl = (channelId: string) => `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`

export function buildRequests(sources: Source[], people: Person[], now: Date, extraChannelIds: Record<string, string> = {}): SourceRequest[] {
  const since = new Date(now.getTime() - 7 * DAY)
  const sinceSec = Math.floor(since.getTime() / 1000)
  const sinceDay = since.toISOString().slice(0, 10)
  const out: SourceRequest[] = []
  for (const s of sources) {
    if (s.kind === 'rss') out.push({ sourceId: s.id, kind: 'feed', url: s.url })
    if (s.kind === 'hackernews') {
      for (const query of s.keywords) {
        const qs = new URLSearchParams({ query, tags: 'story', numericFilters: `created_at_i>${sinceSec},points>=${s.minPoints}`, hitsPerPage: '30' })
        out.push({ sourceId: s.id, kind: 'hackernews', url: `https://hn.algolia.com/api/v1/search?${qs}` })
      }
    }
    if (s.kind === 'github') {
      for (const topic of s.topics) {
        const qs = new URLSearchParams({ q: `topic:${topic} created:>=${sinceDay} stars:>=${s.minStars}`, sort: 'stars', order: 'desc', per_page: '20' })
        out.push({ sourceId: s.id, kind: 'github', url: `https://api.github.com/search/repositories?${qs}` })
      }
    }
  }
  for (const p of people) {
    const channelId = p.feeds?.youtubeChannelId ?? extraChannelIds[p.id]
    if (channelId) out.push({ sourceId: p.id, kind: 'feed', url: youtubeFeedUrl(channelId) })
    if (p.feeds?.rss) out.push({ sourceId: p.id, kind: 'feed', url: p.feeds.rss })
  }
  return out
}

export async function fetchText(
  fetchFn: FetchFn,
  url: string,
  { timeoutMs = 10_000, retries = 1, headers = {} }: { timeoutMs?: number; retries?: number; headers?: Record<string, string> } = {},
): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchFn(url, { headers: { 'User-Agent': USER_AGENT, ...headers }, signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (e) {
      lastError = e
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

const PARSERS = { feed: parseFeed, hackernews: parseHackerNews, github: parseGitHub }

export async function fetchAll(requests: SourceRequest[], fetchFn: FetchFn, githubToken?: string): Promise<FetchResult> {
  const results = await Promise.all(
    requests.map(async (r) => {
      try {
        const headers: Record<string, string> = r.kind === 'github'
          ? { Accept: 'application/vnd.github+json', ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}) }
          : {}
        const body = await fetchText(fetchFn, r.url, { headers })
        return { r, items: PARSERS[r.kind](body, r.sourceId) }
      } catch (e) {
        return { r, error: e instanceof Error ? e.message : String(e) }
      }
    }),
  )
  const ok = new Set<string>()
  const out: FetchResult = { items: [], failures: [], sourcesChecked: 0 }
  for (const res of results) {
    if ('error' in res) out.failures.push({ sourceId: res.r.sourceId, url: res.r.url, error: res.error })
    else {
      ok.add(res.r.sourceId)
      out.items.push(...res.items)
    }
  }
  out.sourcesChecked = ok.size
  return out
}
```

- [ ] **Step 5: Implementar `scripts/radar/resolve-feeds.ts`**

```ts
import type { Person } from '@/lib/content/types'
import { fetchText, type FetchFn } from './fetch-sources'

export function extractChannelId(html: string): string | null {
  const m =
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/.exec(html) ??
    /"(?:externalId|channelId)":"(UC[\w-]{22})"/.exec(html)
  return m ? m[1] : null
}

export interface ResolvedFeed {
  personId: string
  channelId: string
  youtubeUrl: string
}

export async function resolveMissingFeeds(people: Person[], fetchFn: FetchFn): Promise<{ resolved: ResolvedFeed[]; failures: string[] }> {
  const resolved: ResolvedFeed[] = []
  const failures: string[] = []
  // En serie para no disparar los límites de YouTube
  for (const p of people) {
    const youtubeUrl = p.platforms.youtube
    if (!youtubeUrl || p.feeds?.youtubeChannelId) continue
    try {
      const channelId = extractChannelId(await fetchText(fetchFn, youtubeUrl, { headers: { 'Accept-Language': 'en' } }))
      if (channelId) resolved.push({ personId: p.id, channelId, youtubeUrl })
      else failures.push(`${p.id}: no se encontró el ID del canal`)
    } catch (e) {
      failures.push(`${p.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { resolved, failures }
}
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npx vitest run tests/radar-fetch.test.ts && npx tsc --noEmit -p .`
Expected: PASS; `tsc` sin errores.

- [ ] **Step 7: Commit**

```bash
git add scripts/radar/fetch-sources.ts scripts/radar/resolve-feeds.ts tests/fixtures/radar/channel.html tests/radar-fetch.test.ts
git commit -m "feat: descarga de fuentes con reintento y resolución de canales de YouTube"
```

---

### Task 5: Llamada al modelo (`judge.ts`)

**Files:**
- Create: `scripts/radar/judge.ts`
- Modify: `package.json` (dependencia `@anthropic-ai/sdk`)
- Test: `tests/radar-judge.test.ts`

**Interfaces:**
- Consumes: `RawItem` (Task 3); `KINDS`, `AUDIENCES`, `LEVELS`, `STATUSES`, `HIGHLIGHT_FORMATS`, `RELEVANCES` (Task 1)
- Produces:
  - `MODEL = 'claude-opus-5-5'`, `FALLBACK_BETA = 'server-side-fallback-2026-07-01'`
  - `judgementSchema` (zod/v4) y `type Judgement = { summary: string; items: { url; topics: string[]; relevance; summary }[]; statusChanges: { nodeId; to: Status; reason; evidence: string[] }[]; newNodes: { id; title; kind; category; released; audience; level; requires; related; status: 'emerging' | 'rising'; summary; purpose; usage; nonTechnical; reason; evidence }[]; highlights: { personId; url; format; topic?; reason }[] }`
  - `EMPTY_JUDGEMENT: Judgement`
  - `interface JudgeInput { items: RawItem[]; nodes: { id; title; status; level; summary }[]; people: { id; name; topics: string[]; highlightCount: number }[]; categories: { id; label }[] }`
  - `type JudgeClient = { beta: { messages: Pick<Anthropic['beta']['messages'], 'parse'> } }`
  - `class JudgeError extends Error`
  - `SYSTEM_PROMPT: string`, `buildUserMessage(input: JudgeInput): string`
  - `judge(client: JudgeClient, input: JudgeInput): Promise<Judgement>`

- [ ] **Step 1: Instalar el SDK**

Run: `npm install @anthropic-ai/sdk@^0.135.0`
Expected: `package.json` gana `"@anthropic-ai/sdk"` en `dependencies`.

- [ ] **Step 2: Escribir los tests que fallan**

Crear `tests/radar-judge.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { judge, judgementSchema, EMPTY_JUDGEMENT, JudgeError, MODEL, FALLBACK_BETA, type Judgement, type JudgeClient, type JudgeInput } from '@/scripts/radar/judge'

const INPUT: JudgeInput = {
  items: [{ title: 'Nuevo', url: 'https://blog.example.com/nuevo', source: 'blog', publishedAt: '2026-10-21T00:00:00.000Z', excerpt: 'x' }],
  nodes: [{ id: 'mcp', title: 'MCP', status: 'emerging', level: 'intermediate', summary: 'Protocolo' }],
  people: [{ id: 'p', name: 'P', topics: ['mcp'], highlightCount: 2 }],
  categories: [{ id: 'llm-apps', label: 'Apps' }],
}
const RESULT: Judgement = { ...EMPTY_JUDGEMENT, summary: 'Semana tranquila.' }

function fakeClient(response: { stop_reason: string; parsed_output: Judgement | null }) {
  const calls: Record<string, unknown>[] = []
  const client = {
    beta: { messages: { parse: async (params: Record<string, unknown>) => { calls.push(params); return response } } },
  } as unknown as JudgeClient
  return { client, calls }
}

describe('judgementSchema', () => {
  it('funciona con el helper de salida estructurada del SDK (zod v4)', () => {
    expect(betaZodOutputFormat(judgementSchema).parse(JSON.stringify(RESULT))).toEqual(RESULT)
  })
})

describe('judge', () => {
  it('pide salida estructurada al modelo correcto, con esfuerzo medio y respaldo ante rechazos', async () => {
    const { client, calls } = fakeClient({ stop_reason: 'end_turn', parsed_output: RESULT })
    expect(await judge(client, INPUT)).toEqual(RESULT)
    const params = calls[0] as { model: string; betas: string[]; fallbacks: string; output_config: { effort: string; format: { type: string } }; messages: { content: string }[] }
    expect(params.model).toBe(MODEL)
    expect(params.betas).toContain(FALLBACK_BETA)
    expect(params.fallbacks).toBe('default')
    expect(params.output_config.effort).toBe('medium')
    expect(params.output_config.format.type).toBe('json_schema')
    expect(params.messages[0].content).toContain('https://blog.example.com/nuevo')
  })
  it('falla si toda la cadena rechaza la petición', async () => {
    const { client } = fakeClient({ stop_reason: 'refusal', parsed_output: null })
    await expect(judge(client, INPUT)).rejects.toThrow(JudgeError)
    await expect(judge(client, INPUT)).rejects.toThrow(/refusal/)
  })
  it('falla si la respuesta se corta por max_tokens', async () => {
    const { client } = fakeClient({ stop_reason: 'max_tokens', parsed_output: null })
    await expect(judge(client, INPUT)).rejects.toThrow(/max_tokens/)
  })
  it('falla si la respuesta no cumple el esquema', async () => {
    const { client } = fakeClient({ stop_reason: 'end_turn', parsed_output: null })
    await expect(judge(client, INPUT)).rejects.toThrow(/esquema/)
  })
})
```

- [ ] **Step 3: Correr los tests y ver que fallan**

Run: `npx vitest run tests/radar-judge.test.ts`
Expected: FAIL con "Failed to resolve import '@/scripts/radar/judge'".

- [ ] **Step 4: Implementar `scripts/radar/judge.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
// El helper del SDK solo acepta esquemas de zod 4; zod 3.25 los incluye en la subruta zod/v4
import { z } from 'zod/v4'
import { KINDS, AUDIENCES, LEVELS, STATUSES, HIGHLIGHT_FORMATS, RELEVANCES } from '@/lib/content/enums'
import type { RawItem } from './collect'

export const MODEL = 'claude-opus-5-5'
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

export const judgementSchema = z.object({
  summary: z.string(),
  items: z.array(z.object({
    url: z.string(),
    topics: z.array(z.string()),
    relevance: z.enum(RELEVANCES),
    summary: z.string(),
  })),
  statusChanges: z.array(z.object({
    nodeId: z.string(),
    to: z.enum(STATUSES),
    reason: z.string(),
    evidence: z.array(z.string()),
  })),
  newNodes: z.array(z.object({
    id: z.string(),
    title: z.string(),
    kind: z.enum(KINDS),
    category: z.array(z.string()),
    released: z.string(),
    audience: z.array(z.enum(AUDIENCES)),
    level: z.enum(LEVELS),
    requires: z.array(z.string()),
    related: z.array(z.string()),
    status: z.enum(['emerging', 'rising']),
    summary: z.string(),
    purpose: z.string(),
    usage: z.string(),
    nonTechnical: z.string(),
    reason: z.string(),
    evidence: z.array(z.string()),
  })),
  highlights: z.array(z.object({
    personId: z.string(),
    url: z.string(),
    format: z.enum(HIGHLIGHT_FORMATS),
    topic: z.string().optional(),
    reason: z.string(),
  })),
})

export type Judgement = z.infer<typeof judgementSchema>

export const EMPTY_JUDGEMENT: Judgement = { summary: '', items: [], statusChanges: [], newNodes: [], highlights: [] }

export interface JudgeInput {
  items: RawItem[]
  nodes: { id: string; title: string; status: string; level: string; summary: string }[]
  people: { id: string; name: string; topics: string[]; highlightCount: number }[]
  categories: { id: string; label: string }[]
}

export type JudgeClient = { beta: { messages: Pick<Anthropic['beta']['messages'], 'parse'> } }

export class JudgeError extends Error {
  name = 'JudgeError'
}

export const SYSTEM_PROMPT = `Eres el editor del radar semanal de ExpIA, un sitio en español para aprender inteligencia artificial. Su público incluye perfiles técnicos, personas no técnicas y estudiantes.

Recibes el catálogo actual (nodos con su estado), los referentes y los ítems publicados en los últimos 7 días por fuentes curadas. Devuelve:

1. items: hasta 15 ítems realmente relevantes para alguien que aprende o trabaja con IA. Para cada uno: los temas del catálogo que toca (IDs existentes), la relevancia (high: cambia cómo se trabaja o se entiende un tema; medium: vale la pena conocerlo) y un resumen en español neutro de máximo 280 caracteres que explique por qué importa.
2. summary: el resumen de la semana en Markdown, de 1 a 3 párrafos, en español, sin títulos.
3. statusChanges: cambios de estado de nodos existentes, solo cuando la evidencia de esta semana lo justifique. Los estados, en orden, son emerging (recién aparece), rising (adopción creciente), mainstream (uso establecido) y declining (perdiendo uso). Solo se puede mover un paso.
4. newNodes: conceptos o herramientas significativos que aún no están en el catálogo (máximo 3). Escribe en español las tres secciones: purpose (para qué sirve), usage (cómo se usa) y nonTechnical (explicación para no técnicos), cada una de 1 a 3 párrafos en Markdown sin títulos. category, requires y related solo con IDs existentes; released en formato YYYY-MM; status emerging o rising; summary de máximo 160 caracteres; id en kebab-case.
5. highlights: recursos destacados para un referente (máximo 5), solo con ítems cuya fuente (source) es ese referente.

Reglas:
- Usa solo URLs que aparezcan en la lista de ítems. Cualquier otra URL se descarta.
- Cada propuesta necesita evidencia: URLs de ítems de esta semana.
- Prefiere no proponer a proponer con poca evidencia. Una semana sin cambios es un resultado válido.
- Ignora ofertas de empleo, contenido promocional sin sustancia y noticias sin relación con la IA.`

export function buildUserMessage(input: JudgeInput): string {
  return [
    '## Categorías', JSON.stringify(input.categories),
    '## Nodos del catálogo', JSON.stringify(input.nodes),
    '## Referentes', JSON.stringify(input.people),
    `## Ítems de los últimos 7 días (${input.items.length})`, JSON.stringify(input.items),
  ].join('\n\n')
}

export async function judge(client: JudgeClient, input: JudgeInput): Promise<Judgement> {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(input) }],
    output_config: { effort: 'medium', format: betaZodOutputFormat(judgementSchema) },
  })
  if (response.stop_reason === 'refusal') throw new JudgeError('El modelo rechazó la petición (stop_reason: refusal)')
  if (response.stop_reason === 'max_tokens') throw new JudgeError('La respuesta se cortó por max_tokens')
  if (!response.parsed_output) throw new JudgeError('La respuesta no cumple el esquema')
  return response.parsed_output
}
```

Si `tsc` rechaza algún campo del objeto de parámetros (por ejemplo `fallbacks` o `effort` dentro de `output_config`), revisar los tipos en `node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts` (`BetaFallbacksParam`, `BetaOutputConfig`) y ajustar el nombre exacto; no castear a `any`.

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx vitest run tests/radar-judge.test.ts && npx tsc --noEmit -p .`
Expected: PASS; `tsc` sin errores.

- [ ] **Step 6: Commit**

```bash
git add scripts/radar/judge.ts tests/radar-judge.test.ts package.json package-lock.json
git commit -m "feat: juicio del radar con Claude y salida estructurada"
```

---

### Task 6: Validación (`validate.ts`)

**Files:**
- Create: `scripts/radar/validate.ts`
- Test: `tests/radar-validate.test.ts`

**Interfaces:**
- Consumes: `Judgement`, `EMPTY_JUDGEMENT` (Task 5); `RawItem`, `normalizeUrl` (Task 3); `isAdjacentStatus` (Task 2); `nodeFrontmatterSchema`, `NodeFrontmatter`, `ReportItem` (Task 1)
- Produces:
  - `LIMITS = { items: 15, statusChanges: 5, newNodes: 3, highlights: 5 }`
  - `interface ValidationContext { items: RawItem[]; nodes: { id: string; status: Status }[]; people: Person[]; categoryIds: string[]; today: string }`
  - `interface StatusChange { nodeId: string; from: Status; to: Status; reason: string; evidence: string[] }`
  - `interface NewNode { front: NodeFrontmatter; sections: { purpose: string; usage: string; nonTechnical: string }; reason: string; evidence: string[] }`
  - `interface HighlightProposal { personId: string; highlight: Highlight; reason: string; evidence: string[] }`
  - `interface ValidatedJudgement { summary: string; items: ReportItem[]; statusChanges: StatusChange[]; newNodes: NewNode[]; highlights: HighlightProposal[]; discarded: string[] }`
  - `validateJudgement(j: Judgement, ctx: ValidationContext): ValidatedJudgement`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/radar-validate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateJudgement, type ValidationContext } from '@/scripts/radar/validate'
import { EMPTY_JUDGEMENT, type Judgement } from '@/scripts/radar/judge'
import type { RawItem } from '@/scripts/radar/collect'
import type { Person } from '@/lib/content/types'

type NewNodeIn = Judgement['newNodes'][number]
const raw = (url: string, source = 'blog'): RawItem => ({ title: `Título ${url}`, url, source, publishedAt: '2026-10-21T10:00:00.000Z', excerpt: '' })
const person = (id: string, highlightCount: number): Person => ({
  id, name: id, kind: 'person', languages: ['en'], topics: ['rag'], audience: ['technical'], level: 'intermediate',
  summary: 's', platforms: { youtube: `https://www.youtube.com/@${id}` },
  highlights: Array.from({ length: highlightCount }, (_, i) => ({ title: `h${i}`, url: `https://example.com/${id}/${i}`, format: 'video' as const })),
  verified: false, added: '2026-10-17', why: 'w',
})
const ctx = (o: Partial<ValidationContext> = {}): ValidationContext => ({
  items: [raw('https://a.com/1'), raw('https://a.com/2'), raw('https://www.youtube.com/watch?v=p1', 'p'), raw('https://www.youtube.com/watch?v=p2', 'p')],
  nodes: [{ id: 'rag', status: 'mainstream' }, { id: 'mcp', status: 'emerging' }],
  people: [person('p', 4)],
  categoryIds: ['llm-apps'],
  today: '2026-10-23',
  ...o,
})
const j = (o: Partial<Judgement> = {}): Judgement => ({ ...EMPTY_JUDGEMENT, summary: 'Semana movida.', ...o })
const it1 = (url: string, o: Partial<Judgement['items'][number]> = {}) => ({ url, topics: ['rag'], relevance: 'high' as const, summary: 'Importa.', ...o })
const newNode = (id: string, o: Partial<NewNodeIn> = {}): NewNodeIn => ({
  id, title: 'Nuevo', kind: 'concept', category: ['llm-apps'], released: '2026-10', audience: ['technical'], level: 'intermediate',
  requires: ['rag'], related: [], status: 'emerging', summary: 'Algo nuevo.', purpose: 'P', usage: 'U', nonTechnical: 'N',
  reason: 'r', evidence: ['https://a.com/1'], ...o,
})

describe('validateJudgement: ítems', () => {
  it('acepta un ítem válido y toma título, fuente y fecha de la entrada', () => {
    const v = validateJudgement(j({ items: [it1('https://a.com/1')] }), ctx())
    expect(v.items).toEqual([{ title: 'Título https://a.com/1', url: 'https://a.com/1', source: 'blog', publishedAt: '2026-10-21', topics: ['rag'], relevance: 'high', summary: 'Importa.' }])
    expect(v.summary).toBe('Semana movida.')
    expect(v.discarded).toEqual([])
  })
  it('descarta una URL que no venía en la entrada', () => {
    const v = validateJudgement(j({ items: [it1('https://inventada.com/x')] }), ctx())
    expect(v.items).toEqual([])
    expect(v.discarded).toEqual(['ítem https://inventada.com/x — URL no incluida en la entrada'])
  })
  it('acepta la URL del modelo con parámetros de seguimiento', () => {
    expect(validateJudgement(j({ items: [it1('https://a.com/1?utm_source=x')] }), ctx()).items[0].url).toBe('https://a.com/1')
  })
  it('descarta temas inexistentes y resúmenes de más de 280 caracteres', () => {
    const v = validateJudgement(j({ items: [it1('https://a.com/1', { topics: ['zzz'] }), it1('https://a.com/2', { summary: 'x'.repeat(281) })] }), ctx())
    expect(v.items).toEqual([])
    expect(v.discarded).toHaveLength(2)
  })
  it('corta en 15 ítems', () => {
    const items = Array.from({ length: 16 }, (_, n) => raw(`https://a.com/n${n}`))
    const v = validateJudgement(j({ items: items.map((i) => it1(i.url)) }), ctx({ items }))
    expect(v.items).toHaveLength(15)
    expect(v.discarded).toHaveLength(1)
  })
})

describe('validateJudgement: cambios de estado', () => {
  it('acepta un paso adyacente y completa el estado actual', () => {
    const v = validateJudgement(j({ statusChanges: [{ nodeId: 'mcp', to: 'rising', reason: 'r', evidence: ['https://a.com/1'] }] }), ctx())
    expect(v.statusChanges).toEqual([{ nodeId: 'mcp', from: 'emerging', to: 'rising', reason: 'r', evidence: ['https://a.com/1'] }])
  })
  it('descarta saltos de dos pasos', () => {
    const v = validateJudgement(j({ statusChanges: [{ nodeId: 'rag', to: 'emerging', reason: 'r', evidence: ['https://a.com/1'] }] }), ctx())
    expect(v.statusChanges).toEqual([])
    expect(v.discarded[0]).toMatch(/no es un paso adyacente/)
  })
  it('descarta evidencia fuera de la entrada', () => {
    const v = validateJudgement(j({ statusChanges: [{ nodeId: 'mcp', to: 'rising', reason: 'r', evidence: ['https://otra.com'] }] }), ctx())
    expect(v.statusChanges).toEqual([])
    expect(v.discarded[0]).toMatch(/evidencia fuera de la entrada/)
  })
})

describe('validateJudgement: nodos nuevos', () => {
  it('acepta un nodo válido sin verificar y con la fecha de hoy', () => {
    const v = validateJudgement(j({ newNodes: [newNode('nuevo')] }), ctx())
    expect(v.newNodes).toHaveLength(1)
    expect(v.newNodes[0].front).toMatchObject({ id: 'nuevo', verified: false, added: '2026-10-23', requires: ['rag'] })
    expect(v.newNodes[0].sections).toEqual({ purpose: 'P', usage: 'U', nonTechnical: 'N' })
  })
  it('descarta ids existentes, referencias y categorías inexistentes', () => {
    const v = validateJudgement(j({ newNodes: [newNode('rag'), newNode('a', { requires: ['zzz'] }), newNode('b', { category: ['nope'] })] }), ctx())
    expect(v.newNodes).toEqual([])
    expect(v.discarded).toHaveLength(3)
  })
  it('descarta un frontmatter inválido (summary largo)', () => {
    const v = validateJudgement(j({ newNodes: [newNode('largo', { summary: 'x'.repeat(161) })] }), ctx())
    expect(v.newNodes).toEqual([])
    expect(v.discarded[0]).toMatch(/summary/)
  })
  it('corta en 3 nodos nuevos', () => {
    const v = validateJudgement(j({ newNodes: ['n1', 'n2', 'n3', 'n4'].map((id) => newNode(id)) }), ctx())
    expect(v.newNodes).toHaveLength(3)
  })
})

describe('validateJudgement: recursos destacados', () => {
  it('acepta un ítem del propio referente', () => {
    const v = validateJudgement(j({ highlights: [{ personId: 'p', url: 'https://www.youtube.com/watch?v=p1', format: 'video', topic: 'rag', reason: 'r' }] }), ctx())
    expect(v.highlights).toEqual([{
      personId: 'p',
      highlight: { title: 'Título https://www.youtube.com/watch?v=p1', url: 'https://www.youtube.com/watch?v=p1', format: 'video', topic: 'rag' },
      reason: 'r',
      evidence: ['https://www.youtube.com/watch?v=p1'],
    }])
  })
  it('descarta ítems que no son del referente', () => {
    const v = validateJudgement(j({ highlights: [{ personId: 'p', url: 'https://a.com/1', format: 'article', reason: 'r' }] }), ctx())
    expect(v.highlights).toEqual([])
    expect(v.discarded[0]).toMatch(/no es de este referente/)
  })
  it('no pasa de 5 recursos por referente', () => {
    const v = validateJudgement(j({ highlights: [
      { personId: 'p', url: 'https://www.youtube.com/watch?v=p1', format: 'video', reason: 'r' },
      { personId: 'p', url: 'https://www.youtube.com/watch?v=p2', format: 'video', reason: 'r' },
    ] }), ctx())
    expect(v.highlights).toHaveLength(1)
    expect(v.discarded[0]).toMatch(/ya tiene 5 recursos/)
  })
})
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `npx vitest run tests/radar-validate.test.ts`
Expected: FAIL con "Failed to resolve import '@/scripts/radar/validate'".

- [ ] **Step 3: Implementar `scripts/radar/validate.ts`**

```ts
import { nodeFrontmatterSchema, type NodeFrontmatter, type ReportItem } from '@/lib/content/schema'
import type { Status } from '@/lib/content/enums'
import type { Highlight, Person } from '@/lib/content/types'
import { isAdjacentStatus } from '@/lib/radar'
import { normalizeUrl, type RawItem } from './collect'
import type { Judgement } from './judge'

export const LIMITS = { items: 15, statusChanges: 5, newNodes: 3, highlights: 5 } as const
const MAX_HIGHLIGHTS = 5

export interface ValidationContext {
  items: RawItem[]
  nodes: { id: string; status: Status }[]
  people: Person[]
  categoryIds: string[]
  today: string
}

export interface StatusChange { nodeId: string; from: Status; to: Status; reason: string; evidence: string[] }
export interface NewNode { front: NodeFrontmatter; sections: { purpose: string; usage: string; nonTechnical: string }; reason: string; evidence: string[] }
export interface HighlightProposal { personId: string; highlight: Highlight; reason: string; evidence: string[] }

export interface ValidatedJudgement {
  summary: string
  items: ReportItem[]
  statusChanges: StatusChange[]
  newNodes: NewNode[]
  highlights: HighlightProposal[]
  discarded: string[]
}

// Descarta (nunca corrige) todo lo que el modelo no pueda respaldar con la entrada
export function validateJudgement(j: Judgement, ctx: ValidationContext): ValidatedJudgement {
  const inputByUrl = new Map(ctx.items.map((i) => [i.url, i]))
  const find = (url: string) => inputByUrl.get(normalizeUrl(url) ?? url)
  const nodeStatus = new Map(ctx.nodes.map((n) => [n.id, n.status]))
  const peopleById = new Map(ctx.people.map((p) => [p.id, p]))
  const categories = new Set(ctx.categoryIds)
  const discarded: string[] = []
  const reject = (what: string, why: string) => discarded.push(`${what} — ${why}`)
  const evidenceProblem = (ev: string[]): string | null => {
    if (ev.length === 0) return 'sin evidencia'
    const missing = ev.find((u) => !find(u))
    return missing ? `evidencia fuera de la entrada: ${missing}` : null
  }
  const resolveEvidence = (ev: string[]) => [...new Set(ev.map((u) => find(u)!.url))]

  const items: ReportItem[] = []
  for (const it of j.items) {
    const label = `ítem ${it.url}`
    const src = find(it.url)
    if (!src) { reject(label, 'URL no incluida en la entrada'); continue }
    if (items.some((x) => x.url === src.url)) { reject(label, 'duplicado'); continue }
    const unknown = it.topics.filter((t) => !nodeStatus.has(t))
    if (it.topics.length === 0) { reject(label, 'sin temas'); continue }
    if (unknown.length) { reject(label, `temas inexistentes: ${unknown.join(', ')}`); continue }
    const summary = it.summary.trim()
    if (!summary || summary.length > 280) { reject(label, 'resumen vacío o de más de 280 caracteres'); continue }
    if (items.length >= LIMITS.items) { reject(label, `supera el tope de ${LIMITS.items}`); continue }
    items.push({
      title: src.title, url: src.url, source: src.source, publishedAt: src.publishedAt.slice(0, 10),
      topics: [...new Set(it.topics)], relevance: it.relevance, summary,
    })
  }

  const statusChanges: StatusChange[] = []
  for (const c of j.statusChanges) {
    const label = `estado de ${c.nodeId}`
    const from = nodeStatus.get(c.nodeId)
    if (!from) { reject(label, 'el nodo no existe'); continue }
    if (!isAdjacentStatus(from, c.to)) { reject(label, `${from} → ${c.to} no es un paso adyacente`); continue }
    const problem = evidenceProblem(c.evidence)
    if (problem) { reject(label, problem); continue }
    if (statusChanges.some((s) => s.nodeId === c.nodeId)) { reject(label, 'duplicado'); continue }
    if (statusChanges.length >= LIMITS.statusChanges) { reject(label, `supera el tope de ${LIMITS.statusChanges}`); continue }
    statusChanges.push({ nodeId: c.nodeId, from, to: c.to, reason: c.reason, evidence: resolveEvidence(c.evidence) })
  }

  const newNodes: NewNode[] = []
  for (const n of j.newNodes) {
    const label = `nodo nuevo ${n.id}`
    if (nodeStatus.has(n.id) || newNodes.some((x) => x.front.id === n.id)) { reject(label, 'el id ya existe'); continue }
    const badRefs = [...n.requires, ...n.related].filter((r) => !nodeStatus.has(r))
    if (badRefs.length) { reject(label, `referencias inexistentes: ${badRefs.join(', ')}`); continue }
    const badCats = n.category.filter((c) => !categories.has(c))
    if (badCats.length) { reject(label, `categorías inexistentes: ${badCats.join(', ')}`); continue }
    const problem = evidenceProblem(n.evidence)
    if (problem) { reject(label, problem); continue }
    if (![n.purpose, n.usage, n.nonTechnical].every((s) => s.trim())) { reject(label, 'falta el texto de alguna sección'); continue }
    const parsed = nodeFrontmatterSchema.safeParse({
      id: n.id, title: n.title, kind: n.kind, category: n.category, released: n.released, audience: n.audience,
      level: n.level, requires: n.requires, related: n.related, status: n.status, summary: n.summary,
      verified: false, added: ctx.today,
    })
    if (!parsed.success) { reject(label, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')); continue }
    if (newNodes.length >= LIMITS.newNodes) { reject(label, `supera el tope de ${LIMITS.newNodes}`); continue }
    newNodes.push({
      front: parsed.data,
      sections: { purpose: n.purpose.trim(), usage: n.usage.trim(), nonTechnical: n.nonTechnical.trim() },
      reason: n.reason,
      evidence: resolveEvidence(n.evidence),
    })
  }

  const highlights: HighlightProposal[] = []
  for (const h of j.highlights) {
    const label = `recurso para ${h.personId}`
    const person = peopleById.get(h.personId)
    const src = find(h.url)
    if (!person) { reject(label, 'el referente no existe'); continue }
    if (!src) { reject(label, 'URL no incluida en la entrada'); continue }
    if (src.source !== person.id) { reject(label, 'el ítem no es de este referente'); continue }
    const already = person.highlights.some((x) => (normalizeUrl(x.url) ?? x.url) === src.url) || highlights.some((x) => x.highlight.url === src.url)
    if (already) { reject(label, 'el recurso ya existe'); continue }
    if (h.topic && !nodeStatus.has(h.topic)) { reject(label, `tema inexistente: ${h.topic}`); continue }
    const pending = highlights.filter((x) => x.personId === person.id).length
    if (person.highlights.length + pending >= MAX_HIGHLIGHTS) { reject(label, `el referente ya tiene ${MAX_HIGHLIGHTS} recursos`); continue }
    if (highlights.length >= LIMITS.highlights) { reject(label, `supera el tope de ${LIMITS.highlights}`); continue }
    highlights.push({
      personId: person.id,
      highlight: { title: src.title, url: src.url, format: h.format, ...(h.topic ? { topic: h.topic } : {}) },
      reason: h.reason,
      evidence: [src.url],
    })
  }

  return { summary: j.summary.trim(), items, statusChanges, newNodes, highlights, discarded }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run tests/radar-validate.test.ts && npx tsc --noEmit -p .`
Expected: PASS; `tsc` sin errores.

- [ ] **Step 5: Commit**

```bash
git add scripts/radar/validate.ts tests/radar-validate.test.ts
git commit -m "feat: validación anti-invención y topes de las propuestas del radar"
```

---

### Task 7: Aplicación de propuestas e informe (`apply.ts`)

**Files:**
- Create: `scripts/radar/apply.ts`, `tests/helpers/radar-content.ts`
- Test: `tests/radar-apply.test.ts`

**Interfaces:**
- Consumes: `StatusChange`, `NewNode`, `HighlightProposal` (Task 6); `ResolvedFeed` (Task 4); `RadarFrontmatter`, `nodeFrontmatterSchema` (Task 1); `loadCatalog`
- Produces:
  - `interface Proposals { statusChanges: StatusChange[]; newNodes: NewNode[]; highlights: HighlightProposal[]; feeds: ResolvedFeed[] }`
  - `setStatus(text: string, to: Status): string`
  - `renderNewNode(node: NewNode): string`
  - `addHighlight(text: string, h: Highlight): string` (lanza si `highlights` no está en formato de bloque)
  - `setYoutubeChannelId(text: string, channelId: string): string`
  - `renderReport(report: RadarFrontmatter, summary: string): string`
  - `applyProposals(contentDir: string, proposals: Proposals): { changed: string[]; skipped: string[]; applied: Proposals }`
  - `writeReport(contentDir: string, report: RadarFrontmatter, summary: string): string` (ruta relativa escrita)
  - En `tests/helpers/radar-content.ts`: `TAXONOMY`, `NODE`, `PERSON`, `SOURCES`, `makeDir(files: Record<string, string>): string`

- [ ] **Step 1: Crear el helper de contenido de prueba**

`tests/helpers/radar-content.ts`:

```ts
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const TAXONOMY = 'categories:\n  - { id: llm-apps, label: Apps, color: "#3366ff" }\n'

export const NODE = `---
id: mcp
title: "MCP"
kind: protocol
category: [llm-apps]
released: 2024-11
audience: [technical]
level: intermediate
requires: []
related: []
status: emerging
summary: "Protocolo para conectar modelos con herramientas."
verified: false
added: 2026-10-17
---

## Para qué sirve

A

## Cómo se usa

status: esta línea es del cuerpo, no del frontmatter

## Para no técnicos

C
`

export const PERSON = `---
id: p
name: "P"
kind: person
languages: [en]
topics: [mcp]
audience: [technical]
level: intermediate
summary: "Explica MCP."
platforms:
  youtube: https://www.youtube.com/@p
highlights:
  - title: "Uno"
    url: https://example.com/1
    format: video
verified: false
added: 2026-10-17
---

## Por qué seguirle

Porque sí.
`

export const SOURCES = 'sources:\n  - { id: blog, name: Blog, kind: rss, url: "https://blog.example.com/feed.xml" }\n'

export function makeDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expia-radar-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  return dir
}

export const BASE_FILES = {
  'taxonomy.yaml': TAXONOMY,
  'nodes/mcp.mdx': NODE,
  'nodes/rag.mdx': NODE.replace('id: mcp', 'id: rag').replace('title: "MCP"', 'title: "RAG"').replace('status: emerging', 'status: mainstream'),
  'people/p.mdx': PERSON,
  'sources.yaml': SOURCES,
}
```

- [ ] **Step 2: Escribir los tests que fallan**

Crear `tests/radar-apply.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { setStatus, renderNewNode, addHighlight, setYoutubeChannelId, applyProposals, writeReport, type Proposals } from '@/scripts/radar/apply'
import type { NewNode } from '@/scripts/radar/validate'
import { nodeFrontmatterSchema, type RadarFrontmatter } from '@/lib/content/schema'
import { loadCatalog } from '@/lib/content/load'
import { NODE, PERSON, BASE_FILES, makeDir } from './helpers/radar-content'

const HL = { title: 'Video: "nuevo"', url: 'https://www.youtube.com/watch?v=abc123', format: 'video' as const, topic: 'mcp' }
const NEW_NODE: NewNode = {
  front: nodeFrontmatterSchema.parse({
    id: 'agentes-locales', title: 'Agentes locales', kind: 'concept', category: ['llm-apps'], released: '2026-10',
    audience: ['technical'], level: 'intermediate', requires: ['mcp'], related: [], status: 'emerging',
    summary: 'Agentes que corren en tu máquina.', verified: false, added: '2026-10-23',
  }),
  sections: { purpose: 'Sirve para algo.', usage: 'Se usa así.', nonTechnical: 'Es como un asistente.' },
  reason: 'Aparece en varias fuentes',
  evidence: ['https://blog.example.com/nuevo-modelo'],
}
const PROPOSALS: Proposals = {
  statusChanges: [{ nodeId: 'mcp', from: 'emerging', to: 'rising', reason: 'r', evidence: ['https://blog.example.com/nuevo-modelo'] }],
  newNodes: [NEW_NODE],
  highlights: [{ personId: 'p', highlight: HL, reason: 'r', evidence: [HL.url] }],
  feeds: [{ personId: 'p', channelId: 'UCabcdefghijklmnopqrstuv', youtubeUrl: 'https://www.youtube.com/@p' }],
}
const REPORT: RadarFrontmatter = {
  week: '2026-10-23', from: '2026-10-16', sourcesChecked: 2,
  items: [{ title: 'Nuevo modelo & agentes', url: 'https://blog.example.com/nuevo-modelo', source: 'blog', publishedAt: '2026-10-20', topics: ['mcp'], relevance: 'high', summary: 'Un modelo: "nuevo".' }],
  proposals: [{ type: 'status', target: 'mcp', from: 'emerging', to: 'rising', reason: 'r', evidence: ['https://blog.example.com/nuevo-modelo'] }],
  generated: { by: 'radar-agent', model: 'claude-opus-5-5', at: '2026-10-23T13:00:00.000Z' },
}

describe('setStatus', () => {
  it('cambia solo la línea status del frontmatter', () => {
    expect(setStatus(NODE, 'rising')).toBe(NODE.replace('status: emerging', 'status: rising'))
  })
})

describe('addHighlight', () => {
  it('agrega el recurso al final del bloque y el archivo sigue siendo válido', () => {
    const dir = makeDir({ ...BASE_FILES, 'people/p.mdx': addHighlight(PERSON, HL) })
    expect(loadCatalog(dir).peopleById.get('p')!.highlights).toEqual([
      { title: 'Uno', url: 'https://example.com/1', format: 'video' },
      HL,
    ])
  })
  it('es idempotente', () => {
    expect(addHighlight(addHighlight(PERSON, HL), HL)).toBe(addHighlight(PERSON, HL))
  })
  it('falla con highlights en formato de lista en línea', () => {
    const inline = PERSON.replace(/highlights:\n(?: {2}.*\n)+/, 'highlights: [{ title: "Uno", url: "https://example.com/1", format: video }]\n')
    expect(() => addHighlight(inline, HL)).toThrow(/highlights/)
  })
})

describe('setYoutubeChannelId', () => {
  it('crea el bloque feeds antes de verified y es idempotente', () => {
    const once = setYoutubeChannelId(PERSON, 'UCabcdefghijklmnopqrstuv')
    expect(setYoutubeChannelId(once, 'UCabcdefghijklmnopqrstuv')).toBe(once)
    const dir = makeDir({ ...BASE_FILES, 'people/p.mdx': once })
    expect(loadCatalog(dir).peopleById.get('p')!.feeds).toEqual({ youtubeChannelId: 'UCabcdefghijklmnopqrstuv' })
  })
  it('completa un bloque feeds existente', () => {
    const withRss = PERSON.replace('verified: false', 'feeds:\n  rss: https://p.example.com/rss\nverified: false')
    const dir = makeDir({ ...BASE_FILES, 'people/p.mdx': setYoutubeChannelId(withRss, 'UCabcdefghijklmnopqrstuv') })
    expect(loadCatalog(dir).peopleById.get('p')!.feeds).toEqual({ rss: 'https://p.example.com/rss', youtubeChannelId: 'UCabcdefghijklmnopqrstuv' })
  })
})

describe('renderNewNode', () => {
  it('genera un nodo que el cargador acepta', () => {
    const dir = makeDir({ ...BASE_FILES, 'nodes/agentes-locales.mdx': renderNewNode(NEW_NODE) })
    const node = loadCatalog(dir).byId.get('agentes-locales')!
    expect(node).toMatchObject({ verified: false, status: 'emerging', requires: ['mcp'], released: '2026-10' })
    expect(node.sections).toEqual({ purpose: 'Sirve para algo.', usage: 'Se usa así.', nonTechnical: 'Es como un asistente.' })
  })
})

describe('applyProposals y writeReport', () => {
  it('aplica todo, el contenido resultante es válido y una segunda pasada no cambia nada', () => {
    const dir = makeDir(BASE_FILES)
    const first = applyProposals(dir, PROPOSALS)
    expect(first.changed.sort()).toEqual(['nodes/agentes-locales.mdx', 'nodes/mcp.mdx', 'people/p.mdx'])
    expect(first.skipped).toEqual([])
    expect(first.applied).toEqual(PROPOSALS)
    expect(writeReport(dir, REPORT, 'Semana de agentes.')).toBe('radar/2026-10-23.mdx')

    const cat = loadCatalog(dir)
    expect(cat.byId.get('mcp')!.status).toBe('rising')
    expect(cat.peopleById.get('p')!.highlights).toHaveLength(2)
    expect(cat.reports[0]).toMatchObject({ week: '2026-10-23', summary: 'Semana de agentes.' })
    expect(cat.reports[0].items[0].summary).toBe('Un modelo: "nuevo".')

    expect(applyProposals(dir, PROPOSALS).changed).toEqual([])
  })
  it('salta con motivo una propuesta que no se puede aplicar, sin romper el resto', () => {
    const inline = PERSON.replace(/highlights:\n(?: {2}.*\n)+/, 'highlights: [{ title: "Uno", url: "https://example.com/1", format: video }]\n')
    const dir = makeDir({ ...BASE_FILES, 'people/p.mdx': inline })
    const res = applyProposals(dir, { ...PROPOSALS, feeds: [] })
    expect(res.skipped).toHaveLength(1)
    expect(res.skipped[0]).toMatch(/^recurso para p — /)
    expect(res.applied.highlights).toEqual([])
    expect(res.applied.statusChanges).toHaveLength(1)
    expect(fs.readFileSync(path.join(dir, 'people/p.mdx'), 'utf8')).toBe(inline)
  })
})
```

- [ ] **Step 3: Correr los tests y ver que fallan**

Run: `npx vitest run tests/radar-apply.test.ts`
Expected: FAIL con "Failed to resolve import '@/scripts/radar/apply'".

- [ ] **Step 4: Implementar `scripts/radar/apply.ts`**

```ts
import fs from 'node:fs'
import path from 'node:path'
import { dump } from 'js-yaml'
import type { RadarFrontmatter } from '@/lib/content/schema'
import type { Status } from '@/lib/content/enums'
import type { Highlight } from '@/lib/content/types'
import type { StatusChange, NewNode, HighlightProposal } from './validate'
import type { ResolvedFeed } from './resolve-feeds'

export interface Proposals {
  statusChanges: StatusChange[]
  newNodes: NewNode[]
  highlights: HighlightProposal[]
  feeds: ResolvedFeed[]
}

const yaml = (data: object) => dump(data, { lineWidth: -1, noRefs: true })

// Las ediciones tocan solo el frontmatter y conservan el resto del archivo tal cual
function withFrontmatter(text: string, edit: (front: string) => string): string {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text)
  if (!m) throw new Error('el archivo no tiene frontmatter')
  return `---\n${edit(m[1])}\n---\n${text.slice(m[0].length)}`
}

export function setStatus(text: string, to: Status): string {
  return withFrontmatter(text, (front) => front.replace(/^status:.*$/m, `status: ${to}`))
}

export function renderNewNode({ front, sections }: NewNode): string {
  const { links, ...rest } = front
  const data = Object.keys(links).length ? { ...rest, links } : rest
  return `---\n${yaml(data)}---\n\n## Para qué sirve\n\n${sections.purpose}\n\n## Cómo se usa\n\n${sections.usage}\n\n## Para no técnicos\n\n${sections.nonTechnical}\n`
}

export function addHighlight(text: string, h: Highlight): string {
  return withFrontmatter(text, (front) => {
    if (front.includes(h.url)) return front
    const lines = front.split('\n')
    const start = lines.findIndex((l) => /^highlights:\s*$/.test(l))
    if (start === -1) throw new Error('highlights no está en formato de bloque; agrégalo a mano')
    let end = start + 1
    while (end < lines.length && /^\s+\S/.test(lines[end])) end++
    lines.splice(end, 0,
      `  - title: ${JSON.stringify(h.title)}`,
      `    url: ${JSON.stringify(h.url)}`,
      `    format: ${h.format}`,
      ...(h.topic ? [`    topic: ${h.topic}`] : []),
      ...(h.language ? [`    language: ${h.language}`] : []),
    )
    return lines.join('\n')
  })
}

export function setYoutubeChannelId(text: string, channelId: string): string {
  return withFrontmatter(text, (front) => {
    if (/^\s+youtubeChannelId:/m.test(front)) return front
    const entry = `  youtubeChannelId: "${channelId}"`
    if (/^feeds:\s*$/m.test(front)) return front.replace(/^feeds:\s*$/m, `feeds:\n${entry}`)
    return front.replace(/^verified:/m, `feeds:\n${entry}\nverified:`)
  })
}

export function renderReport(report: RadarFrontmatter, summary: string): string {
  return `---\n${yaml(report)}---\n\n## Resumen de la semana\n\n${summary.trim()}\n`
}

export function applyProposals(contentDir: string, proposals: Proposals): { changed: string[]; skipped: string[]; applied: Proposals } {
  const changed: string[] = []
  const skipped: string[] = []
  const applied: Proposals = { statusChanges: [], newNodes: [], highlights: [], feeds: [] }
  const file = (rel: string) => path.join(contentDir, rel)
  const write = (rel: string, next: string) => {
    const prev = fs.existsSync(file(rel)) ? fs.readFileSync(file(rel), 'utf8') : null
    if (prev === next) return
    fs.mkdirSync(path.dirname(file(rel)), { recursive: true })
    fs.writeFileSync(file(rel), next)
    if (!changed.includes(rel)) changed.push(rel)
  }
  const edit = (rel: string, fn: (text: string) => string, label: string): boolean => {
    try {
      write(rel, fn(fs.readFileSync(file(rel), 'utf8')))
      return true
    } catch (e) {
      skipped.push(`${label} — ${e instanceof Error ? e.message : String(e)}`)
      return false
    }
  }

  for (const c of proposals.statusChanges) {
    if (edit(`nodes/${c.nodeId}.mdx`, (t) => setStatus(t, c.to), `estado de ${c.nodeId}`)) applied.statusChanges.push(c)
  }
  for (const n of proposals.newNodes) {
    const rel = `nodes/${n.front.id}.mdx`
    // Idempotente: si el nodo ya existe (una ejecución anterior lo creó), no se reescribe
    if (!fs.existsSync(file(rel))) write(rel, renderNewNode(n))
    applied.newNodes.push(n)
  }
  for (const h of proposals.highlights) {
    if (edit(`people/${h.personId}.mdx`, (t) => addHighlight(t, h.highlight), `recurso para ${h.personId}`)) applied.highlights.push(h)
  }
  for (const f of proposals.feeds) {
    if (edit(`people/${f.personId}.mdx`, (t) => setYoutubeChannelId(t, f.channelId), `feed de ${f.personId}`)) applied.feeds.push(f)
  }
  return { changed, skipped, applied }
}

export function writeReport(contentDir: string, report: RadarFrontmatter, summary: string): string {
  const rel = `radar/${report.week}.mdx`
  fs.mkdirSync(path.join(contentDir, 'radar'), { recursive: true })
  fs.writeFileSync(path.join(contentDir, rel), renderReport(report, summary))
  return rel
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx vitest run tests/radar-apply.test.ts && npx tsc --noEmit -p .`
Expected: PASS; `tsc` sin errores.

- [ ] **Step 6: Commit**

```bash
git add scripts/radar/apply.ts tests/helpers/radar-content.ts tests/radar-apply.test.ts
git commit -m "feat: aplicación idempotente de propuestas e informe del radar"
```

---

### Task 8: Orquestación, CLI y workflow

**Files:**
- Create: `scripts/radar/pipeline.ts`, `scripts/radar/run.ts`, `.github/workflows/radar.yml`
- Modify: `package.json` (devDependency `tsx`, script `radar`), `.gitignore`, `README.md`
- Test: `tests/radar-pipeline.test.ts`

**Interfaces:**
- Consumes: todo lo anterior
- Produces:
  - `MAX_ITEMS = 150`
  - `interface RadarDeps { contentDir: string; now: Date; fetch: FetchFn; client: JudgeClient; githubToken?: string; write: boolean; log?: (msg: string) => void }`
  - `interface RadarResult { week: string; hasChanges: boolean; report?: RadarFrontmatter; changed: string[]; discarded: string[]; failures: string[]; prBody: string }`
  - `collectWeek(catalog: Catalog, deps: Pick<RadarDeps, 'now' | 'fetch' | 'githubToken'>): Promise<{ items: RawItem[]; resolved: ResolvedFeed[]; failures: string[]; sourcesChecked: number }>`
  - `buildJudgeInput(catalog: Catalog, items: RawItem[]): JudgeInput`
  - `toReportProposals(p: Proposals): Proposal[]`
  - `renderPrBody(args: { report: RadarFrontmatter; summary: string; discarded: string[]; failures: string[] }): string`
  - `runRadar(deps: RadarDeps): Promise<RadarResult>`
  - CLI: `npx tsx scripts/radar/run.ts [--dry-run | --collect-only]`; escribe `.radar/pr-body.md` y, si existe `GITHUB_OUTPUT`, `has_changes=true|false` y `week=<YYYY-MM-DD>`

- [ ] **Step 1: Instalar `tsx`**

Run: `npm install -D tsx@^4.23.15`
Expected: `package.json` gana `"tsx"` en `devDependencies`. Agregar además el script `"radar": "tsx scripts/radar/run.ts"` en `scripts`.

- [ ] **Step 2: Escribir los tests que fallan**

Crear `tests/radar-pipeline.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { runRadar } from '@/scripts/radar/pipeline'
import type { FetchFn } from '@/scripts/radar/fetch-sources'
import type { Judgement, JudgeClient } from '@/scripts/radar/judge'
import { loadCatalog } from '@/lib/content/load'
import { BASE_FILES, PERSON, makeDir } from './helpers/radar-content'

const fixture = (name: string) => fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/radar', name), 'utf8')
const NOW = new Date('2026-10-23T13:00:00Z')

function fakeFetch(routes: Record<string, string>): FetchFn {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    const hit = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))
    return hit ? new Response(hit[1]) : new Response('no encontrado', { status: 404 })
  }) as FetchFn
}
const ROUTES = {
  'https://www.youtube.com/@p': fixture('channel.html'),
  'https://www.youtube.com/feeds/videos.xml': fixture('atom.xml'),
  'https://blog.example.com/feed.xml': fixture('rss.xml'),
}

const JUDGEMENT: Judgement = {
  summary: 'Semana de agentes.',
  items: [
    { url: 'https://blog.example.com/nuevo-modelo', topics: ['mcp'], relevance: 'high', summary: 'Un modelo nuevo para agentes.' },
    { url: 'https://inventado.example.com/x', topics: ['mcp'], relevance: 'medium', summary: 'No existe.' },
  ],
  statusChanges: [{ nodeId: 'mcp', to: 'rising', reason: 'Más adopción', evidence: ['https://blog.example.com/nuevo-modelo'] }],
  newNodes: [],
  highlights: [{ personId: 'p', url: 'https://www.youtube.com/watch?v=abc123', format: 'video', topic: 'mcp', reason: 'Buen video' }],
}

function fakeClient(result: Judgement) {
  const calls: { messages: { content: string }[] }[] = []
  const client = {
    beta: { messages: { parse: async (params: { messages: { content: string }[] }) => { calls.push(params); return { stop_reason: 'end_turn', parsed_output: result } } } },
  } as unknown as JudgeClient
  return { client, calls }
}

describe('runRadar', () => {
  it('recolecta, juzga, valida, aplica y escribe un informe válido', async () => {
    const dir = makeDir(BASE_FILES)
    const { client, calls } = fakeClient(JUDGEMENT)
    const res = await runRadar({ contentDir: dir, now: NOW, fetch: fakeFetch(ROUTES), client, write: true })

    expect(calls).toHaveLength(1)
    expect(calls[0].messages[0].content).toContain('https://www.youtube.com/watch?v=abc123')
    expect(res.hasChanges).toBe(true)
    expect(res.week).toBe('2026-10-23')
    expect(res.report!.items.map((i) => i.url)).toEqual(['https://blog.example.com/nuevo-modelo'])
    expect(res.report!.proposals.map((p) => p.type)).toEqual(['status', 'highlight', 'feeds'])
    expect(res.report!.sourcesChecked).toBe(2)
    expect(res.discarded.some((d) => d.includes('inventado.example.com'))).toBe(true)
    expect(res.prBody).toContain('Cambios aplicados')
    expect(res.prBody).toContain('Propuestas descartadas por validación')

    const cat = loadCatalog(dir)
    expect(cat.byId.get('mcp')!.status).toBe('rising')
    expect(cat.peopleById.get('p')!.highlights).toHaveLength(2)
    expect(cat.peopleById.get('p')!.feeds?.youtubeChannelId).toBe('UCabcdefghijklmnopqrstuv')
    expect(cat.reports[0]).toMatchObject({ week: '2026-10-23', summary: 'Semana de agentes.' })
  })

  it('con write: false no toca los archivos', async () => {
    const dir = makeDir(BASE_FILES)
    const res = await runRadar({ contentDir: dir, now: NOW, fetch: fakeFetch(ROUTES), client: fakeClient(JUDGEMENT).client, write: false })
    expect(res.hasChanges).toBe(true)
    expect(res.changed).toEqual([])
    expect(loadCatalog(dir).byId.get('mcp')!.status).toBe('emerging')
    expect(fs.existsSync(path.join(dir, 'radar'))).toBe(false)
  })

  it('sin ítems nuevos ni feeds no llama al modelo ni reporta cambios', async () => {
    const noYoutube = PERSON.replace('  youtube: https://www.youtube.com/@p', '  x: https://x.com/p')
    const dir = makeDir({ ...BASE_FILES, 'people/p.mdx': noYoutube })
    const { client, calls } = fakeClient(JUDGEMENT)
    const res = await runRadar({ contentDir: dir, now: new Date('2026-12-01T13:00:00Z'), fetch: fakeFetch(ROUTES), client, write: true })
    expect(calls).toHaveLength(0)
    expect(res.hasChanges).toBe(false)
    expect(res.changed).toEqual([])
  })
})
```

- [ ] **Step 3: Correr los tests y ver que fallan**

Run: `npx vitest run tests/radar-pipeline.test.ts`
Expected: FAIL con "Failed to resolve import '@/scripts/radar/pipeline'".

- [ ] **Step 4: Implementar `scripts/radar/pipeline.ts`**

```ts
import { loadCatalog } from '@/lib/content/load'
import { LABELS } from '@/lib/content/enums'
import type { Proposal, RadarFrontmatter } from '@/lib/content/schema'
import type { Catalog } from '@/lib/content/types'
import { formatWeek } from '@/lib/radar'
import { collectItems, seenUrls, type RawItem } from './collect'
import { buildRequests, fetchAll, type FetchFn } from './fetch-sources'
import { resolveMissingFeeds, type ResolvedFeed } from './resolve-feeds'
import { judge, EMPTY_JUDGEMENT, MODEL, type JudgeClient, type JudgeInput } from './judge'
import { validateJudgement } from './validate'
import { applyProposals, writeReport, type Proposals } from './apply'

export const MAX_ITEMS = 150
const DAY = 86_400_000
const toDay = (d: Date) => d.toISOString().slice(0, 10)

export interface RadarDeps {
  contentDir: string
  now: Date
  fetch: FetchFn
  client: JudgeClient
  githubToken?: string
  write: boolean
  log?: (msg: string) => void
}

export interface RadarResult {
  week: string
  hasChanges: boolean
  report?: RadarFrontmatter
  changed: string[]
  discarded: string[]
  failures: string[]
  prBody: string
}

export async function collectWeek(catalog: Catalog, deps: Pick<RadarDeps, 'now' | 'fetch' | 'githubToken'>) {
  const feeds = await resolveMissingFeeds(catalog.people, deps.fetch)
  // Los canales recién resueltos ya se leen esta misma semana
  const extra = Object.fromEntries(feeds.resolved.map((f) => [f.personId, f.channelId]))
  const fetched = await fetchAll(buildRequests(catalog.sources, catalog.people, deps.now, extra), deps.fetch, deps.githubToken)
  const items = collectItems(fetched.items, { now: deps.now, seen: seenUrls(catalog.reports), max: MAX_ITEMS })
  return {
    items,
    resolved: feeds.resolved,
    sourcesChecked: fetched.sourcesChecked,
    failures: [...feeds.failures, ...fetched.failures.map((f) => `${f.sourceId}: ${f.error} (${f.url})`)],
  }
}

export function buildJudgeInput(catalog: Catalog, items: RawItem[]): JudgeInput {
  return {
    items,
    nodes: catalog.nodes.map((n) => ({ id: n.id, title: n.title, status: n.status, level: n.level, summary: n.summary })),
    people: catalog.people.map((p) => ({ id: p.id, name: p.name, topics: p.topics, highlightCount: p.highlights.length })),
    categories: catalog.categories.map((c) => ({ id: c.id, label: c.label })),
  }
}

export function toReportProposals(p: Proposals): Proposal[] {
  return [
    ...p.statusChanges.map((c): Proposal => ({ type: 'status', target: c.nodeId, from: c.from, to: c.to, reason: c.reason, evidence: c.evidence })),
    ...p.newNodes.map((n): Proposal => ({ type: 'new-node', target: n.front.id, reason: n.reason, evidence: n.evidence })),
    ...p.highlights.map((h): Proposal => ({ type: 'highlight', target: h.personId, reason: h.reason, evidence: h.evidence })),
    ...p.feeds.map((f): Proposal => ({ type: 'feeds', target: f.personId, reason: 'ID del canal de YouTube resuelto automáticamente', evidence: [f.youtubeUrl] })),
  ]
}

export function renderPrBody({ report, summary, discarded, failures }: { report: RadarFrontmatter; summary: string; discarded: string[]; failures: string[] }): string {
  const lines = [
    `## Radar IA: semana del ${formatWeek(report.week)}`, '',
    summary, '',
    `**Ítems:** ${report.items.length} · **Fuentes consultadas:** ${report.sourcesChecked}`, '',
  ]
  if (report.proposals.length) {
    lines.push('### Cambios aplicados', '')
    for (const p of report.proposals) {
      const step = p.type === 'status' ? ` (${p.from} → ${p.to})` : ''
      lines.push(`- **${LABELS[p.type]}** \`${p.target}\`${step}: ${p.reason}`)
    }
    lines.push('')
  }
  if (discarded.length) lines.push('### Propuestas descartadas por validación', '', ...discarded.map((d) => `- ${d}`), '')
  if (failures.length) lines.push('### Fuentes con error', '', ...failures.map((f) => `- ${f}`), '')
  lines.push('Revisa los cambios antes de mergear: los nodos nuevos llegan con `verified: false`.', '', 'Generado por el radar semanal de ExpIA.')
  return lines.join('\n')
}

export async function runRadar(deps: RadarDeps): Promise<RadarResult> {
  const log = deps.log ?? (() => {})
  const catalog = loadCatalog(deps.contentDir)
  const week = toDay(deps.now)
  const { items, resolved, failures, sourcesChecked } = await collectWeek(catalog, deps)
  log(`${items.length} ítems nuevos de ${sourcesChecked} fuentes; ${failures.length} fallos`)

  const judgement = items.length ? await judge(deps.client, buildJudgeInput(catalog, items)) : EMPTY_JUDGEMENT
  const validated = validateJudgement(judgement, {
    items,
    nodes: catalog.nodes,
    people: catalog.people,
    categoryIds: catalog.categories.map((c) => c.id),
    today: week,
  })
  const proposals: Proposals = { statusChanges: validated.statusChanges, newNodes: validated.newNodes, highlights: validated.highlights, feeds: resolved }
  const proposalCount = proposals.statusChanges.length + proposals.newNodes.length + proposals.highlights.length + proposals.feeds.length
  if (validated.items.length === 0 && proposalCount === 0) {
    return { week, hasChanges: false, changed: [], discarded: validated.discarded, failures, prBody: '' }
  }

  const { changed, skipped, applied } = deps.write
    ? applyProposals(deps.contentDir, proposals)
    : { changed: [] as string[], skipped: [] as string[], applied: proposals }
  const report: RadarFrontmatter = {
    week,
    from: toDay(new Date(deps.now.getTime() - 7 * DAY)),
    sourcesChecked,
    items: validated.items,
    proposals: toReportProposals(applied),
    generated: { by: 'radar-agent', ...(items.length ? { model: MODEL } : {}), at: deps.now.toISOString() },
  }
  const summary = validated.summary || 'Sin novedades destacadas esta semana.'
  if (deps.write) changed.push(writeReport(deps.contentDir, report, summary))
  const discarded = [...validated.discarded, ...skipped]
  return { week, hasChanges: true, report, changed, discarded, failures, prBody: renderPrBody({ report, summary, discarded, failures }) }
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx vitest run tests/radar-pipeline.test.ts && npx tsc --noEmit -p .`
Expected: PASS (3 tests); `tsc` sin errores.

- [ ] **Step 6: Implementar la CLI `scripts/radar/run.ts`**

```ts
import fs from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { loadCatalog } from '@/lib/content/load'
import { runRadar, collectWeek } from './pipeline'

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const contentDir = path.join(process.cwd(), 'content')
  const now = new Date()
  const githubToken = process.env.GITHUB_TOKEN

  // Sin llave de API: solo muestra lo que se recolectaría (útil para curar fuentes)
  if (args.includes('--collect-only')) {
    const { items, failures, sourcesChecked } = await collectWeek(loadCatalog(contentDir), { now, fetch, githubToken })
    console.log(JSON.stringify({ sourcesChecked, failures, items }, null, 2))
    return
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Falta ANTHROPIC_API_KEY. En GitHub: Settings › Secrets and variables › Actions › New repository secret.')
    process.exit(1)
  }

  const result = await runRadar({ contentDir, now, fetch, client: new Anthropic(), githubToken, write: !dryRun, log: (m) => console.log(m) })
  if (result.failures.length) console.warn(`Fuentes con error:\n- ${result.failures.join('\n- ')}`)
  if (dryRun) {
    console.log(JSON.stringify({ report: result.report, discarded: result.discarded }, null, 2))
    return
  }
  fs.mkdirSync('.radar', { recursive: true })
  fs.writeFileSync(path.join('.radar', 'pr-body.md'), result.prBody)
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_changes=${result.hasChanges}\nweek=${result.week}\n`)
  }
  console.log(result.hasChanges ? `Archivos cambiados:\n- ${result.changed.join('\n- ')}` : 'Sin cambios esta semana.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 7: Verificar la CLI sin llave**

Run: `env -u ANTHROPIC_API_KEY npx tsx scripts/radar/run.ts; echo "exit=$?"`
Expected: imprime "Falta ANTHROPIC_API_KEY…" y `exit=1`; `git status --short content` no muestra cambios.

- [ ] **Step 8: Crear el workflow `.github/workflows/radar.yml`**

```yaml
name: Radar IA

on:
  schedule:
    - cron: '0 13 * * 5' # viernes 8:00 en Colombia
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

concurrency:
  group: radar
  cancel-in-progress: false

jobs:
  radar:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci

      - name: Ejecutar el radar
        id: radar
        run: npx tsx scripts/radar/run.ts
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Pruebas
        id: tests
        if: steps.radar.outputs.has_changes == 'true'
        continue-on-error: true
        run: npm test 2>&1 | tee .radar/test-output.txt

      - name: Abrir el PR
        if: steps.radar.outputs.has_changes == 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          WEEK: ${{ steps.radar.outputs.week }}
          TESTS: ${{ steps.tests.outcome }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          branch="radar/$WEEK"
          git checkout -B "$branch"
          git add content
          git commit -m "content: radar IA, semana del $WEEK"
          git push --force -u origin "$branch"

          body=.radar/pr-body.md
          draft=""
          if [ "$TESTS" != "success" ]; then
            draft="--draft"
            { printf '\n## npm test falló\n\n```\n'; tail -n 80 .radar/test-output.txt; printf '```\n'; } >> "$body"
          fi

          gh label create radar --color 0E8A16 --description "Informe semanal del radar" --force
          if gh pr view "$branch" --json state -q .state 2>/dev/null | grep -q OPEN; then
            gh pr edit "$branch" --body-file "$body"
          else
            gh pr create --base main --head "$branch" --title "Radar IA: semana del $WEEK" --body-file "$body" --label radar $draft
          fi
```

- [ ] **Step 9: Ignorar la carpeta de trabajo y documentar**

Agregar al final de `.gitignore`:

```
# salida local del radar
.radar/
```

Agregar al final de `README.md`:

````markdown
## Radar semanal

Cada viernes, el workflow `Radar IA` (`.github/workflows/radar.yml`) lee las fuentes de `content/sources.yaml` y los feeds de los referentes, le pide a Claude que elija lo relevante y abre un PR con el informe (`content/radar/<fecha>.mdx`) y los cambios propuestos al catálogo. Nada se publica hasta que alguien mergea el PR.

**Configuración (una vez):**

1. Crea una llave en [console.anthropic.com](https://console.anthropic.com) y guárdala como secreto del repositorio `ANTHROPIC_API_KEY` (Settings › Secrets and variables › Actions).
2. En Settings › Actions › General, activa "Allow GitHub Actions to create and approve pull requests".
3. Lanza la primera ejecución a mano desde la pestaña Actions › Radar IA › Run workflow.

**En local:**

```bash
npx tsx scripts/radar/run.ts --collect-only   # qué se recolectaría, sin llamar al modelo
ANTHROPIC_API_KEY=... npx tsx scripts/radar/run.ts --dry-run   # informe completo sin escribir archivos
```

**Agregar una fuente:** si es el blog de un referente, va en su `feeds.rss`, así sus ítems quedan atribuidos a esa persona. Si no, agrégala a `content/sources.yaml` (`rss`, `hackernews` o `github`) y verifica con `--collect-only` que aparece sin errores.

**Nota:** los PR abiertos con el `GITHUB_TOKEN` del workflow no disparan el workflow de CI; el radar corre `npm test` por su cuenta y abre el PR como borrador si falla. La vista previa de Vercel sí se genera.
````

- [ ] **Step 10: Correr la suite completa**

Run: `npm test && npx tsc --noEmit -p . && npm run lint`
Expected: todos PASS; sin errores de tipos ni de lint.

- [ ] **Step 11: Commit**

```bash
git add scripts/radar/pipeline.ts scripts/radar/run.ts tests/radar-pipeline.test.ts .github/workflows/radar.yml .gitignore README.md package.json package-lock.json
git commit -m "feat: orquestación del radar, CLI y workflow semanal"
```

---

### Task 9: Contenido semilla: fuentes, feeds de referentes e informe

**Files:**
- Create: `content/sources.yaml`, `content/radar/<YYYY-MM-DD>.mdx` (fecha del día de ejecución)
- Modify: `content/people/*.mdx` (agregar `feeds.rss` donde aplique)
- Test: `tests/content-integrity.test.ts`

**Interfaces:**
- Consumes: esquemas y cargador (Task 1); CLI `--collect-only` (Task 8)
- Produces: contenido real que usan las vistas (Task 10) y el E2E (Task 11): al menos un informe con al menos un ítem `high` y al menos 3 ítems en total.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar dentro de `describe('content/ real')` en `tests/content-integrity.test.ts`:

```ts
  it('el radar tiene fuentes y un informe con ítems de relevancia alta', () => {
    const { sources, reports } = loadCatalog()
    expect(sources.length).toBeGreaterThan(0)
    expect(reports.length).toBeGreaterThan(0)
    expect(reports[0].items.length).toBeGreaterThanOrEqual(3)
    expect(reports[0].items.some((i) => i.relevance === 'high')).toBe(true)
  })

  it('ninguna URL se repite entre informes', () => {
    const urls = loadCatalog().reports.flatMap((r) => r.items.map((i) => i.url))
    expect(new Set(urls).size).toBe(urls.length)
  })
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `npx vitest run tests/content-integrity.test.ts`
Expected: FAIL en "el radar tiene fuentes…" (no hay fuentes ni informes).

- [ ] **Step 3: Verificar las URLs candidatas de feeds**

Run:

```bash
mkdir -p .radar
for u in \
  https://simonwillison.net/atom/everything/ \
  https://lilianweng.github.io/index.xml \
  https://magazine.sebastianraschka.com/feed \
  https://www.latent.space/feed \
  https://www.oneusefulthing.org/feed \
  https://huggingface.co/blog/feed.xml \
  https://hamel.dev/index.xml \
  https://huyenchip.com/feed.xml \
  https://jalammar.github.io/feed.xml \
  https://openai.com/news/rss.xml \
  https://deepmind.google/blog/rss.xml \
  https://blog.google/technology/ai/rss/ \
  https://www.microsoft.com/en-us/research/feed/ \
  https://aws.amazon.com/blogs/machine-learning/feed/ \
  ; do
  code=$(curl -sL -m 20 -A 'expia-radar' -o .radar/check.xml -w '%{http_code}' "$u")
  if [ "$code" = 200 ] && head -c 2000 .radar/check.xml | grep -qE '<(rss|feed)[ >]'; then echo "OK   $u"; else echo "FAIL $code $u"; fi
done
```

Expected: una línea `OK` o `FAIL` por URL. **Solo se usan las URLs con `OK`.** Las que fallen se omiten (regla de la spec: ante la duda, no se incluye).

- [ ] **Step 4: Agregar `feeds.rss` a los referentes con blog verificado**

Para cada URL con `OK` que pertenece a un referente, agregar el bloque antes de `verified:` en su archivo:

| Referente | Archivo | URL |
|---|---|---|
| Simon Willison | `content/people/simon-willison.mdx` | `https://simonwillison.net/atom/everything/` |
| Lilian Weng | `content/people/lilian-weng.mdx` | `https://lilianweng.github.io/index.xml` |
| Sebastian Raschka | `content/people/sebastian-raschka.mdx` | `https://magazine.sebastianraschka.com/feed` |
| Latent Space | `content/people/latent-space.mdx` | `https://www.latent.space/feed` |
| Ethan Mollick | `content/people/ethan-mollick.mdx` | `https://www.oneusefulthing.org/feed` |
| Hugging Face | `content/people/hugging-face.mdx` | `https://huggingface.co/blog/feed.xml` |
| Hamel Husain | `content/people/hamel-husain.mdx` | `https://hamel.dev/index.xml` |
| Chip Huyen | `content/people/chip-huyen.mdx` | `https://huyenchip.com/feed.xml` |
| Jay Alammar | `content/people/jay-alammar.mdx` | `https://jalammar.github.io/feed.xml` |

Formato (si el archivo ya tiene `feeds:`, agregar solo la línea `rss`):

```yaml
feeds:
  rss: https://simonwillison.net/atom/everything/
verified: false
```

- [ ] **Step 5: Crear `content/sources.yaml`**

Con las URLs no personales que dieron `OK` en el Step 3, más Hacker News y GitHub (estos dos no se verifican con el script porque son APIs JSON):

```yaml
# Fuentes curadas del radar. El blog de un referente va en su feeds.rss, no aquí.
sources:
  - id: openai-news
    name: OpenAI News
    kind: rss
    url: https://openai.com/news/rss.xml
  - id: google-deepmind-blog
    name: Blog de Google DeepMind
    kind: rss
    url: https://deepmind.google/blog/rss.xml
  - id: google-ai-blog
    name: Blog de Google AI
    kind: rss
    url: https://blog.google/technology/ai/rss/
  - id: microsoft-research-blog
    name: Microsoft Research
    kind: rss
    url: https://www.microsoft.com/en-us/research/feed/
  - id: aws-ml-blog
    name: Blog de Machine Learning de AWS
    kind: rss
    url: https://aws.amazon.com/blogs/machine-learning/feed/
  - id: hackernews-ai
    name: Hacker News
    kind: hackernews
    minPoints: 200
    keywords: [LLM, GPT, Claude, Gemini, "AI agent", RAG, "open source model", diffusion]
  - id: github-ai
    name: GitHub
    kind: github
    minStars: 300
    topics: [llm, ai-agents, rag, generative-ai, mcp]
```

Quitar del archivo cualquier entrada `rss` que haya dado `FAIL`.

- [ ] **Step 6: Recolectar ítems reales**

Run: `npx tsx scripts/radar/run.ts --collect-only > .radar/collect.json; node -e "const r=require('./.radar/collect.json'); console.log('fuentes', r.sourcesChecked, 'items', r.items.length, 'fallos', r.failures.length)"`
Expected: `fuentes` ≥ 8 e `items` ≥ 10. Si hay fallos de fuentes RSS de `sources.yaml` o de `feeds.rss`, revisar la URL y quitarla si no se recupera. Los fallos de resolución de canales de YouTube no bloquean.

- [ ] **Step 7: Escribir el informe semilla**

Crear `content/radar/<HOY>.mdx`, donde `<HOY>` es la fecha actual en formato `YYYY-MM-DD` y `from` es esa fecha menos 7 días. Elegir de 5 a 8 ítems de `.radar/collect.json` que sean relevantes para aprender IA:

- `title`, `url`, `source` y `publishedAt` (primeros 10 caracteres) copiados **exactamente** de `collect.json`.
- `topics`: IDs existentes en `content/nodes/` (por ejemplo `llm`, `agents`, `rag`, `mcp`, `claude`, `gemini`, `gpt`, `evals`).
- Al menos 2 ítems con `relevance: high`.
- `summary` en español neutro, de máximo 280 caracteres, que explique por qué importa.
- `sourcesChecked`: el valor de `collect.json`.
- `proposals: []` y `generated: { by: manual, at: "<HOY>T12:00:00Z" }`.

Plantilla:

```yaml
---
week: "<HOY>"
from: "<HOY menos 7 días>"
sourcesChecked: <N>
items:
  - title: "<título copiado de collect.json>"
    url: <url copiada de collect.json>
    source: <source copiado de collect.json>
    publishedAt: "<YYYY-MM-DD>"
    topics: [<id>, <id>]
    relevance: high
    summary: "<por qué importa, ≤280 caracteres>"
proposals: []
generated:
  by: manual
  at: "<HOY>T12:00:00Z"
---

## Resumen de la semana

<1 a 3 párrafos en español que conecten los ítems elegidos.>
```

- [ ] **Step 8: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: todos PASS, incluidos los dos tests nuevos de integridad.

- [ ] **Step 9: Commit**

```bash
git add content tests/content-integrity.test.ts
git commit -m "content: fuentes del radar, feeds de referentes e informe semilla"
```

---

### Task 10: Vistas del radar en el sitio

**Files:**
- Create: `components/report-item-card.tsx`, `components/proposal-list.tsx`, `components/recent-mentions.tsx`, `components/this-week-block.tsx`, `app/radar/page.tsx`, `app/radar/[week]/page.tsx`
- Modify: `app/page.tsx`, `app/node/[id]/page.tsx`, `components/site-header.tsx`

**Interfaces:**
- Consumes: `getLatestReport`, `getTopItems`, `getMentionsForTopic`, `formatWeek`, `sourceNames`, `Mention` (Task 2); `Catalog.reports`, `Catalog.sources` (Task 1); contenido semilla (Task 9)
- Produces (selectores que usa el E2E de Task 11):
  - `data-testid="report-link"` en cada informe de `/radar`
  - `data-testid="report-item"` en cada ítem
  - `data-testid="this-week"` en el bloque del dashboard
  - `data-testid="recent-mentions"` en la ficha de nodo
  - Títulos: "Radar" (h1 de `/radar`), "Resumen de la semana" y "Cambios en el catálogo" (h2 del informe), "Esta semana en IA" (dashboard), "Menciones recientes" (ficha)

- [ ] **Step 1: Crear `components/report-item-card.tsx`**

```tsx
import Link from 'next/link'
import type { ReportItem } from '@/lib/content/schema'
import { Badge } from '@/components/ui/badge'

export function ReportItemCard({ item, topicTitles, sourceName }: { item: ReportItem; topicTitles: Record<string, string>; sourceName: string }) {
  return (
    <article data-testid="report-item" className="space-y-2 rounded-lg border p-4">
      <a href={item.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{item.title}</a>
      <p className="text-xs text-muted-foreground">{sourceName} · {item.publishedAt}</p>
      <p className="text-sm">{item.summary}</p>
      <div className="flex flex-wrap gap-1.5">
        {item.topics.map((t) => (
          <Link key={t} href={`/node/${t}`}>
            <Badge variant="outline">{topicTitles[t] ?? t}</Badge>
          </Link>
        ))}
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Crear `components/proposal-list.tsx`**

```tsx
import Link from 'next/link'
import { LABELS } from '@/lib/content/enums'
import type { Proposal } from '@/lib/content/schema'
import { Badge } from '@/components/ui/badge'

export function ProposalList({ proposals, nodeTitles, personNames }: { proposals: Proposal[]; nodeTitles: Record<string, string>; personNames: Record<string, string> }) {
  if (proposals.length === 0) return <p className="text-sm text-muted-foreground">No hubo cambios en el catálogo esta semana.</p>
  return (
    <ul className="space-y-3 text-sm">
      {proposals.map((p, i) => {
        const onNode = p.type === 'status' || p.type === 'new-node'
        const href = onNode ? `/node/${p.target}` : `/people/${p.target}`
        const name = (onNode ? nodeTitles[p.target] : personNames[p.target]) ?? p.target
        return (
          <li key={`${p.type}-${p.target}-${i}`} className="space-y-1">
            <p className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{LABELS[p.type]}</Badge>
              <Link href={href} className="font-medium hover:underline">{name}</Link>
              {p.type === 'status' && p.from && p.to && (
                <span className="text-muted-foreground">{LABELS[p.from]} → {LABELS[p.to]}</span>
              )}
            </p>
            <p className="text-muted-foreground">{p.reason}</p>
            <p className="flex flex-wrap gap-3 text-xs">
              {p.evidence.map((url, j) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="underline underline-offset-4">Evidencia {j + 1}</a>
              ))}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 3: Crear `components/recent-mentions.tsx`**

```tsx
import Link from 'next/link'
import { formatWeek, type Mention } from '@/lib/radar'

export function RecentMentions({ mentions, sourceNames }: { mentions: Mention[]; sourceNames: Record<string, string> }) {
  if (mentions.length === 0) return null
  return (
    <section data-testid="recent-mentions">
      <h2 className="mb-2 font-semibold">Menciones recientes</h2>
      <ul className="space-y-2 text-sm">
        {mentions.map(({ item, week }) => (
          <li key={item.url}>
            <a href={item.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{item.title}</a>
            <p className="text-xs text-muted-foreground">
              {sourceNames[item.source] ?? item.source} ·{' '}
              <Link href={`/radar/${week}`} className="underline underline-offset-4">Radar del {formatWeek(week)}</Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: Crear `components/this-week-block.tsx`**

```tsx
import Link from 'next/link'
import type { Report } from '@/lib/content/types'
import { formatWeek, getTopItems } from '@/lib/radar'
import { ReportItemCard } from './report-item-card'

export function ThisWeekBlock({ report, topicTitles, sourceNames }: { report: Report; topicTitles: Record<string, string>; sourceNames: Record<string, string> }) {
  const top = getTopItems(report)
  if (top.length === 0) return null
  return (
    <section data-testid="this-week" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Esta semana en IA</h2>
        <Link href={`/radar/${report.week}`} className="text-sm underline underline-offset-4">Ver el informe completo</Link>
      </div>
      <p className="text-sm text-muted-foreground">Semana del {formatWeek(report.week)}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {top.map((i) => <ReportItemCard key={i.url} item={i} topicTitles={topicTitles} sourceName={sourceNames[i.source] ?? i.source} />)}
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Crear `app/radar/page.tsx`**

```tsx
import Link from 'next/link'
import { getCatalog } from '@/lib/content/load'
import { formatWeek } from '@/lib/radar'

export const metadata = { title: 'Radar' }

export default function RadarPage() {
  const { reports } = getCatalog()
  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Radar</h1>
        <p className="text-muted-foreground">
          Cada semana, un agente revisa fuentes curadas y propone lo que vale la pena conocer. Una persona revisa cada informe antes de publicarlo.
        </p>
      </header>
      {reports.length === 0 ? (
        <p className="text-muted-foreground">Aún no hay informes.</p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.week} data-testid="report-link" className="rounded-lg border p-4">
              <Link href={`/radar/${r.week}`} className="font-semibold hover:underline">Semana del {formatWeek(r.week)}</Link>
              <p className="text-xs text-muted-foreground">{r.items.length} ítems · {r.proposals.length} cambios</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Crear `app/radar/[week]/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalog } from '@/lib/content/load'
import { LABELS, RELEVANCES } from '@/lib/content/enums'
import { formatWeek, sourceNames } from '@/lib/radar'
import { Markdown } from '@/components/markdown'
import { ReportItemCard } from '@/components/report-item-card'
import { ProposalList } from '@/components/proposal-list'

type Props = { params: Promise<{ week: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return getCatalog().reports.map((r) => ({ week: r.week }))
}

export async function generateMetadata({ params }: Props) {
  const { week } = await params
  return getCatalog().reports.some((r) => r.week === week) ? { title: `Radar: semana del ${formatWeek(week)}` } : {}
}

export default async function ReportPage({ params }: Props) {
  const { week } = await params
  const { reports, nodes, people, sources } = getCatalog()
  const report = reports.find((r) => r.week === week)
  if (!report) notFound()

  const topicTitles = Object.fromEntries(nodes.map((n) => [n.id, n.title]))
  const personNames = Object.fromEntries(people.map((p) => [p.id, p.name]))
  const names = sourceNames(sources, people)
  const groups = RELEVANCES.map((rel) => ({ rel, items: report.items.filter((i) => i.relevance === rel) })).filter((g) => g.items.length > 0)

  return (
    <article className="max-w-4xl space-y-8">
      <header className="space-y-2">
        <Link href="/radar" className="text-sm text-muted-foreground hover:underline">← Todos los informes</Link>
        <h1 className="text-3xl font-bold">Radar: semana del {formatWeek(report.week)}</h1>
        <p className="text-sm text-muted-foreground">
          Del {formatWeek(report.from)} al {formatWeek(report.week)} · {report.sourcesChecked} fuentes consultadas
        </p>
        {report.generated.by === 'manual' && (
          <p role="note" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            Informe escrito a mano como ejemplo; no lo generó el agente.
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Resumen de la semana</h2>
        <Markdown source={report.summary} />
      </section>

      {groups.map(({ rel, items }) => (
        <section key={rel} className="space-y-3">
          <h2 className="text-xl font-semibold">Relevancia {LABELS[rel].toLowerCase()}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((i) => <ReportItemCard key={i.url} item={i} topicTitles={topicTitles} sourceName={names[i.source] ?? i.source} />)}
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Cambios en el catálogo</h2>
        <ProposalList proposals={report.proposals} nodeTitles={topicTitles} personNames={personNames} />
      </section>
    </article>
  )
}
```

- [ ] **Step 7: Integrar en el dashboard, la ficha y la cabecera**

En `app/page.tsx`:
- Agregar los imports `import { ThisWeekBlock } from '@/components/this-week-block'` e `import { getLatestReport, sourceNames } from '@/lib/radar'`.
- Cambiar la desestructuración a `const { nodes, categories, people, reports, sources } = getCatalog()` y agregar `const latestReport = getLatestReport(reports)`.
- Insertar, justo después del bloque `{trending.length > 0 && (...)}`:

```tsx
      {latestReport && <ThisWeekBlock report={latestReport} topicTitles={topicTitles} sourceNames={sourceNames(sources, people)} />}
```

En `app/node/[id]/page.tsx`:
- Agregar los imports `import { RecentMentions } from '@/components/recent-mentions'` e `import { getMentionsForTopic, sourceNames } from '@/lib/radar'`.
- Cambiar la desestructuración a `const { nodes, byId, categories, people, reports, sources } = getCatalog()`.
- Insertar después de `<VoicesForTopic … />`:

```tsx
        <RecentMentions mentions={getMentionsForTopic(reports, id)} sourceNames={sourceNames(sources, people)} />
```

En `components/site-header.tsx`, agregar `{ href: '/radar', label: 'Radar' },` en `NAV` justo después de la entrada de Referentes.

- [ ] **Step 8: Verificar tipos, lint, pruebas y compilación**

Run: `npx tsc --noEmit -p . && npm run lint && npm test && npm run build`
Expected: sin errores; la salida de `next build` lista `/radar` y `/radar/[week]` como rutas estáticas (● o ○), con la semana del informe semilla entre las rutas generadas.

- [ ] **Step 9: Commit**

```bash
git add components app
git commit -m "feat: vistas del radar, esta semana en IA y menciones recientes"
```

---

### Task 11: Pruebas E2E del radar

**Files:**
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: selectores de Task 10; informe semilla de Task 9

- [ ] **Step 1: Escribir los tests E2E**

Agregar al inicio de `e2e/smoke.spec.ts`, junto a los imports existentes:

```ts
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { load, JSON_SCHEMA } from 'js-yaml'

type SeedReport = { week: string; items: { title: string; topics: string[]; relevance: string }[] }

function latestReport(): SeedReport {
  const dir = path.join(process.cwd(), 'content/radar')
  const file = fs.readdirSync(dir).filter((f) => f.endsWith('.mdx')).sort().at(-1)!
  const { data } = matter(fs.readFileSync(path.join(dir, file), 'utf8'), {
    engines: { yaml: (s: string) => load(s, { schema: JSON_SCHEMA }) as object },
  })
  return data as SeedReport
}
```

Y al final del archivo:

```ts
test('el radar lista los informes y abre el más reciente', async ({ page }) => {
  const report = latestReport()
  await page.goto('/')
  await page.getByRole('link', { name: 'Radar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Radar', level: 1 })).toBeVisible()
  await page.getByTestId('report-link').first().getByRole('link').click()
  await expect(page).toHaveURL(new RegExp(`/radar/${report.week}$`))
  await expect(page.getByRole('heading', { name: 'Resumen de la semana' })).toBeVisible()
  await expect(page.getByTestId('report-item')).toHaveCount(report.items.length)
  await expect(page.getByRole('heading', { name: 'Cambios en el catálogo' })).toBeVisible()
})

test('el dashboard muestra esta semana en IA', async ({ page }) => {
  await page.goto('/')
  const block = page.getByTestId('this-week')
  await expect(block.getByRole('heading', { name: 'Esta semana en IA' })).toBeVisible()
  await expect(block.getByTestId('report-item').first()).toBeVisible()
})

test('la ficha de un nodo mencionado muestra menciones recientes', async ({ page }) => {
  const [first] = latestReport().items
  await page.goto(`/node/${first.topics[0]}`)
  await expect(page.getByTestId('recent-mentions')).toContainText(first.title)
})
```

- [ ] **Step 2: Correr los E2E**

Run: `npm run test:e2e`
Expected: todos PASS (los 14 existentes y los 3 nuevos).

- [ ] **Step 3: Commit**

```bash
git add e2e/smoke.spec.ts
git commit -m "test: smoke tests E2E del radar"
```
