# ExpIA — Referentes: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al dashboard un directorio curado de unos 30 referentes de IA (personas y organizaciones), conectado al catálogo, con la vista `/people`, perfiles y la sección "Quién habla de esto" en cada ficha.

**Architecture:** Los referentes son archivos `content/people/<id>.mdx` validados con Zod al compilar, con el mismo patrón del catálogo. El vínculo con los temas vive en `topics` de cada persona; la ficha del nodo lo deriva al revés con funciones puras de `lib/people.ts`. Los filtros y el hook de URL se generalizan para que nodos y personas compartan las mismas reglas y el mismo mecanismo (estado local + `history.replaceState`).

**Tech Stack:** el mismo del subproyecto 1: Next.js 15 (App Router, estático), TypeScript, Tailwind 4, shadcn/ui (Base UI), Zod 3, gray-matter, js-yaml 5 (imports con nombre), react-markdown, Fuse.js, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-referentes-design.md`

**Rama:** `feat/referentes`, creada desde `feat/catalogo` porque el PR #1 aún no está mergeado. Si se mergea antes de empezar, rebasar `feat/referentes` sobre `main`.

## Global Constraints

- UI solo en español.
- Todas las rutas se generan de forma estática; sin base de datos ni llamadas a APIs externas.
- IDs en kebab-case, iguales al nombre del archivo.
- `summary` ≤ 160 caracteres; `highlights` entre 1 y 5; `platforms` con al menos una clave.
- Única sección obligatoria del cuerpo del referente: `## Por qué seguirle`; títulos `##` desconocidos o duplicados son error.
- Se retira `voices` del esquema de nodos.
- Errores de contenido con el formato `people/<archivo>.mdx › <campo>: <mensaje>`.
- Filtros de personas en la URL con las claves `q`, `topic`, `lang`, `platform`, `aud`, `level`, `kind`; los valores desconocidos se ignoran.
- "Quién habla de esto": recursos sobre el tema primero, luego máximo 6 referentes. Con audiencia "No técnico", primero los de `audience: business`.
- "Referentes para empezar": `level: fundamentals`, español primero, máximo 6.
- Todo referente semilla lleva `verified: false` y `added: 2026-10-17`. Objetivo: 60% inglés, 40% español.
- Cada nodo `level: fundamentals` debe aparecer en los `topics` de al menos un referente (test del contenido real).
- `feeds` está en el esquema pero no se usa ni se muestra.

## Review Focus

1. **Sin carpeta `content/people/` o vacía:** el catálogo carga con `people: []`, `/people` muestra el estado vacío y las fichas ocultan "Quién habla de esto". Test en Task 2.
2. **`platforms: {}`** (sin ninguna red): debe ser error de validación, no un perfil sin enlaces. Test en Task 2.
3. **Referente bilingüe** (`languages: [en, es]`): aparece tanto al filtrar por `es` como por `en`; el idioma de un recurso sin `language` es el primero de la persona. Tests en Task 3 y Task 4.
4. **Parámetros de URL inválidos en `/people`** (`?lang=fr&topic=nope&platform=tiktok`): se ignoran sin romper. Tests en Task 4 y Task 10.
5. **Texto libre en el selector de temas** que no coincide con ningún título: no agrega nada; la coincidencia ignora mayúsculas. Test en Task 3.

---

## File Structure

```
content/people/<id>.mdx           # nuevo: un referente por archivo
lib/content/enums.ts              # +LANGUAGES, PLATFORMS, PERSON_KINDS, HIGHLIGHT_FORMATS
lib/content/schema.ts             # +personFrontmatterSchema; −voices
lib/content/sections.ts           # splitSectionsBy genérico + PERSON_SECTION_HEADINGS
lib/content/types.ts              # +Person; Catalog.people/peopleById
lib/content/load.ts               # carga content/people
lib/people.ts                     # nuevo: índice inverso, orden, cobertura, utilidades
lib/filters.ts                    # +PeopleFilters; matchAny exportado
lib/search.ts                     # createSearch con keys configurables
hooks/use-url-filters.ts          # useUrlState genérico + useUrlPeopleFilters
components/chip-group.tsx         # extraído de filter-bar
components/platform-links.tsx  person-card.tsx  topic-picker.tsx
components/people-filter-bar.tsx  people-client.tsx  highlight-list.tsx  voices-for-topic.tsx
app/people/page.tsx  app/people/[id]/page.tsx
app/node/[id]/page.tsx  app/page.tsx  components/site-header.tsx   # modificados
tests/*.test.ts  e2e/smoke.spec.ts
```

---

### Task 1: `splitSectionsBy` genérico y retiro de `voices`

**Files:**
- Modify: `lib/content/sections.ts` (reemplazar completo), `lib/content/schema.ts`, `tests/dashboard.test.ts`
- Test: `tests/sections.test.ts`, `tests/load.test.ts`

**Interfaces:**
- Produces:
  - `interface SplitResult<K extends string> { sections: Partial<Record<K, string>>; missing: string[]; unknown: string[]; duplicates: string[] }`
  - `splitSectionsBy<K extends string>(body: string, headings: Record<K, string>): SplitResult<K>`
  - `splitSections(body: string): SplitResult<SectionKey>` (misma firma de retorno que hoy)
  - `PERSON_SECTION_HEADINGS: Record<'why', string>` = `{ why: 'Por qué seguirle' }`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `tests/sections.test.ts` (y añadir `splitSectionsBy, PERSON_SECTION_HEADINGS` al import):

```ts
describe('splitSectionsBy', () => {
  it('acepta otro conjunto de títulos (referentes)', () => {
    const { sections, missing, unknown } = splitSectionsBy('## Por qué seguirle\nPorque sí.\n', PERSON_SECTION_HEADINGS)
    expect(sections.why).toBe('Porque sí.')
    expect(missing).toEqual([])
    expect(unknown).toEqual([])
  })
  it('los títulos de nodos son desconocidos para referentes', () => {
    const { missing, unknown } = splitSectionsBy('## Para qué sirve\nA\n', PERSON_SECTION_HEADINGS)
    expect(missing).toEqual(['Por qué seguirle'])
    expect(unknown).toEqual(['Para qué sirve'])
  })
})
```

Agregar a `tests/load.test.ts`, dentro de `describe('loadCatalog')`:

```ts
  it('rechaza el campo retirado voices en un nodo', () => {
    const errs = errorsOf(makeContent({ a: file(fm('a', { voices: '[]' })) }))
    expect(errs.some((e) => e.startsWith('nodes/a.mdx') && e.includes('voices'))).toBe(true)
  })
```

En `tests/dashboard.test.ts`, en el builder `n`, quitar `voices: [], ` (deja de existir en `NodeMeta`).

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `npx vitest run tests/sections.test.ts tests/load.test.ts`
Expected: FAIL. `splitSectionsBy` no existe y el test de `voices` falla porque el esquema aún lo acepta.

- [ ] **Step 3: Reemplazar `lib/content/sections.ts`**

```ts
export type SectionKey = 'purpose' | 'usage' | 'nonTechnical'
export type NodeSections = Record<SectionKey, string>

export const SECTION_HEADINGS: Record<SectionKey, string> = {
  purpose: 'Para qué sirve',
  usage: 'Cómo se usa',
  nonTechnical: 'Para no técnicos',
}

export const PERSON_SECTION_HEADINGS: Record<'why', string> = { why: 'Por qué seguirle' }

export interface SplitResult<K extends string> {
  sections: Partial<Record<K, string>>
  missing: string[]
  unknown: string[]
  duplicates: string[]
}

export function splitSectionsBy<K extends string>(body: string, headings: Record<K, string>): SplitResult<K> {
  const keys = Object.keys(headings) as K[]
  const collected: Partial<Record<K, string[]>> = {}
  const unknown: string[] = []
  const duplicates: string[] = []
  let current: K | null = null
  let inFence = false

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    const heading = !inFence ? /^## +(.+?)\s*$/.exec(line) : null
    if (heading) {
      current = keys.find((k) => headings[k] === heading[1]) ?? null
      if (!current) unknown.push(heading[1])
      else if (collected[current]) duplicates.push(heading[1])
      if (current) collected[current] = []
      continue
    }
    if (current) collected[current]!.push(line)
  }

  const sections: Partial<Record<K, string>> = {}
  for (const k of keys) if (collected[k]) sections[k] = collected[k]!.join('\n').trim()
  const missing = keys.filter((k) => !collected[k]).map((k) => headings[k])
  return { sections, missing, unknown, duplicates }
}

export function splitSections(body: string): SplitResult<SectionKey> {
  return splitSectionsBy(body, SECTION_HEADINGS)
}
```

- [ ] **Step 4: Retirar `voices` del esquema**

En `lib/content/schema.ts`, borrar la línea `    voices: z.array(id).default([]),` de `nodeFrontmatterSchema`.

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test && npx tsc --noEmit -p .`
Expected: todos PASS (incluido `content-integrity`, porque ningún nodo declara `voices`); `tsc` sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/content/sections.ts lib/content/schema.ts tests/sections.test.ts tests/load.test.ts tests/dashboard.test.ts
git commit -m "refactor: splitSectionsBy genérico y retiro de voices en nodos"
```

---

### Task 2: Esquema y carga de referentes

**Files:**
- Modify: `lib/content/enums.ts`, `lib/content/schema.ts`, `lib/content/types.ts`, `lib/content/load.ts` (reemplazar completo)
- Create: `content/people/andrej-karpathy.mdx`, `content/people/3blue1brown.mdx`
- Test: `tests/load.test.ts`

**Interfaces:**
- Consumes: `splitSectionsBy`, `PERSON_SECTION_HEADINGS` (Task 1)
- Produces:
  - `LANGUAGES = ['es','en']`, `PLATFORMS = ['youtube','x','linkedin','github','blog','podcast','newsletter','site']`, `PERSON_KINDS = ['person','organization']`, `HIGHLIGHT_FORMATS = ['video','course','article','thread','podcast','book','repo']` y tipos `Language`, `Platform`, `PersonKind`, `HighlightFormat`
  - `personFrontmatterSchema`, `type PersonFrontmatter`
  - `type Person = PersonFrontmatter & { why: string }`, `type Highlight = Person['highlights'][number]`
  - `Catalog` gana `people: Person[]` (ordenados por nombre, locale `es`) y `peopleById: Map<string, Person>`

- [ ] **Step 1: Escribir los tests que fallan**

En `tests/load.test.ts`:
1. Cambiar la firma de `makeContent` para aceptar personas:

```ts
function makeContent(nodes: Record<string, string>, taxonomy = TAXONOMY, people: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expia-'))
  fs.mkdirSync(path.join(dir, 'nodes'))
  fs.writeFileSync(path.join(dir, 'taxonomy.yaml'), taxonomy)
  for (const [name, text] of Object.entries(nodes)) fs.writeFileSync(path.join(dir, 'nodes', `${name}.mdx`), text)
  if (Object.keys(people).length) {
    fs.mkdirSync(path.join(dir, 'people'))
    for (const [name, text] of Object.entries(people)) fs.writeFileSync(path.join(dir, 'people', `${name}.mdx`), text)
  }
  return dir
}
```

2. Agregar el builder y los tests:

```ts
const WHY = '## Por qué seguirle\nPorque sí.\n'
function personFile(id: string, extra: Record<string, string> = {}, body = WHY): string {
  return file({
    id, name: `"${id}"`, kind: 'person', languages: '[en]', topics: '[a]', audience: '[technical]',
    level: 'fundamentals', summary: '"resumen"',
    platforms: '{ youtube: "https://www.youtube.com/@x" }',
    highlights: '[{ title: "Video", url: "https://www.youtube.com/watch?v=1", format: video }]',
    verified: 'false', added: '2026-10-17', ...extra,
  }, body)
}
const withPerson = (people: Record<string, string>) => makeContent({ a: file(fm('a')) }, TAXONOMY, people)

describe('loadCatalog: referentes', () => {
  it('carga referentes válidos con su sección y los indexa', () => {
    const cat = loadCatalog(withPerson({ p: personFile('p'), b: personFile('b', { name: '"Ana"' }) }))
    expect(cat.people.map((x) => x.id)).toEqual(['b', 'p'])   // por nombre: "Ana" < "p"
    expect(cat.peopleById.get('p')!.why).toBe('Porque sí.')
    expect(cat.peopleById.get('p')!.highlights[0].format).toBe('video')
  })
  it('sin carpeta people el catálogo carga con people vacío', () => {
    const cat = loadCatalog(makeContent({ a: file(fm('a')) }))
    expect(cat.people).toEqual([])
    expect(cat.peopleById.size).toBe(0)
  })
  it('reporta un tema inexistente', () => {
    expect(errorsOf(withPerson({ p: personFile('p', { topics: '[zzz]' }) }))).toContain('people/p.mdx › topics: "zzz" no existe')
  })
  it('reporta el tema inexistente de un recurso destacado', () => {
    const h = '[{ title: "V", url: "https://example.com/v", format: video, topic: zzz }]'
    expect(errorsOf(withPerson({ p: personFile('p', { highlights: h }) }))).toContain('people/p.mdx › highlights.0.topic: "zzz" no existe')
  })
  it('exige al menos una plataforma', () => {
    const errs = errorsOf(withPerson({ p: personFile('p', { platforms: '{}' }) }))
    expect(errs.some((e) => e.startsWith('people/p.mdx › platforms'))).toBe(true)
  })
  it('limita los recursos destacados a 5', () => {
    const one = '{ title: "V", url: "https://example.com/v", format: video }'
    const errs = errorsOf(withPerson({ p: personFile('p', { highlights: `[${Array(6).fill(one).join(', ')}]` }) }))
    expect(errs.some((e) => e.startsWith('people/p.mdx › highlights'))).toBe(true)
  })
  it('reporta la sección faltante y las desconocidas', () => {
    expect(errorsOf(withPerson({ p: personFile('p', {}, 'texto suelto\n') }))).toContain('people/p.mdx › cuerpo: falta la sección "## Por qué seguirle"')
    expect(errorsOf(withPerson({ p: personFile('p', {}, WHY + '## Extra\nX\n') }))).toContain('people/p.mdx › cuerpo: sección desconocida "## Extra" (usa ### para subsecciones)')
  })
  it('reporta un id distinto del nombre del archivo', () => {
    const errs = errorsOf(withPerson({ p: personFile('otro') }))
    expect(errs.some((e) => e.startsWith('people/p.mdx › id:'))).toBe(true)
  })
})
```

Run: `npx vitest run tests/load.test.ts`
Expected: FAIL. `cat.people` es `undefined` y no hay errores `people/...`.

- [ ] **Step 2: Agregar enums**

Al final de `lib/content/enums.ts`, antes de `LABELS`:

```ts
export const LANGUAGES = ['es', 'en'] as const
export const PLATFORMS = ['youtube', 'x', 'linkedin', 'github', 'blog', 'podcast', 'newsletter', 'site'] as const
export const PERSON_KINDS = ['person', 'organization'] as const
export const HIGHLIGHT_FORMATS = ['video', 'course', 'article', 'thread', 'podcast', 'book', 'repo'] as const

export type Language = (typeof LANGUAGES)[number]
export type Platform = (typeof PLATFORMS)[number]
export type PersonKind = (typeof PERSON_KINDS)[number]
export type HighlightFormat = (typeof HIGHLIGHT_FORMATS)[number]
```

Y dentro de `LABELS` agregar:

```ts
  es: 'Español',
  en: 'Inglés',
  youtube: 'YouTube',
  x: 'X',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  blog: 'Blog',
  podcast: 'Podcast',
  newsletter: 'Newsletter',
  site: 'Sitio web',
  person: 'Persona',
  organization: 'Organización',
  video: 'Video',
  course: 'Curso',
  article: 'Artículo',
  thread: 'Hilo',
  book: 'Libro',
  repo: 'Repositorio',
```

- [ ] **Step 3: Agregar el esquema del referente**

En `lib/content/schema.ts`:
- Ampliar el import de enums: `import { KINDS, AUDIENCES, LEVELS, STATUSES, LICENSES, PRICINGS, LANGUAGES, PERSON_KINDS, HIGHLIGHT_FORMATS } from './enums'`
- Extraer la validación de `added` a una constante reutilizable, justo después de `released`:

```ts
const added = yamlString.refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s), 'debe ser YYYY-MM-DD')
```

  y en `nodeFrontmatterSchema` reemplazar `added: yamlString.refine(...)` por `added,`.
- Agregar al final, antes de los `export type`:

```ts
const url = z.string().url()

export const personFrontmatterSchema = z
  .object({
    id,
    name: z.string().min(1),
    kind: z.enum(PERSON_KINDS),
    languages: z.array(z.enum(LANGUAGES)).min(1),
    topics: z.array(id).min(1),
    audience: z.array(z.enum(AUDIENCES)).min(1),
    level: z.enum(LEVELS),
    summary: z.string().min(1).max(160),
    platforms: z
      .object({
        youtube: url.optional(),
        x: url.optional(),
        linkedin: url.optional(),
        github: url.optional(),
        blog: url.optional(),
        podcast: url.optional(),
        newsletter: url.optional(),
        site: url.optional(),
      })
      .strict()
      .refine((p) => Object.values(p).some(Boolean), 'debe tener al menos una plataforma'),
    highlights: z
      .array(
        z
          .object({
            title: z.string().min(1),
            url,
            format: z.enum(HIGHLIGHT_FORMATS),
            topic: id.optional(),
            language: z.enum(LANGUAGES).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(5),
    feeds: z.object({ youtubeChannelId: z.string().optional(), rss: url.optional() }).strict().optional(),
    verified: z.boolean(),
    added,
  })
  .strict()
```

- Y agregar el tipo: `export type PersonFrontmatter = z.infer<typeof personFrontmatterSchema>`

- [ ] **Step 4: Ampliar los tipos**

Reemplazar `lib/content/types.ts`:

```ts
import type { ReleasedDate } from '@/lib/dates'
import type { NodeFrontmatter, PersonFrontmatter, Category } from './schema'
import type { NodeSections } from './sections'

export type NodeMeta = NodeFrontmatter & { date: ReleasedDate }
export type CatalogNode = NodeMeta & { sections: NodeSections }
export type Person = PersonFrontmatter & { why: string }
export type Highlight = Person['highlights'][number]

export interface Catalog {
  nodes: CatalogNode[]
  byId: Map<string, CatalogNode>
  categories: Category[]
  people: Person[]
  peopleById: Map<string, Person>
}

export function toMeta(n: CatalogNode): NodeMeta {
  const { sections: _sections, ...meta } = n
  return meta
}
```

- [ ] **Step 5: Reemplazar `lib/content/load.ts`**

```ts
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { load, JSON_SCHEMA } from 'js-yaml'
import type { ZodIssue } from 'zod'
import { nodeFrontmatterSchema, personFrontmatterSchema, taxonomySchema } from './schema'
import { splitSections, splitSectionsBy, PERSON_SECTION_HEADINGS, type NodeSections } from './sections'
import type { Catalog, CatalogNode, Person } from './types'
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

  if (errors.length) throw new ContentError(errors)
  nodes.sort((a, b) => compareDates(a.date, b.date) || a.id.localeCompare(b.id))
  people.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return {
    nodes,
    byId,
    categories: tax.data.categories,
    people,
    peopleById: new Map(people.map((p) => [p.id, p])),
  }
}

let cached: Catalog | undefined
export function getCatalog(): Catalog {
  return (cached ??= loadCatalog())
}
```

Run: `npx vitest run tests/load.test.ts`
Expected: PASS

- [ ] **Step 6: Crear los 2 referentes iniciales**

`content/people/andrej-karpathy.mdx`:

```mdx
---
id: andrej-karpathy
name: "Andrej Karpathy"
kind: person
languages: [en]
topics: [llm, neural-network, deep-learning, backpropagation, transformer, tokenization]
audience: [technical]
level: intermediate
summary: "Cofundador de OpenAI y ex director de IA en Tesla; explica redes neuronales y LLMs construyéndolos desde cero en código."
platforms:
  youtube: https://www.youtube.com/@AndrejKarpathy
  x: https://x.com/karpathy
  github: https://github.com/karpathy
  blog: https://karpathy.github.io
highlights:
  - title: "The spelled-out intro to neural networks and backpropagation: building micrograd"
    url: https://www.youtube.com/watch?v=VMj-3S1tku0
    format: video
    topic: backpropagation
  - title: "Let's build GPT: from scratch, in code, spelled out"
    url: https://www.youtube.com/watch?v=kCc8FmEb1nY
    format: video
    topic: transformer
  - title: "Let's build the GPT Tokenizer"
    url: https://www.youtube.com/watch?v=zduSFxRajkE
    format: video
    topic: tokenization
  - title: "Intro to Large Language Models"
    url: https://www.youtube.com/watch?v=zjkBMFhNj_g
    format: video
    topic: llm
verified: false
added: 2026-10-17
---

## Por qué seguirle

Karpathy tiene un don poco común: explica las ideas más importantes de la IA moderna escribiendo el código línea por línea, sin atajos ni librerías mágicas. Su serie "Neural Networks: Zero to Hero" lleva desde una red neuronal mínima hasta un GPT funcional.

Es ideal para desarrolladores que quieren entender qué pasa realmente dentro de un modelo. Su charla "Intro to Large Language Models" también funciona para perfiles no técnicos curiosos.
```

`content/people/3blue1brown.mdx`:

```mdx
---
id: 3blue1brown
name: "3Blue1Brown (Grant Sanderson)"
kind: person
languages: [en]
topics: [neural-network, deep-learning, backpropagation, transformer, attention, llm]
audience: [technical, business]
level: fundamentals
summary: "Animaciones matemáticas que explican visualmente cómo funcionan las redes neuronales y los Transformers."
platforms:
  youtube: https://www.youtube.com/@3blue1brown
  site: https://www.3blue1brown.com
highlights:
  - title: "But what is a neural network? | Deep learning chapter 1"
    url: https://www.youtube.com/watch?v=aircAruvnKk
    format: video
    topic: neural-network
  - title: "Transformers (how LLMs work) explained visually"
    url: https://www.youtube.com/watch?v=wjZofJX0v4M
    format: video
    topic: transformer
verified: false
added: 2026-10-17
---

## Por qué seguirle

Grant Sanderson convierte conceptos abstractos en animaciones que se entienden casi sin fórmulas. Su serie sobre deep learning es, para muchos, la mejor primera explicación de qué es una red neuronal y cómo aprende.

Sirve tanto a principiantes técnicos como a perfiles de negocio que quieren una intuición sólida antes de profundizar.
```

- [ ] **Step 7: Verificar**

Run: `npm test && npx tsc --noEmit -p .`
Expected: todos PASS (`content-integrity` valida también los 2 referentes); `tsc` sin errores.

- [ ] **Step 8: Commit**

```bash
git add lib/content content/people tests/load.test.ts
git commit -m "feat: esquema y carga de referentes con reglas de integridad"
```

---

### Task 3: `lib/people.ts`

**Files:**
- Create: `lib/people.ts`
- Test: `tests/people.test.ts`

**Interfaces:**
- Consumes: `Person`, `Highlight` (Task 2); `AudiencePref` (`lib/audience.ts`); `Language` (Task 2)
- Produces:
  - `interface TopicHighlight { person: Person; highlight: Highlight }`
  - `getHighlightsForTopic(people: Person[], nodeId: string): TopicHighlight[]`
  - `getVoicesForTopic(people: Person[], nodeId: string, pref?: AudiencePref): Person[]` (solo los que tienen el tema en `topics`; orden estable por puntaje)
  - `findUncoveredFundamentals(nodes: { id: string; level: string }[], people: { topics: string[] }[]): string[]`
  - `selectStarterPeople(people: Person[], limit?: number): Person[]` (por defecto 6)
  - `highlightLanguage(person: Pick<Person, 'languages'>, h: Pick<Highlight, 'language'>): Language`
  - `resolveTopic(topics: { id: string; title: string }[], text: string): string | undefined`

- [ ] **Step 1: Escribir el test que falla**

`tests/people.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  getHighlightsForTopic, getVoicesForTopic, findUncoveredFundamentals,
  selectStarterPeople, highlightLanguage, resolveTopic,
} from '@/lib/people'
import type { Person } from '@/lib/content/types'

const person = (id: string, o: Partial<Person> = {}): Person => ({
  id, name: id, kind: 'person', languages: ['en'], topics: ['rag'], audience: ['technical'], level: 'intermediate',
  summary: 's', platforms: { youtube: 'https://www.youtube.com/@x' },
  highlights: [{ title: 'h', url: `https://example.com/${id}`, format: 'video' }],
  verified: false, added: '2026-10-17', why: 'w', ...o,
})

describe('getHighlightsForTopic', () => {
  it('devuelve los recursos sobre el tema con su autor', () => {
    const p = person('p', { highlights: [
      { title: 'sobre rag', url: 'https://e.com/1', format: 'video', topic: 'rag' },
      { title: 'otro', url: 'https://e.com/2', format: 'article', topic: 'llm' },
    ] })
    const res = getHighlightsForTopic([p, person('q')], 'rag')
    expect(res.map((r) => [r.person.id, r.highlight.title])).toEqual([['p', 'sobre rag']])
  })
})

describe('getVoicesForTopic', () => {
  const plain = person('plain')
  const withHighlight = person('hl', { highlights: [{ title: 'x', url: 'https://e.com/x', format: 'video', topic: 'rag' }] })
  const business = person('biz', { audience: ['business'] })
  const offTopic = person('off', { topics: ['llm'] })
  const all = [plain, withHighlight, business, offTopic]

  it('filtra por tema y prioriza a quien tiene un recurso sobre el tema', () => {
    expect(getVoicesForTopic(all, 'rag').map((p) => p.id)).toEqual(['hl', 'plain', 'biz'])
  })
  it('con audiencia business prioriza los perfiles business', () => {
    expect(getVoicesForTopic(all, 'rag', 'business').map((p) => p.id)).toEqual(['biz', 'hl', 'plain'])
  })
})

describe('findUncoveredFundamentals', () => {
  it('lista los fundamentos que nadie cubre', () => {
    const nodes = [{ id: 'a', level: 'fundamentals' }, { id: 'b', level: 'fundamentals' }, { id: 'c', level: 'advanced' }]
    expect(findUncoveredFundamentals(nodes, [{ topics: ['a', 'c'] }])).toEqual(['b'])
  })
})

describe('selectStarterPeople', () => {
  it('toma nivel fundamentals, español primero, con límite', () => {
    const people = [
      person('en1', { name: 'B', level: 'fundamentals' }),
      person('es1', { name: 'Z', level: 'fundamentals', languages: ['es'] }),
      person('adv', { level: 'advanced', languages: ['es'] }),
      person('en2', { name: 'A', level: 'fundamentals' }),
    ]
    expect(selectStarterPeople(people).map((p) => p.id)).toEqual(['es1', 'en2', 'en1'])
    expect(selectStarterPeople(people, 1).map((p) => p.id)).toEqual(['es1'])
  })
})

describe('highlightLanguage', () => {
  it('usa el idioma del recurso o el primero de la persona', () => {
    expect(highlightLanguage({ languages: ['es', 'en'] }, {})).toBe('es')
    expect(highlightLanguage({ languages: ['es', 'en'] }, { language: 'en' })).toBe('en')
  })
})

describe('resolveTopic', () => {
  const topics = [{ id: 'rag', title: 'RAG (Retrieval-Augmented Generation)' }, { id: 'llm', title: 'LLM' }]
  it('resuelve por título ignorando mayúsculas y espacios', () => {
    expect(resolveTopic(topics, '  llm ')).toBe('llm')
    expect(resolveTopic(topics, 'rag (retrieval-augmented generation)')).toBe('rag')
  })
  it('devuelve undefined si el texto no coincide', () => {
    expect(resolveTopic(topics, 'ra')).toBeUndefined()
    expect(resolveTopic(topics, '')).toBeUndefined()
  })
})
```

Run: `npx vitest run tests/people.test.ts`
Expected: FAIL. `Failed to resolve import "@/lib/people"`.

- [ ] **Step 2: Implementar `lib/people.ts`**

```ts
import type { AudiencePref } from '@/lib/audience'
import type { Language } from '@/lib/content/enums'
import type { Highlight, Person } from '@/lib/content/types'

export interface TopicHighlight {
  person: Person
  highlight: Highlight
}

export function getHighlightsForTopic(people: Person[], nodeId: string): TopicHighlight[] {
  return people.flatMap((person) =>
    person.highlights.filter((h) => h.topic === nodeId).map((highlight) => ({ person, highlight })),
  )
}

export function getVoicesForTopic(people: Person[], nodeId: string, pref: AudiencePref = 'all'): Person[] {
  const score = (p: Person) =>
    (pref === 'business' && p.audience.includes('business') ? 2 : 0) +
    (p.highlights.some((h) => h.topic === nodeId) ? 1 : 0)
  return people
    .filter((p) => p.topics.includes(nodeId))
    .map((p, i) => ({ p, i, s: score(p) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p)
}

export function findUncoveredFundamentals(nodes: { id: string; level: string }[], people: { topics: string[] }[]): string[] {
  const covered = new Set(people.flatMap((p) => p.topics))
  return nodes.filter((n) => n.level === 'fundamentals' && !covered.has(n.id)).map((n) => n.id)
}

export function selectStarterPeople(people: Person[], limit = 6): Person[] {
  const es = (p: Person) => (p.languages.includes('es') ? 0 : 1)
  return people
    .filter((p) => p.level === 'fundamentals')
    .sort((a, b) => es(a) - es(b) || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit)
}

export function highlightLanguage(person: Pick<Person, 'languages'>, h: Pick<Highlight, 'language'>): Language {
  return h.language ?? person.languages[0]
}

export function resolveTopic(topics: { id: string; title: string }[], text: string): string | undefined {
  const needle = text.trim().toLowerCase()
  if (!needle) return undefined
  return topics.find((t) => t.title.toLowerCase() === needle)?.id
}
```

Run: `npx vitest run tests/people.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/people.ts tests/people.test.ts
git commit -m "feat: lib/people con índice inverso por tema, cobertura y utilidades"
```

---

### Task 4: Filtros y búsqueda de personas

**Files:**
- Modify: `lib/filters.ts`, `lib/search.ts`
- Test: `tests/filters.test.ts`, `tests/search.test.ts`

**Interfaces:**
- Consumes: enums de Task 2
- Produces:
  - `matchAny`, `matchOptional` pasan a ser `export`
  - `interface PeopleFilters { q: string; topic: string[]; lang: Language[]; platform: Platform[]; aud: Audience[]; level: Level[]; kind: PersonKind[] }`
  - `EMPTY_PEOPLE_FILTERS: PeopleFilters`
  - `interface FilterablePerson { topics: string[]; languages: Language[]; platforms: Partial<Record<Platform, string>>; audience: Audience[]; level: Level; kind: PersonKind }`
  - `parsePeopleFilters(params: URLSearchParams, knownTopics?: readonly string[]): PeopleFilters`
  - `serializePeopleFilters(f: PeopleFilters): string`
  - `applyPeopleFilters<T extends FilterablePerson>(people: T[], f: PeopleFilters): T[]`
  - `createSearch<T>(items: T[], keys?: string[]): (q: string) => T[]` (por defecto `['title','summary','category']`)

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `tests/filters.test.ts` (y ampliar el import con `parsePeopleFilters, serializePeopleFilters, applyPeopleFilters, EMPTY_PEOPLE_FILTERS, type FilterablePerson, type PeopleFilters`):

```ts
describe('filtros de personas', () => {
  const TOPICS = ['rag', 'llm']
  const pp = (qs: string) => parsePeopleFilters(new URLSearchParams(qs), TOPICS)
  type P = FilterablePerson & { id: string }
  const person = (id: string, o: Partial<FilterablePerson> = {}): P => ({
    id, topics: ['llm'], languages: ['en'], platforms: { youtube: 'https://y.com' },
    audience: ['technical'], level: 'intermediate', kind: 'person', ...o,
  })
  const people = [
    person('en'),
    person('bi', { languages: ['en', 'es'], topics: ['rag'], platforms: { x: 'https://x.com/a' } }),
    person('es', { languages: ['es'], kind: 'organization', platforms: { youtube: 'https://y.com', x: undefined } }),
  ]
  const ids = (f: Partial<PeopleFilters>) => applyPeopleFilters(people, { ...EMPTY_PEOPLE_FILTERS, ...f }).map((p) => p.id)

  it('ignora valores inválidos en la URL', () => {
    const f = pp('lang=fr,es&topic=nope,rag&platform=tiktok&kind=alien')
    expect(f.lang).toEqual(['es'])
    expect(f.topic).toEqual(['rag'])
    expect(f.platform).toEqual([])
    expect(f.kind).toEqual([])
  })
  it('hace ida y vuelta', () => {
    const f: PeopleFilters = { ...EMPTY_PEOPLE_FILTERS, q: 'ana, b', topic: ['rag'], lang: ['es', 'en'], platform: ['youtube'] }
    expect(pp(serializePeopleFilters(f))).toEqual(f)
    expect(serializePeopleFilters(EMPTY_PEOPLE_FILTERS)).toBe('')
  })
  it('un referente bilingüe aparece con cualquiera de sus idiomas', () => {
    expect(ids({ lang: ['es'] })).toEqual(['bi', 'es'])
    expect(ids({ lang: ['en'] })).toEqual(['en', 'bi'])
  })
  it('filtra por plataforma ignorando claves vacías', () => {
    expect(ids({ platform: ['x'] })).toEqual(['bi'])
  })
  it('combina grupos con AND', () => {
    expect(ids({ lang: ['es'], kind: ['organization'] })).toEqual(['es'])
    expect(ids({ topic: ['rag'], lang: ['en'] })).toEqual(['bi'])
  })
})
```

Agregar a `tests/search.test.ts`:

```ts
describe('createSearch con claves propias', () => {
  it('busca personas por nombre y resumen', () => {
    const people = [{ id: 'k', name: 'Andrej Karpathy', summary: 'LLMs desde cero' }, { id: 'd', name: 'DotCSV', summary: 'Divulgación en español' }]
    const search = createSearch(people, ['name', 'summary'])
    expect(search('karpathy').map((p) => p.id)).toEqual(['k'])
    expect(search('español').map((p) => p.id)).toEqual(['d'])
  })
})
```

Run: `npx vitest run tests/filters.test.ts tests/search.test.ts`
Expected: FAIL. Las funciones de personas no existen.

- [ ] **Step 2: Implementar los filtros de personas**

En `lib/filters.ts`:
1. Ampliar el import de enums con `LANGUAGES, PLATFORMS, PERSON_KINDS, type Language, type Platform, type PersonKind`.
2. Cambiar `function matchAny` por `export function matchAny` y `function matchOptional` por `export function matchOptional`.
3. Agregar, justo antes de `export function serializeFilters`, un helper compartido:

```ts
function encodeList(key: string, values: readonly string[]): string[] {
  return values.length ? [`${key}=${values.map(encodeURIComponent).join(',')}`] : []
}
```

   y dentro de `serializeFilters` reemplazar el cuerpo del `for (const key of LIST_KEYS)` por `parts.push(...encodeList(key, f[key] as string[]))`.
4. Agregar al final del archivo:

```ts
export interface PeopleFilters {
  q: string
  topic: string[]
  lang: Language[]
  platform: Platform[]
  aud: Audience[]
  level: Level[]
  kind: PersonKind[]
}

export const EMPTY_PEOPLE_FILTERS: PeopleFilters = { q: '', topic: [], lang: [], platform: [], aud: [], level: [], kind: [] }

export interface FilterablePerson {
  topics: string[]
  languages: Language[]
  platforms: Partial<Record<Platform, string>>
  audience: Audience[]
  level: Level
  kind: PersonKind
}

const PEOPLE_LIST_KEYS = ['topic', 'lang', 'platform', 'aud', 'level', 'kind'] as const

export function parsePeopleFilters(params: URLSearchParams, knownTopics?: readonly string[]): PeopleFilters {
  return {
    q: params.get('q') ?? '',
    topic: parseList(params, 'topic', knownTopics),
    lang: parseList(params, 'lang', LANGUAGES),
    platform: parseList(params, 'platform', PLATFORMS),
    aud: parseList(params, 'aud', AUDIENCES),
    level: parseList(params, 'level', LEVELS),
    kind: parseList(params, 'kind', PERSON_KINDS),
  }
}

export function serializePeopleFilters(f: PeopleFilters): string {
  const parts = f.q ? [`q=${encodeURIComponent(f.q)}`] : []
  for (const key of PEOPLE_LIST_KEYS) parts.push(...encodeList(key, f[key]))
  return parts.join('&')
}

export function applyPeopleFilters<T extends FilterablePerson>(people: T[], f: PeopleFilters): T[] {
  return people.filter((p) =>
    matchAny(f.topic, p.topics) &&
    matchAny(f.lang, p.languages) &&
    matchAny(f.platform, (Object.keys(p.platforms) as Platform[]).filter((k) => p.platforms[k])) &&
    matchAny(f.aud, p.audience) &&
    matchAny(f.level, [p.level]) &&
    matchAny(f.kind, [p.kind]),
  )
}
```

- [ ] **Step 3: Hacer configurables las claves de búsqueda**

Reemplazar `lib/search.ts`:

```ts
import Fuse from 'fuse.js'

export function createSearch<T>(items: T[], keys: string[] = ['title', 'summary', 'category']) {
  const fuse = new Fuse(items, { keys, threshold: 0.35, ignoreLocation: true })
  return (q: string): T[] => {
    const query = q.trim()
    return query ? fuse.search(query).map((r) => r.item) : items
  }
}
```

- [ ] **Step 4: Verificar**

Run: `npm test && npx tsc --noEmit -p .`
Expected: todos PASS; `tsc` sin errores.

- [ ] **Step 5: Commit**

```bash
git add lib/filters.ts lib/search.ts tests/filters.test.ts tests/search.test.ts
git commit -m "feat: filtros y búsqueda de referentes con las reglas del catálogo"
```

---

### Task 5: Hook de URL genérico

**Files:**
- Modify: `hooks/use-url-filters.ts` (reemplazar completo)

**Interfaces:**
- Consumes: `parseFilters`, `serializeFilters`, `parsePeopleFilters`, `serializePeopleFilters` (Task 4)
- Produces:
  - `useUrlState<T>(parse: (p: URLSearchParams) => T, serialize: (v: T) => string): [T, (v: T) => void]`
  - `useUrlFilters(categoryIds: readonly string[]): [Filters, (f: Filters) => void]` (misma API que hoy)
  - `useUrlPeopleFilters(topicIds: readonly string[]): [PeopleFilters, (f: PeopleFilters) => void]`

- [ ] **Step 1: Reemplazar el hook**

```ts
'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  parseFilters, serializeFilters, parsePeopleFilters, serializePeopleFilters,
  type Filters, type PeopleFilters,
} from '@/lib/filters'

// El estado local es la fuente de verdad para renderizar; la URL solo se sincroniza.
// router.replace pediría un payload RSC por cada tecla y, con latencia, perdería
// caracteres y clics. history.replaceState no hace petición y Next lo integra con useSearchParams.
export function useUrlState<T>(parse: (params: URLSearchParams) => T, serialize: (value: T) => string): [T, (value: T) => void] {
  const params = useSearchParams()
  const [value, setLocal] = useState(() => parse(new URLSearchParams(params.toString())))

  useEffect(() => {
    const onPopState = () => setLocal(parse(new URLSearchParams(window.location.search)))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [parse])

  const setValue = useCallback(
    (v: T) => {
      setLocal(v)
      const qs = serialize(v)
      window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
    },
    [serialize],
  )

  return [value, setValue]
}

export function useUrlFilters(categoryIds: readonly string[]): [Filters, (f: Filters) => void] {
  const parse = useCallback((p: URLSearchParams) => parseFilters(p, categoryIds), [categoryIds])
  return useUrlState(parse, serializeFilters)
}

export function useUrlPeopleFilters(topicIds: readonly string[]): [PeopleFilters, (f: PeopleFilters) => void] {
  const parse = useCallback((p: URLSearchParams) => parsePeopleFilters(p, topicIds), [topicIds])
  return useUrlState(parse, serializePeopleFilters)
}
```

- [ ] **Step 2: Verificar que no se rompió nada (la barrera es el E2E existente, incluido el de latencia)**

Run: `npx tsc --noEmit -p . && npm run test:e2e`
Expected: `tsc` sin errores; 8/8 E2E PASS.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-url-filters.ts
git commit -m "refactor: useUrlState genérico compartido por nodos y referentes"
```

---

### Task 6: Componentes base y `/people`

**Files:**
- Create: `components/chip-group.tsx`, `components/platform-links.tsx`, `components/person-card.tsx`, `components/topic-picker.tsx`, `components/people-filter-bar.tsx`, `components/people-client.tsx`, `app/people/page.tsx`
- Modify: `components/filter-bar.tsx`, `components/site-header.tsx`

**Interfaces:**
- Consumes: `useUrlPeopleFilters` (Task 5); `applyPeopleFilters`, `EMPTY_PEOPLE_FILTERS`, `toggleValue` (Task 4); `createSearch` (Task 4); `resolveTopic` (Task 3); `Person` (Task 2)
- Produces: `<ChipGroup label options selected onToggle />`, `type Option`, `enumOptions(values)`, `<PlatformLinks platforms />`, `<PersonCard person topicTitles />` (con `data-testid="person-card"` y `data-languages="es,en"`), `<TopicPicker topics selected onChange />`, `<PeopleFilterBar … />`, `<PeopleClient people topics />`

- [ ] **Step 1: Extraer `ChipGroup`**

Crear `components/chip-group.tsx`:

```tsx
'use client'
import { LABELS } from '@/lib/content/enums'

export type Option = { value: string; label: string; color?: string }

export const enumOptions = (values: readonly string[]): Option[] => values.map((v) => ({ value: v, label: LABELS[v] }))

export function ChipGroup({ label, options, selected, onToggle }: { label: string; options: Option[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-20 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      {options.map((o) => {
        const active = selected.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(o.value)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition ${active ? 'border-foreground bg-foreground text-background' : 'hover:border-foreground/40'}`}
          >
            {o.color && <span className="size-2 rounded-full" style={{ background: o.color }} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
```

En `components/filter-bar.tsx`: borrar `type Option`, la función `ChipGroup` y la constante `enumOptions`; quitar `LABELS` del import de enums; agregar `import { ChipGroup, enumOptions, type Option } from './chip-group'`.

- [ ] **Step 2: Crear `PlatformLinks`, `PersonCard` y `TopicPicker`**

`components/platform-links.tsx`:

```tsx
import { LABELS, PLATFORMS, type Platform } from '@/lib/content/enums'

export function PlatformLinks({ platforms }: { platforms: Partial<Record<Platform, string>> }) {
  const entries = PLATFORMS.filter((p) => platforms[p]).map((p) => [p, platforms[p]!] as const)
  return (
    <ul className="flex flex-wrap gap-2 text-sm">
      {entries.map(([p, url]) => (
        <li key={p}>
          <a href={url} target="_blank" rel="noreferrer" className="inline-block rounded-md border px-2 py-0.5 hover:border-foreground/40">
            {LABELS[p]}
          </a>
        </li>
      ))}
    </ul>
  )
}
```

`components/person-card.tsx`:

```tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { LABELS, PLATFORMS } from '@/lib/content/enums'
import type { Person } from '@/lib/content/types'

export function PersonCard({ person, topicTitles }: { person: Person; topicTitles: Record<string, string> }) {
  const platforms = PLATFORMS.filter((p) => person.platforms[p])
  return (
    <Link
      href={`/people/${person.id}`}
      data-testid="person-card"
      data-languages={person.languages.join(',')}
      className="block rounded-lg border p-4 transition hover:border-foreground/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">{person.name}</h3>
        <div className="flex shrink-0 gap-1">
          {person.languages.map((l) => <Badge key={l} variant="outline">{l.toUpperCase()}</Badge>)}
        </div>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{person.summary}</p>
      <p className="mt-2 text-xs text-muted-foreground">{platforms.map((p) => LABELS[p]).join(' · ')}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {person.topics.slice(0, 4).map((t) => <Badge key={t} variant="secondary">{topicTitles[t] ?? t}</Badge>)}
        {person.topics.length > 4 && <span className="text-xs text-muted-foreground">+{person.topics.length - 4}</span>}
      </div>
    </Link>
  )
}
```

`components/topic-picker.tsx`:

```tsx
'use client'
import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { resolveTopic } from '@/lib/people'

export function TopicPicker({ topics, selected, onChange }: { topics: { id: string; title: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const listId = useId()
  const [text, setText] = useState('')
  const titleOf = new Map(topics.map((t) => [t.id, t.title]))
  const tryAdd = (value: string) => {
    const id = resolveTopic(topics, value)
    if (!id) return
    if (!selected.includes(id)) onChange([...selected, id])
    setText('')
  }
  return (
    <div role="group" aria-label="Tema" className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-20 shrink-0 text-xs font-medium text-muted-foreground">Tema</span>
      <Input
        list={listId}
        placeholder="Agregar tema…"
        aria-label="Agregar tema"
        className="h-8 w-56"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          tryAdd(e.target.value)
        }}
        onKeyDown={(e) => e.key === 'Enter' && tryAdd(text)}
      />
      <datalist id={listId}>
        {topics.map((t) => <option key={t.id} value={t.title} />)}
      </datalist>
      {selected.map((id) => (
        <button
          key={id}
          type="button"
          aria-label={`Quitar ${titleOf.get(id) ?? id}`}
          onClick={() => onChange(selected.filter((s) => s !== id))}
          className="inline-flex items-center gap-1 rounded-full border border-foreground bg-foreground px-2.5 py-0.5 text-xs text-background"
        >
          {titleOf.get(id) ?? id} ×
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Crear la barra de filtros, el cliente y la página**

`components/people-filter-bar.tsx`:

```tsx
'use client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChipGroup, enumOptions } from './chip-group'
import { TopicPicker } from './topic-picker'
import { LANGUAGES, PLATFORMS, AUDIENCES, LEVELS, PERSON_KINDS } from '@/lib/content/enums'
import { EMPTY_PEOPLE_FILTERS, toggleValue, type PeopleFilters } from '@/lib/filters'

type ListKey = 'lang' | 'platform' | 'aud' | 'level' | 'kind'

export function PeopleFilterBar({ topics, filters, onChange }: { topics: { id: string; title: string }[]; filters: PeopleFilters; onChange: (f: PeopleFilters) => void }) {
  const toggle = (key: ListKey, v: string) => onChange({ ...filters, [key]: toggleValue(filters[key] as string[], v) } as PeopleFilters)
  const groups: { key: ListKey; label: string; values: readonly string[] }[] = [
    { key: 'lang', label: 'Idioma', values: LANGUAGES },
    { key: 'platform', label: 'Plataforma', values: PLATFORMS },
    { key: 'aud', label: 'Audiencia', values: AUDIENCES },
    { key: 'level', label: 'Nivel', values: LEVELS },
    { key: 'kind', label: 'Tipo', values: PERSON_KINDS },
  ]
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Input placeholder="Buscar referentes…" value={filters.q} onChange={(e) => onChange({ ...filters, q: e.target.value })} />
      <TopicPicker topics={topics} selected={filters.topic} onChange={(topic) => onChange({ ...filters, topic })} />
      {groups.map((g) => (
        <ChipGroup key={g.key} label={g.label} options={enumOptions(g.values)} selected={filters[g.key] as string[]} onToggle={(v) => toggle(g.key, v)} />
      ))}
      <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_PEOPLE_FILTERS)}>Limpiar filtros</Button>
    </div>
  )
}
```

`components/people-client.tsx`:

```tsx
'use client'
import { useMemo } from 'react'
import { PeopleFilterBar } from './people-filter-bar'
import { PersonCard } from './person-card'
import { Button } from '@/components/ui/button'
import { useUrlPeopleFilters } from '@/hooks/use-url-filters'
import { applyPeopleFilters, EMPTY_PEOPLE_FILTERS } from '@/lib/filters'
import { createSearch } from '@/lib/search'
import type { Person } from '@/lib/content/types'

export function PeopleClient({ people, topics }: { people: Person[]; topics: { id: string; title: string }[] }) {
  const topicIds = useMemo(() => topics.map((t) => t.id), [topics])
  const topicTitles = useMemo(() => Object.fromEntries(topics.map((t) => [t.id, t.title])), [topics])
  const [filters, setFilters] = useUrlPeopleFilters(topicIds)
  const search = useMemo(() => createSearch(people, ['name', 'summary']), [people])
  const results = useMemo(() => applyPeopleFilters(search(filters.q), filters), [search, filters])

  return (
    <div className="space-y-6">
      <PeopleFilterBar topics={topics} filters={filters} onChange={setFilters} />
      <p className="text-sm text-muted-foreground">{results.length} de {people.length} referentes</p>
      {results.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground">Ningún referente coincide con estos filtros.</p>
          <Button variant="link" onClick={() => setFilters(EMPTY_PEOPLE_FILTERS)}>Limpiar filtros</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => <PersonCard key={p.id} person={p} topicTitles={topicTitles} />)}
        </div>
      )}
    </div>
  )
}
```

`app/people/page.tsx`:

```tsx
import { Suspense } from 'react'
import { getCatalog } from '@/lib/content/load'
import { PeopleClient } from '@/components/people-client'

export const metadata = { title: 'Referentes' }

export default function PeoplePage() {
  const { people, nodes } = getCatalog()
  const topics = nodes.map((n) => ({ id: n.id, title: n.title })).sort((a, b) => a.title.localeCompare(b.title, 'es'))
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Referentes</h1>
      <p className="max-w-2xl text-muted-foreground">Personas y organizaciones que vale la pena seguir para aprender IA, con sus mejores recursos.</p>
      <Suspense>
        <PeopleClient people={people} topics={topics} />
      </Suspense>
    </div>
  )
}
```

En `components/site-header.tsx`, en `NAV`, insertar `{ href: '/people', label: 'Referentes' },` entre Explorar y Mapa.

- [ ] **Step 4: Verificar**

Run: `npm test && npx tsc --noEmit -p . && npm run build`
Expected: PASS; la compilación lista `/people` como estática (○).

Run: `npm run test:e2e`
Expected: 8/8 PASS (el refactor de `ChipGroup` no rompe Explorar).

- [ ] **Step 5: Commit**

```bash
git add components app/people
git commit -m "feat: página de referentes con filtros por tema, idioma y plataforma"
```

---

### Task 7: Perfil `/people/[id]`

**Files:**
- Create: `components/highlight-list.tsx`, `app/people/[id]/page.tsx`

**Interfaces:**
- Consumes: `getCatalog`, `Person` (Task 2); `PlatformLinks` (Task 6); `Markdown` (subproyecto 1); `highlightLanguage` (Task 3); `LABELS`
- Produces: `<HighlightList person topicTitles />`

- [ ] **Step 1: Crear `HighlightList`**

```tsx
import Link from 'next/link'
import { LABELS } from '@/lib/content/enums'
import { highlightLanguage } from '@/lib/people'
import type { Person } from '@/lib/content/types'

export function HighlightList({ person, topicTitles }: { person: Person; topicTitles: Record<string, string> }) {
  return (
    <ul className="space-y-3">
      {person.highlights.map((h) => (
        <li key={h.url} className="rounded-lg border p-3">
          <a href={h.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{h.title}</a>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{LABELS[h.format]}</span>
            <span>{highlightLanguage(person, h).toUpperCase()}</span>
            {h.topic && (
              <Link href={`/node/${h.topic}`} className="underline underline-offset-2">{topicTitles[h.topic] ?? h.topic}</Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: Crear la página**

`app/people/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalog } from '@/lib/content/load'
import { LABELS } from '@/lib/content/enums'
import { Badge } from '@/components/ui/badge'
import { Markdown } from '@/components/markdown'
import { PlatformLinks } from '@/components/platform-links'
import { HighlightList } from '@/components/highlight-list'

type Props = { params: Promise<{ id: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return getCatalog().people.map((p) => ({ id: p.id }))
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const person = getCatalog().peopleById.get(id)
  return person ? { title: person.name, description: person.summary } : {}
}

export default async function PersonPage({ params }: Props) {
  const { id } = await params
  const { peopleById, byId } = getCatalog()
  const person = peopleById.get(id)
  if (!person) notFound()
  const topicTitles = Object.fromEntries(person.topics.concat(person.highlights.flatMap((h) => (h.topic ? [h.topic] : []))).map((t) => [t, byId.get(t)!.title]))

  return (
    <article className="max-w-3xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">{person.name}</h1>
        <p className="text-lg text-muted-foreground">{person.summary}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">{LABELS[person.kind]}</Badge>
          <Badge variant="outline">{LABELS[person.level]}</Badge>
          {person.languages.map((l) => <Badge key={l} variant="outline">{LABELS[l]}</Badge>)}
        </div>
        <PlatformLinks platforms={person.platforms} />
        {!person.verified && (
          <p role="note" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            Perfil sin verificar: los enlaces y recursos aún no han sido revisados por una persona.
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Por qué seguirle</h2>
        <Markdown source={person.why} />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Recursos destacados</h2>
        <HighlightList person={person} topicTitles={topicTitles} />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Temas</h2>
        <div className="flex flex-wrap gap-2">
          {person.topics.map((t) => (
            <Link key={t} href={`/node/${t}`} className="rounded-full border px-3 py-1 text-sm hover:border-foreground/40">{topicTitles[t]}</Link>
          ))}
        </div>
      </section>
    </article>
  )
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit -p . && npm run build`
Expected: sin errores; la salida muestra `/people/[id]` con 2 rutas pre-generadas (●).

Run: `npx next start -p 3123` en segundo plano; `curl -s localhost:3123/people/andrej-karpathy | grep -c "Recursos destacados"` → `1`; `curl -s -o /dev/null -w "%{http_code}" localhost:3123/people/nadie` → `404`. Detener el servidor.

- [ ] **Step 4: Commit**

```bash
git add components/highlight-list.tsx "app/people/[id]"
git commit -m "feat: perfil de referente con redes, por qué seguirle y recursos destacados"
```

---

### Task 8: "Quién habla de esto" en las fichas y bloque del dashboard

**Files:**
- Create: `components/voices-for-topic.tsx`
- Modify: `app/node/[id]/page.tsx`, `app/page.tsx`

**Interfaces:**
- Consumes: `getVoicesForTopic`, `getHighlightsForTopic`, `selectStarterPeople`, `highlightLanguage`, `TopicHighlight` (Task 3); `useAudience`; `PersonCard` (Task 6)
- Produces: `<VoicesForTopic nodeId nodeTitle voices highlights />` (con `data-testid="voices-for-topic"`; no renderiza nada si no hay referentes ni recursos)

- [ ] **Step 1: Crear el componente**

`components/voices-for-topic.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { useAudience } from './audience-provider'
import { LABELS } from '@/lib/content/enums'
import { getVoicesForTopic, highlightLanguage, type TopicHighlight } from '@/lib/people'
import type { Person } from '@/lib/content/types'

export function VoicesForTopic({ nodeId, nodeTitle, voices, highlights }: { nodeId: string; nodeTitle: string; voices: Person[]; highlights: TopicHighlight[] }) {
  const { audience } = useAudience()
  if (voices.length === 0 && highlights.length === 0) return null
  const ordered = getVoicesForTopic(voices, nodeId, audience).slice(0, 6)

  return (
    <section data-testid="voices-for-topic">
      <h2 className="mb-2 font-semibold">Quién habla de esto</h2>
      {highlights.length > 0 && (
        <ul className="mb-3 space-y-2 text-sm">
          {highlights.map(({ person, highlight }) => (
            <li key={highlight.url}>
              <a href={highlight.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{highlight.title}</a>
              <p className="text-xs text-muted-foreground">
                {person.name} · {LABELS[highlight.format]} · {highlightLanguage(person, highlight).toUpperCase()}
              </p>
            </li>
          ))}
        </ul>
      )}
      {ordered.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {ordered.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <Link href={`/people/${p.id}`} className="hover:underline">{p.name}</Link>
              <span className="text-xs text-muted-foreground">{p.languages.map((l) => l.toUpperCase()).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/people?topic=${nodeId}`} className="mt-2 inline-block text-xs underline underline-offset-4">
        Ver todos los referentes de {nodeTitle}
      </Link>
    </section>
  )
}
```

- [ ] **Step 2: Integrarlo en la ficha**

En `app/node/[id]/page.tsx`:
- Agregar imports: `import { VoicesForTopic } from '@/components/voices-for-topic'` y `import { getHighlightsForTopic } from '@/lib/people'`.
- Cambiar `const { nodes, byId, categories } = getCatalog()` por `const { nodes, byId, categories, people } = getCatalog()`.
- Después de `const related = meta(node.related)`, agregar:

```ts
  const voices = people.filter((p) => p.topics.includes(id))
  const topicHighlights = getHighlightsForTopic(people, id)
```

- Dentro de `<aside>`, justo después de la sección "Ruta sugerida", agregar:

```tsx
        <VoicesForTopic nodeId={id} nodeTitle={node.title} voices={voices} highlights={topicHighlights} />
```

- [ ] **Step 3: Integrarlo en el dashboard**

En `app/page.tsx`:
- Agregar imports: `import { PersonCard } from '@/components/person-card'` y `import { selectStarterPeople } from '@/lib/people'`.
- Cambiar `const { nodes, categories } = getCatalog()` por `const { nodes, categories, people } = getCatalog()` y agregar debajo:

```ts
  const starters = selectStarterPeople(people)
  const topicTitles = Object.fromEntries(nodes.map((n) => [n.id, n.title]))
```

- En la sección de estadísticas, cambiar `sm:grid-cols-4` por `sm:grid-cols-5` y agregar `<Stat label="Referentes" value={people.length} />` al final.
- Justo antes de la sección "Últimos agregados", agregar:

```tsx
      {starters.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Referentes para empezar</h2>
            <Link href="/people" className="text-sm underline underline-offset-4">Ver todos</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {starters.map((p) => <PersonCard key={p.id} person={p} topicTitles={topicTitles} />)}
          </div>
        </section>
      )}
```

- [ ] **Step 4: Verificar**

Run: `npm test && npx tsc --noEmit -p . && npm run build`
Expected: PASS.

Run: `npx next start -p 3123` en segundo plano; `curl -s localhost:3123/node/neural-network | grep -c "Quién habla de esto"` → `1`; `curl -s localhost:3123/node/rag | grep -c "Quién habla de esto"` → `0` (aún nadie cubre RAG); `curl -s localhost:3123/ | grep -c "Referentes para empezar"` → `1` (3Blue1Brown es `fundamentals`). Detener el servidor.

- [ ] **Step 5: Commit**

```bash
git add components/voices-for-topic.tsx "app/node/[id]/page.tsx" app/page.tsx
git commit -m "feat: quién habla de esto en las fichas y referentes para empezar en el dashboard"
```

---

### Task 9: Contenido semilla y cobertura de fundamentos

**Files:**
- Create: unos 28 archivos `content/people/<id>.mdx`
- Modify: `tests/content-integrity.test.ts`, `README.md`

**Interfaces:**
- Consumes: esquema de Task 2; `findUncoveredFundamentals` (Task 3)

- [ ] **Step 1: Escribir el test de cobertura (falla)**

Agregar a `tests/content-integrity.test.ts` (y el import `import { findUncoveredFundamentals } from '@/lib/people'`):

```ts
  it('cada nodo fundamental tiene al menos un referente', () => {
    const { nodes, people } = loadCatalog()
    expect(findUncoveredFundamentals(nodes, people)).toEqual([])
  })
```

Run: `npx vitest run tests/content-integrity.test.ts`
Expected: FAIL. Lista los fundamentos sin cubrir (`anthropic-api`, `claude`, `claude-code`, `cursor`, `embeddings`, `gemini`, `gpt`, `github-copilot`, `machine-learning`, `n8n`, `openai-api`, `perceptron`, `prompting`, `stable-diffusion`, y los que aún no cubren los 2 referentes iniciales).

- [ ] **Step 2: Redactar los referentes**

**Reglas de redacción:**
- Formato exacto de `content/people/andrej-karpathy.mdx`. `verified: false`, `added: 2026-10-17`.
- **Solo referentes, plataformas y recursos de cuya existencia y URL haya certeza.** Ante la duda, se omite la URL; si un referente no tiene ningún recurso con URL segura, se omite el referente. Los recursos pueden apuntar a la página principal de un curso o una lista de reproducción si no hay certeza del video concreto.
- `summary` ≤ 160 caracteres; "Por qué seguirle" en 2 párrafos: qué aporta y para quién es.
- `topics`: solo IDs que existen en `content/nodes/`. `highlights[].topic` cuando el recurso trata claramente un tema del catálogo.
- `feeds`: solo si el `youtubeChannelId` o el RSS se conocen con certeza; si no, se omite.

**Lotes (candidatos; la lista final puede cambiar según la regla de certeza):**
- **Lote EN (unos 16):** simon-willison, deeplearning-ai, fast-ai, sebastian-raschka, chip-huyen, lilian-weng, jay-alammar, statquest, two-minute-papers, yannic-kilcher, ai-explained, hugging-face, latent-space, hamel-husain, ethan-mollick, lex-fridman.
- **Lote ES (unos 12):** dotcsv, platzi, xavier-mitjana, jon-hernandez, ringa-tech, midudev, y otros referentes hispanohablantes de IA verificables.

**Cobertura obligatoria** (entre los dos lotes): cada nodo `fundamentals` (`anthropic-api claude claude-code cursor embeddings gemini deep-learning llm gpt github-copilot neural-network machine-learning n8n perceptron tokenization openai-api prompting stable-diffusion`) debe estar en los `topics` de al menos un referente. Se busca que cada uno tenga también un referente en español.

- [ ] **Step 3: Verificar la integridad y la cobertura**

Run: `npx vitest run tests/content-integrity.test.ts && ls content/people/*.mdx | wc -l`
Expected: PASS (2/2); unos 30 archivos. Si falla, el mensaje indica `people/<archivo>.mdx › <campo>` o la lista de fundamentos sin cubrir: corregir y volver a correr.

Contar el balance de idiomas: `grep -l "languages: \[es" content/people/*.mdx | wc -l` (objetivo ≈ 40%).

- [ ] **Step 4: Actualizar el README**

En `README.md`, después de la sección "Agregar o editar contenido", agregar:

```markdown
## Agregar un referente

Cada referente es un archivo `content/people/<id>.mdx`. Copia uno existente (por ejemplo `andrej-karpathy.mdx`), ajusta el frontmatter (`topics` con IDs de nodos, `platforms`, de 1 a 5 `highlights`) y escribe la sección `## Por qué seguirle`. `npm test` valida que los temas existan y que cada concepto de nivel fundamentos tenga al menos un referente.
```

Y en "Hoja de ruta", marcar el punto 2 como hecho: `2. **Referentes** por tema y red social (este repo)`.

- [ ] **Step 5: Commit**

```bash
git add content/people tests/content-integrity.test.ts README.md
git commit -m "content: referentes semilla con cobertura de fundamentos"
```

---

### Task 10: Pruebas E2E de referentes

**Files:**
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `data-testid="person-card"`, `data-languages`, `data-testid="voices-for-topic"`; chips con etiquetas de `LABELS`

- [ ] **Step 1: Escribir los tests**

Agregar al final de `e2e/smoke.spec.ts`:

```ts
test('referentes filtra por idioma y lo refleja en la URL', async ({ page }) => {
  await page.goto('/people')
  const cards = page.getByTestId('person-card')
  await expect(cards.first()).toBeVisible()
  const total = await cards.count()
  await page.getByRole('button', { name: 'Español', exact: true }).click()
  await expect(page).toHaveURL(/lang=es/)
  await expect.poll(() => cards.count()).toBeLessThan(total)
  for (const card of await cards.all()) await expect(card).toHaveAttribute('data-languages', /es/)
})

test('referentes filtra por tema desde la URL', async ({ page }) => {
  await page.goto('/people')
  const cards = page.getByTestId('person-card')
  await expect(cards.first()).toBeVisible()
  const total = await cards.count()
  await page.goto('/people?topic=neural-network')
  await expect(cards.first()).toBeVisible()
  expect(await cards.count()).toBeLessThan(total)
  await expect(page.getByRole('button', { name: 'Quitar Redes neuronales' })).toBeVisible()
})

test('referentes tolera parámetros inválidos', async ({ page }) => {
  await page.goto('/people?lang=fr&topic=nope&platform=tiktok')
  await expect(page.getByTestId('person-card').first()).toBeVisible()
})

test('el perfil muestra los recursos destacados', async ({ page }) => {
  await page.goto('/people/andrej-karpathy')
  await expect(page.getByRole('heading', { name: 'Recursos destacados' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Let's build GPT/ })).toBeVisible()
})

test('la ficha muestra quién habla de esto', async ({ page }) => {
  await page.goto('/node/neural-network')
  const voices = page.getByTestId('voices-for-topic')
  await expect(voices).toBeVisible()
  await expect(voices).toContainText('3Blue1Brown')
})
```

- [ ] **Step 2: Correr los E2E**

Run: `npm run test:e2e`
Expected: 13/13 PASS.

- [ ] **Step 3: Verificación final**

Run: `npm test && npx tsc --noEmit -p . && npm run test:e2e`
Expected: todo en PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/smoke.spec.ts
git commit -m "test: smoke tests E2E de referentes"
```
