# ExpIA — Catálogo y exploración de IA: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el subproyecto 1 de ExpIA: un sitio Next.js estático que carga unos 60 conceptos y herramientas de IA desde archivos MDX y permite explorarlos por línea de tiempo, filtros, grafo de dependencias y fichas con versión técnica y no técnica.

**Architecture:** El contenido vive en `content/` (MDX con frontmatter YAML y una taxonomía cerrada). Se valida con Zod y con reglas de integridad del grafo al compilar, y se carga en un `Catalog` en memoria. La lógica (`dates`, `graph`, `filters`, `timeline`, `graph-layout`, `dashboard`) es TypeScript puro sin React y se prueba con Vitest. Las páginas de App Router se generan de forma estática y pasan `NodeMeta[]` serializable a componentes cliente, que aplican los filtros leídos de la URL.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Zod 3, gray-matter, js-yaml, react-markdown + remark-gfm, Fuse.js 7, @xyflow/react 12, @dagrejs/dagre, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-catalogo-ia-design.md`

## Global Constraints

- UI solo en español (sin i18n).
- Todas las rutas se generan de forma estática; no hay base de datos ni login en este subproyecto.
- Node.js ≥ 20.
- IDs de nodo en kebab-case (`/^[a-z0-9]+(-[a-z0-9]+)*$/`), iguales al nombre del archivo.
- `summary` ≤ 160 caracteres.
- `released`: `YYYY | YYYY-MM | YYYY-MM-DD`; `added`: `YYYY-MM-DD`.
- Cuerpo del nodo con exactamente estas secciones obligatorias: `## Para qué sirve`, `## Cómo se usa`, `## Para no técnicos`.
- Los filtros viven en la URL y aplican en `/explore`, `/timeline` y `/graph`.
- "Tomando fuerza" = `status` `emerging` o `rising`, ordenados por fecha más reciente, máximo 8. "Últimos agregados" = los 6 con `added` más reciente.
- Todo nodo semilla lleva `verified: false`.
- La UI nunca inventa precisión de fecha: las fechas de solo año se dibujan como barra de un año.
- Las lecturas y escrituras de `localStorage` van en try/catch; el valor por defecto de audiencia es "Todos".

## Review Focus

1. **YAML que convierte tipos solo:** `released: 2020-05-22` (js-yaml lo convierte en `Date`) y `released: 2020` (número) deben tratarse como los textos `"2020-05-22"` y `"2020"`. Test en Task 4.
2. **Parámetros de URL inválidos** (`?level=foo&from=abc&cat=nope&to=99999`): se ignoran sin romper la página. Tests en Task 3 y Task 11.
3. **Líneas `## ` dentro de bloques de código** (p. ej. comentarios de Python) **y finales de línea CRLF** en el cuerpo MDX: no deben partir secciones. Test en Task 4.
4. **Dependencias en diamante y autodependencia:** los prerrequisitos salen sin duplicados y en orden válido; `requires: [<sí mismo>]` se reporta como ciclo. Tests en Task 2 y Task 4.
5. **`localStorage` inaccesible o que lanza error** (navegación privada, almacenamiento bloqueado): la audiencia vuelve a "all" sin romper la página. Test en Task 5.

---

## File Structure

```
content/
  taxonomy.yaml                 # 14 categorías cerradas
  nodes/<id>.mdx                # un nodo por archivo
  people/README.md              # formato previsto del subproyecto 2
lib/
  dates.ts                      # parseo y formato de fechas con precisión
  graph.ts                      # ciclos, topoSort, prerrequisitos, dependientes, ruta de aprendizaje
  filters.ts                    # Filters, parse/serialize URL, applyFilters
  search.ts                     # búsqueda Fuse
  audience.ts                   # preferencia de audiencia y orden de secciones
  timeline.ts                   # layout puro de la línea de tiempo
  graph-layout.ts               # layout dagre puro
  dashboard.ts                  # selecciones del dashboard
  content/enums.ts              # listas cerradas y etiquetas en español
  content/schema.ts             # esquemas Zod
  content/types.ts              # NodeMeta, CatalogNode, Catalog
  content/sections.ts           # partir el cuerpo en secciones
  content/load.ts               # loadCatalog, getCatalog, ContentError
hooks/use-url-filters.ts
components/
  audience-provider.tsx  audience-toggle.tsx  site-header.tsx
  node-card.tsx  filter-bar.tsx  year-input.tsx
  explore-client.tsx  node-sections.tsx  prereq-list.tsx  markdown.tsx
  timeline-client.tsx  graph-client.tsx
  ui/*                          # generado por shadcn
app/
  layout.tsx  page.tsx  globals.css
  explore/page.tsx  timeline/page.tsx  graph/page.tsx
  node/[id]/page.tsx
tests/                          # Vitest
e2e/smoke.spec.ts               # Playwright
.github/workflows/ci.yml
```

---

### Task 1: Scaffold del proyecto y `lib/dates.ts`

**Files:**
- Create: proyecto Next.js en la raíz, `vitest.config.ts`, `lib/dates.ts`
- Test: `tests/dates.test.ts`

**Interfaces:**
- Produces:
  - `type Precision = 'year' | 'month' | 'day'`
  - `interface ReleasedDate { raw: string; year: number; month?: number; day?: number; precision: Precision }`
  - `parseReleased(raw: string): ReleasedDate`: lanza `Error` cuyo mensaje empieza por `Fecha inválida`
  - `compareDates(a: ReleasedDate, b: ReleasedDate): number`
  - `toFractionalYear(d: ReleasedDate): number`: inicio del periodo
  - `formatReleased(d: ReleasedDate): string`: `"2020"`, `"may 2020"`, `"22 may 2020"`

- [ ] **Step 1: Generar el proyecto Next.js**

El directorio no está vacío (`README.md`, `docs/`), así que se genera en una carpeta temporal (sin punto inicial: npm no acepta nombres de paquete que empiecen por `.`) y se copia sin sobrescribir el README:

```bash
cd /Users/sergiomonsalve/Code/ExpIA
npx create-next-app@15 expia-scaffold --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --no-turbopack --yes
rsync -a --ignore-existing --exclude .git --exclude node_modules expia-scaffold/ ./
rm -rf expia-scaffold
npm install
```

- [ ] **Step 2: Instalar dependencias**

```bash
npm i zod@3 gray-matter js-yaml react-markdown@9 remark-gfm@4 fuse.js@7 @xyflow/react@12 @dagrejs/dagre
npm i -D vitest @types/js-yaml @playwright/test @tailwindcss/typography
npx shadcn@latest init -d
npx shadcn@latest add button badge input
```

- [ ] **Step 3: Configurar Vitest, scripts y estilos**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
```

En `package.json`, dentro de `"scripts"`, agregar:

```json
"test": "vitest run",
"test:e2e": "playwright test"
```

En `app/globals.css`:
- Justo después de `@import "tailwindcss";` agregar `@plugin "@tailwindcss/typography";`
- Reemplazar la línea `@custom-variant dark (&:is(.dark *));` por `@custom-variant dark (@media (prefers-color-scheme: dark));`
- Reemplazar el selector `.dark {` por `@media (prefers-color-scheme: dark) { :root {` y agregar un `}` extra al final de ese bloque.

Agregar `test-results/` y `playwright-report/` a `.gitignore`.

- [ ] **Step 4: Escribir el test que falla**

`tests/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseReleased, compareDates, toFractionalYear, formatReleased } from '@/lib/dates'

describe('parseReleased', () => {
  it('parsea precisión de año', () => {
    expect(parseReleased('2020')).toMatchObject({ raw: '2020', year: 2020, precision: 'year' })
  })
  it('parsea precisión de mes', () => {
    expect(parseReleased('2020-05')).toMatchObject({ year: 2020, month: 5, precision: 'month' })
  })
  it('parsea precisión de día', () => {
    expect(parseReleased('2020-05-22')).toMatchObject({ year: 2020, month: 5, day: 22, precision: 'day' })
  })
  it('acepta 29 de febrero en año bisiesto', () => {
    expect(parseReleased('2024-02-29').day).toBe(29)
  })
  it.each(['20', '2020-13', '2020-02-30', '2023-02-29', '2020/05', '', 'mayo 2020'])('rechaza "%s"', (raw) => {
    expect(() => parseReleased(raw)).toThrow(/^Fecha inválida/)
  })
})

describe('compareDates', () => {
  it('ordena por inicio del periodo, el año antes que el mes del mismo año', () => {
    const sorted = ['2020-05', '2019', '2020', '2020-05-22'].map(parseReleased).sort(compareDates).map((d) => d.raw)
    expect(sorted).toEqual(['2019', '2020', '2020-05', '2020-05-22'])
  })
})

describe('toFractionalYear', () => {
  it('devuelve el inicio del periodo', () => {
    expect(toFractionalYear(parseReleased('2020'))).toBe(2020)
    expect(toFractionalYear(parseReleased('2020-07'))).toBeCloseTo(2020.5)
  })
})

describe('formatReleased', () => {
  it('no inventa precisión', () => {
    expect(formatReleased(parseReleased('2020'))).toBe('2020')
    expect(formatReleased(parseReleased('2020-05'))).toBe('may 2020')
    expect(formatReleased(parseReleased('2020-05-22'))).toBe('22 may 2020')
  })
})
```

- [ ] **Step 5: Correr el test y ver que falla**

Run: `npx vitest run tests/dates.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/dates"`

- [ ] **Step 6: Implementar `lib/dates.ts`**

```ts
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
  if (!m) fail('usa YYYY, YYYY-MM o YYYY-MM-DD')
  const year = Number(m![1])
  const month = m![2] ? Number(m![2]) : undefined
  const day = m![3] ? Number(m![3]) : undefined
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
```

- [ ] **Step 7: Correr los tests y verificar que pasan**

Run: `npx vitest run tests/dates.test.ts && npm run build`
Expected: todos PASS; la compilación de Next termina sin errores.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Vitest y lib/dates con precisión de fecha"
```

---

### Task 2: `lib/graph.ts`

**Files:**
- Create: `lib/graph.ts`
- Test: `tests/graph.test.ts`

**Interfaces:**
- Produces:
  - `interface GraphNode { id: string; requires?: string[] }`
  - `detectCycle(nodes: GraphNode[]): string[] | null`: ruta del ciclo, p. ej. `['a','b','a']`
  - `topoSort(nodes: GraphNode[]): string[]`: prerrequisitos primero; lanza `Error('Ciclo en requires: a → b → a')`
  - `getPrerequisites(nodes: GraphNode[], id: string): string[]`: transitivos, sin duplicados, en orden de aprendizaje, sin incluir `id`; lanza `Error` si `id` es desconocido
  - `getDependents(nodes: GraphNode[], id: string): string[]`: dependientes directos
  - `getLearningPath(nodes: GraphNode[], targetId: string): string[]`: `[...prerrequisitos, targetId]`

- [ ] **Step 1: Escribir el test que falla**

`tests/graph.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { detectCycle, topoSort, getPrerequisites, getDependents, getLearningPath, type GraphNode } from '@/lib/graph'

const chain: GraphNode[] = [
  { id: 'c', requires: ['b'] },
  { id: 'b', requires: ['a'] },
  { id: 'a' },
]
// diamante: d necesita b y c; ambos necesitan a
const diamond: GraphNode[] = [
  { id: 'd', requires: ['b', 'c'] },
  { id: 'b', requires: ['a'] },
  { id: 'c', requires: ['a'] },
  { id: 'a', requires: [] },
]

function assertValidOrder(order: string[], nodes: GraphNode[]) {
  const pos = new Map(order.map((id, i) => [id, i]))
  for (const n of nodes) for (const r of n.requires ?? []) {
    if (pos.has(n.id) && pos.has(r)) expect(pos.get(r)!).toBeLessThan(pos.get(n.id)!)
  }
}

describe('detectCycle', () => {
  it('devuelve null en un grafo dirigido sin ciclos', () => {
    expect(detectCycle(diamond)).toBeNull()
  })
  it('reporta un ciclo de 3 nodos', () => {
    const cycle = detectCycle([{ id: 'a', requires: ['b'] }, { id: 'b', requires: ['c'] }, { id: 'c', requires: ['a'] }])
    expect(cycle).not.toBeNull()
    expect(cycle![0]).toBe(cycle![cycle!.length - 1])
    expect(new Set(cycle)).toEqual(new Set(['a', 'b', 'c']))
  })
  it('reporta una autodependencia', () => {
    expect(detectCycle([{ id: 'a', requires: ['a'] }])).toEqual(['a', 'a'])
  })
  it('ignora requires a nodos que no existen', () => {
    expect(detectCycle([{ id: 'a', requires: ['zzz'] }])).toBeNull()
  })
})

describe('topoSort', () => {
  it('pone los prerrequisitos primero', () => {
    const order = topoSort(diamond)
    expect(order).toHaveLength(4)
    assertValidOrder(order, diamond)
  })
  it('lanza error con un ciclo', () => {
    expect(() => topoSort([{ id: 'a', requires: ['b'] }, { id: 'b', requires: ['a'] }])).toThrow(/Ciclo en requires/)
  })
})

describe('getPrerequisites', () => {
  it('devuelve una cadena transitiva en orden de aprendizaje', () => {
    expect(getPrerequisites(chain, 'c')).toEqual(['a', 'b'])
  })
  it('no duplica en un diamante y respeta el orden', () => {
    const pre = getPrerequisites(diamond, 'd')
    expect(pre).toHaveLength(3)
    expect(new Set(pre)).toEqual(new Set(['a', 'b', 'c']))
    assertValidOrder(pre, diamond)
  })
  it('devuelve [] para una raíz', () => {
    expect(getPrerequisites(chain, 'a')).toEqual([])
  })
  it('lanza error con un id desconocido', () => {
    expect(() => getPrerequisites(chain, 'nope')).toThrow(/desconocido/)
  })
})

describe('getDependents / getLearningPath', () => {
  it('devuelve los dependientes directos', () => {
    expect(getDependents(diamond, 'a').sort()).toEqual(['b', 'c'])
    expect(getDependents(diamond, 'd')).toEqual([])
  })
  it('la ruta de aprendizaje termina en el objetivo', () => {
    expect(getLearningPath(chain, 'c')).toEqual(['a', 'b', 'c'])
  })
})
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run tests/graph.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/graph"`

- [ ] **Step 3: Implementar `lib/graph.ts`**

```ts
export interface GraphNode {
  id: string
  requires?: string[]
}

function requiresIndex(nodes: GraphNode[]): Map<string, string[]> {
  return new Map(nodes.map((n) => [n.id, n.requires ?? []]))
}

export function detectCycle(nodes: GraphNode[]): string[] | null {
  const req = requiresIndex(nodes)
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []

  const visit = (id: string): string[] | null => {
    if (!req.has(id) || state.get(id) === 'done') return null
    if (state.get(id) === 'visiting') return [...stack.slice(stack.indexOf(id)), id]
    state.set(id, 'visiting')
    stack.push(id)
    for (const r of req.get(id)!) {
      const cycle = visit(r)
      if (cycle) return cycle
    }
    stack.pop()
    state.set(id, 'done')
    return null
  }

  for (const n of nodes) {
    const cycle = visit(n.id)
    if (cycle) return cycle
  }
  return null
}

export function topoSort(nodes: GraphNode[]): string[] {
  const cycle = detectCycle(nodes)
  if (cycle) throw new Error(`Ciclo en requires: ${cycle.join(' → ')}`)
  const req = requiresIndex(nodes)
  const seen = new Set<string>()
  const out: string[] = []
  const visit = (id: string) => {
    if (seen.has(id) || !req.has(id)) return
    seen.add(id)
    for (const r of req.get(id)!) visit(r)
    out.push(id)
  }
  for (const n of nodes) visit(n.id)
  return out
}

export function getPrerequisites(nodes: GraphNode[], id: string): string[] {
  const req = requiresIndex(nodes)
  if (!req.has(id)) throw new Error(`Nodo desconocido: ${id}`)
  const seen = new Set<string>([id])
  const out: string[] = []
  const visit = (current: string) => {
    for (const r of req.get(current) ?? []) {
      if (seen.has(r)) continue
      seen.add(r)
      visit(r)
      out.push(r)
    }
  }
  visit(id)
  return out
}

export function getDependents(nodes: GraphNode[], id: string): string[] {
  return nodes.filter((n) => n.requires?.includes(id)).map((n) => n.id)
}

export function getLearningPath(nodes: GraphNode[], targetId: string): string[] {
  return [...getPrerequisites(nodes, targetId), targetId]
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run tests/graph.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/graph.ts tests/graph.test.ts
git commit -m "feat: lib/graph con detección de ciclos, topoSort y prerrequisitos"
```

---

### Task 3: Enums y `lib/filters.ts`

**Files:**
- Create: `lib/content/enums.ts`, `lib/filters.ts`
- Test: `tests/filters.test.ts`

**Interfaces:**
- Produces (`lib/content/enums.ts`):
  - `KINDS`, `AUDIENCES`, `LEVELS`, `STATUSES`, `LICENSES`, `PRICINGS` (tuplas `as const`)
  - Tipos `Kind`, `Audience`, `Level`, `Status`, `License`, `Pricing`
  - `LABELS: Record<string, string>` (etiquetas en español)
- Produces (`lib/filters.ts`):
  - `interface Filters { q: string; cat: string[]; kind: Kind[]; aud: Audience[]; level: Level[]; status: Status[]; license: License[]; pricing: Pricing[]; from?: number; to?: number }`
  - `EMPTY_FILTERS: Filters`
  - `interface FilterableNode { category: string[]; kind: Kind; audience: Audience[]; level: Level; status: Status; license?: License; pricing?: Pricing; date: { year: number } }`
  - `parseFilters(params: URLSearchParams, knownCategories?: readonly string[]): Filters`
  - `serializeFilters(f: Filters): string` (sin `?`; `''` si está vacío)
  - `applyFilters<T extends FilterableNode>(nodes: T[], f: Filters): T[]` (ignora `q`)
  - `toggleValue<T>(list: T[], value: T): T[]`

- [ ] **Step 1: Crear `lib/content/enums.ts`**

```ts
export const KINDS = ['concept', 'technique', 'model', 'tool', 'protocol'] as const
export const AUDIENCES = ['technical', 'business'] as const
export const LEVELS = ['fundamentals', 'intermediate', 'advanced'] as const
export const STATUSES = ['emerging', 'rising', 'mainstream', 'declining'] as const
export const LICENSES = ['open-source', 'proprietary'] as const
export const PRICINGS = ['free', 'freemium', 'paid'] as const

export type Kind = (typeof KINDS)[number]
export type Audience = (typeof AUDIENCES)[number]
export type Level = (typeof LEVELS)[number]
export type Status = (typeof STATUSES)[number]
export type License = (typeof LICENSES)[number]
export type Pricing = (typeof PRICINGS)[number]

export const LABELS: Record<string, string> = {
  concept: 'Concepto',
  technique: 'Técnica',
  model: 'Modelo',
  tool: 'Herramienta',
  protocol: 'Protocolo',
  technical: 'Técnico',
  business: 'No técnico',
  fundamentals: 'Fundamentos',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
  emerging: 'Emergente',
  rising: 'Tomando fuerza',
  mainstream: 'Consolidado',
  declining: 'En declive',
  'open-source': 'Open source',
  proprietary: 'Propietario',
  free: 'Gratis',
  freemium: 'Freemium',
  paid: 'Pago',
}
```

- [ ] **Step 2: Escribir el test que falla**

`tests/filters.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseFilters, serializeFilters, applyFilters, toggleValue, EMPTY_FILTERS, type FilterableNode, type Filters } from '@/lib/filters'

const CATS = ['llm', 'agents', 'retrieval']
const p = (qs: string) => parseFilters(new URLSearchParams(qs), CATS)

type N = FilterableNode & { id: string }
const node = (id: string, o: Partial<FilterableNode> = {}): N => ({
  id,
  category: ['llm'],
  kind: 'concept',
  audience: ['technical'],
  level: 'fundamentals',
  status: 'mainstream',
  date: { year: 2020 },
  ...o,
})

describe('parseFilters', () => {
  it('parsea listas y rango de años', () => {
    const f = p('cat=llm,agents&kind=tool&from=2017&to=2020')
    expect(f.cat).toEqual(['llm', 'agents'])
    expect(f.kind).toEqual(['tool'])
    expect(f.from).toBe(2017)
    expect(f.to).toBe(2020)
  })
  it('ignora valores inválidos sin romper', () => {
    const f = p('level=foo,advanced&kind=&from=abc&to=99999&cat=nope&aud=business,business')
    expect(f.level).toEqual(['advanced'])
    expect(f.kind).toEqual([])
    expect(f.cat).toEqual([])
    expect(f.aud).toEqual(['business'])
    expect(f.from).toBeUndefined()
    expect(f.to).toBeUndefined()
  })
  it('invierte from/to si llegan al revés', () => {
    const f = p('from=2020&to=2010')
    expect([f.from, f.to]).toEqual([2010, 2020])
  })
  it('conserva q sin partirlo por comas', () => {
    expect(p('q=hola%2C%20mundo').q).toBe('hola, mundo')
  })
  it('sin knownCategories acepta cualquier categoría', () => {
    expect(parseFilters(new URLSearchParams('cat=x')).cat).toEqual(['x'])
  })
})

describe('serializeFilters', () => {
  it('serializa los filtros vacíos como texto vacío', () => {
    expect(serializeFilters(EMPTY_FILTERS)).toBe('')
  })
  it('hace ida y vuelta', () => {
    const f: Filters = { ...EMPTY_FILTERS, q: 'hola, mundo', cat: ['llm', 'agents'], level: ['advanced'], from: 2010, to: 2020 }
    expect(p(serializeFilters(f))).toEqual(f)
  })
  it('genera URLs legibles', () => {
    expect(serializeFilters({ ...EMPTY_FILTERS, cat: ['agents'], level: ['fundamentals'] })).toBe('cat=agents&level=fundamentals')
  })
})

describe('applyFilters', () => {
  const nodes = [
    node('a'),
    node('b', { kind: 'tool', category: ['agents'], license: 'open-source', date: { year: 2023 } }),
    node('c', { kind: 'tool', category: ['retrieval', 'llm'], audience: ['business'], date: { year: 2015 } }),
  ]
  const ids = (f: Partial<Filters>) => applyFilters(nodes, { ...EMPTY_FILTERS, ...f }).map((n) => n.id)

  it('sin filtros devuelve todo', () => expect(ids({})).toEqual(['a', 'b', 'c']))
  it('aplica OR dentro de un grupo', () => expect(ids({ cat: ['agents', 'retrieval'] })).toEqual(['b', 'c']))
  it('aplica AND entre grupos', () => expect(ids({ kind: ['tool'], cat: ['llm'] })).toEqual(['c']))
  it('excluye nodos sin license cuando se filtra por license', () => expect(ids({ license: ['open-source'] })).toEqual(['b']))
  it('el rango de años es inclusivo', () => expect(ids({ from: 2020, to: 2023 })).toEqual(['a', 'b']))
  it('ignora q', () => expect(ids({ q: 'zzz' })).toEqual(['a', 'b', 'c']))
})

describe('toggleValue', () => {
  it('agrega y quita', () => {
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b'])
  })
})
```

- [ ] **Step 3: Correr el test y ver que falla**

Run: `npx vitest run tests/filters.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/filters"`

- [ ] **Step 4: Implementar `lib/filters.ts`**

```ts
import {
  KINDS, AUDIENCES, LEVELS, STATUSES, LICENSES, PRICINGS,
  type Kind, type Audience, type Level, type Status, type License, type Pricing,
} from '@/lib/content/enums'

export interface Filters {
  q: string
  cat: string[]
  kind: Kind[]
  aud: Audience[]
  level: Level[]
  status: Status[]
  license: License[]
  pricing: Pricing[]
  from?: number
  to?: number
}

export const EMPTY_FILTERS: Filters = {
  q: '', cat: [], kind: [], aud: [], level: [], status: [], license: [], pricing: [],
}

export interface FilterableNode {
  category: string[]
  kind: Kind
  audience: Audience[]
  level: Level
  status: Status
  license?: License
  pricing?: Pricing
  date: { year: number }
}

const LIST_KEYS = ['cat', 'kind', 'aud', 'level', 'status', 'license', 'pricing'] as const

function parseList<T extends string>(params: URLSearchParams, key: string, allowed?: readonly T[]): T[] {
  const raw = params.get(key)
  if (!raw) return []
  const values = raw.split(',').map((v) => v.trim()).filter(Boolean)
  const valid = allowed ? values.filter((v): v is T => (allowed as readonly string[]).includes(v)) : (values as T[])
  return [...new Set(valid)]
}

function parseYear(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key)
  return raw && /^\d{4}$/.test(raw) ? Number(raw) : undefined
}

export function parseFilters(params: URLSearchParams, knownCategories?: readonly string[]): Filters {
  let from = parseYear(params, 'from')
  let to = parseYear(params, 'to')
  if (from !== undefined && to !== undefined && from > to) [from, to] = [to, from]
  return {
    q: params.get('q') ?? '',
    cat: parseList(params, 'cat', knownCategories),
    kind: parseList(params, 'kind', KINDS),
    aud: parseList(params, 'aud', AUDIENCES),
    level: parseList(params, 'level', LEVELS),
    status: parseList(params, 'status', STATUSES),
    license: parseList(params, 'license', LICENSES),
    pricing: parseList(params, 'pricing', PRICINGS),
    from,
    to,
  }
}

export function serializeFilters(f: Filters): string {
  const parts: string[] = []
  if (f.q) parts.push(`q=${encodeURIComponent(f.q)}`)
  for (const key of LIST_KEYS) {
    const values = f[key] as string[]
    if (values.length) parts.push(`${key}=${values.map(encodeURIComponent).join(',')}`)
  }
  if (f.from !== undefined) parts.push(`from=${f.from}`)
  if (f.to !== undefined) parts.push(`to=${f.to}`)
  return parts.join('&')
}

function matchAny<T>(selected: T[], values: T[]): boolean {
  return selected.length === 0 || values.some((v) => selected.includes(v))
}

function matchOptional<T>(selected: T[], value: T | undefined): boolean {
  return selected.length === 0 || (value !== undefined && selected.includes(value))
}

export function applyFilters<T extends FilterableNode>(nodes: T[], f: Filters): T[] {
  return nodes.filter((n) =>
    matchAny(f.cat, n.category) &&
    matchAny(f.kind, [n.kind]) &&
    matchAny(f.aud, n.audience) &&
    matchAny(f.level, [n.level]) &&
    matchAny(f.status, [n.status]) &&
    matchOptional(f.license, n.license) &&
    matchOptional(f.pricing, n.pricing) &&
    (f.from === undefined || n.date.year >= f.from) &&
    (f.to === undefined || n.date.year <= f.to),
  )
}

export function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx vitest run tests/filters.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/content/enums.ts lib/filters.ts tests/filters.test.ts
git commit -m "feat: enums de contenido y lib/filters con estado en URL"
```

---

### Task 4: Esquema, secciones, cargador de contenido y nodos iniciales

**Files:**
- Create: `lib/content/schema.ts`, `lib/content/types.ts`, `lib/content/sections.ts`, `lib/content/load.ts`, `content/taxonomy.yaml`, `content/nodes/machine-learning.mdx`, `content/nodes/neural-network.mdx`, `content/nodes/deep-learning.mdx`, `content/people/README.md`
- Test: `tests/sections.test.ts`, `tests/load.test.ts`, `tests/content-integrity.test.ts`

**Interfaces:**
- Consumes: `parseReleased`, `compareDates`, `ReleasedDate` (Task 1); `detectCycle` (Task 2); enums (Task 3)
- Produces:
  - `nodeFrontmatterSchema`, `taxonomySchema`, `type NodeFrontmatter`, `type Category = { id: string; label: string; color: string }`
  - `type SectionKey = 'purpose' | 'usage' | 'nonTechnical'`, `SECTION_HEADINGS: Record<SectionKey, string>`, `type NodeSections = Record<SectionKey, string>`
  - `splitSections(body: string): { sections: Partial<NodeSections>; missing: string[] }`
  - `type NodeMeta = NodeFrontmatter & { date: ReleasedDate }`, `type CatalogNode = NodeMeta & { sections: NodeSections }`, `interface Catalog { nodes: CatalogNode[]; byId: Map<string, CatalogNode>; categories: Category[] }`, `toMeta(n: CatalogNode): NodeMeta`
  - `class ContentError extends Error { errors: string[] }`
  - `loadCatalog(contentDir?: string): Catalog` (nodos ordenados por fecha asc), `getCatalog(): Catalog` (con caché)

- [ ] **Step 1: Escribir los tests de secciones (fallan)**

`tests/sections.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { splitSections } from '@/lib/content/sections'

const FULL = '## Para qué sirve\nA\n\n## Cómo se usa\nB\n\n## Para no técnicos\nC\n'

describe('splitSections', () => {
  it('extrae las tres secciones', () => {
    const { sections, missing } = splitSections(FULL)
    expect(sections).toEqual({ purpose: 'A', usage: 'B', nonTechnical: 'C' })
    expect(missing).toEqual([])
  })
  it('reporta las secciones que faltan por su título', () => {
    expect(splitSections('## Para qué sirve\nA\n').missing).toEqual(['Cómo se usa', 'Para no técnicos'])
  })
  it('no parte en "## " dentro de un bloque de código', () => {
    const body = '## Para qué sirve\nA\n## Cómo se usa\n```python\n## paso 1\nx = 1\n```\n## Para no técnicos\nC'
    const { sections, missing } = splitSections(body)
    expect(missing).toEqual([])
    expect(sections.usage).toContain('## paso 1')
  })
  it('soporta finales de línea CRLF', () => {
    const { sections, missing } = splitSections(FULL.replace(/\n/g, '\r\n'))
    expect(missing).toEqual([])
    expect(sections.purpose).toBe('A')
  })
  it('no mezcla secciones desconocidas con la anterior', () => {
    const { sections } = splitSections('## Para qué sirve\nA\n## Extra\nZ\n## Cómo se usa\nB\n## Para no técnicos\nC')
    expect(sections.purpose).toBe('A')
  })
})
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run tests/sections.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/content/sections"`

- [ ] **Step 3: Implementar `lib/content/sections.ts`**

```ts
export type SectionKey = 'purpose' | 'usage' | 'nonTechnical'
export type NodeSections = Record<SectionKey, string>

export const SECTION_HEADINGS: Record<SectionKey, string> = {
  purpose: 'Para qué sirve',
  usage: 'Cómo se usa',
  nonTechnical: 'Para no técnicos',
}

const KEYS = Object.keys(SECTION_HEADINGS) as SectionKey[]

export function splitSections(body: string): { sections: Partial<NodeSections>; missing: string[] } {
  const collected: Partial<Record<SectionKey, string[]>> = {}
  let current: SectionKey | null = null
  let inFence = false

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    const heading = !inFence ? /^## +(.+?)\s*$/.exec(line) : null
    if (heading) {
      current = KEYS.find((k) => SECTION_HEADINGS[k] === heading[1]) ?? null
      if (current) collected[current] = []
      continue
    }
    if (current) collected[current]!.push(line)
  }

  const sections: Partial<NodeSections> = {}
  for (const k of KEYS) if (collected[k]) sections[k] = collected[k]!.join('\n').trim()
  const missing = KEYS.filter((k) => !collected[k]).map((k) => SECTION_HEADINGS[k])
  return { sections, missing }
}
```

Run: `npx vitest run tests/sections.test.ts`. Expected: PASS.

- [ ] **Step 4: Crear el esquema y los tipos**

`lib/content/schema.ts`:

```ts
import { z } from 'zod'
import { KINDS, AUDIENCES, LEVELS, STATUSES, LICENSES, PRICINGS } from './enums'
import { parseReleased } from '@/lib/dates'

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'debe ser kebab-case')
// js-yaml con JSON_SCHEMA deja 2020-05-22 como texto, pero `2020` llega como número
const yamlString = z.union([z.string(), z.number()]).transform(String)

const released = yamlString.refine((s) => {
  try {
    parseReleased(s)
    return true
  } catch {
    return false
  }
}, 'debe ser YYYY, YYYY-MM o YYYY-MM-DD válido')

export const nodeFrontmatterSchema = z
  .object({
    id,
    title: z.string().min(1),
    kind: z.enum(KINDS),
    category: z.array(z.string()).min(1),
    released,
    origin: z.string().optional(),
    audience: z.array(z.enum(AUDIENCES)).min(1),
    level: z.enum(LEVELS),
    requires: z.array(id).default([]),
    related: z.array(id).default([]),
    status: z.enum(STATUSES),
    license: z.enum(LICENSES).optional(),
    pricing: z.enum(PRICINGS).optional(),
    links: z
      .object({
        docs: z.string().url().optional(),
        paper: z.string().url().optional(),
        repo: z.string().url().optional(),
        site: z.string().url().optional(),
      })
      .strict()
      .default({}),
    summary: z.string().min(1).max(160),
    verified: z.boolean(),
    added: yamlString.refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s), 'debe ser YYYY-MM-DD'),
    voices: z.array(id).default([]),
  })
  .strict()

export const taxonomySchema = z.object({
  categories: z
    .array(z.object({ id, label: z.string().min(1), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }))
    .min(1),
})

export type NodeFrontmatter = z.infer<typeof nodeFrontmatterSchema>
export type Category = z.infer<typeof taxonomySchema>['categories'][number]
```

`lib/content/types.ts`:

```ts
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
```

- [ ] **Step 5: Escribir los tests del cargador (fallan)**

`tests/load.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadCatalog, ContentError } from '@/lib/content/load'

const TAXONOMY = 'categories:\n  - { id: llm, label: LLM, color: "#3366ff" }\n  - { id: foundations, label: Fundamentos, color: "#888888" }\n'
const BODY = '## Para qué sirve\nA\n\n## Cómo se usa\nB\n\n## Para no técnicos\nC\n'

function fm(id: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    id, title: `"${id}"`, kind: 'concept', category: '[llm]', released: '2020', audience: '[technical]',
    level: 'fundamentals', status: 'mainstream', summary: '"resumen"', verified: 'false', added: '2026-10-17', ...extra,
  }
}
function file(front: Record<string, string>, body = BODY): string {
  return `---\n${Object.entries(front).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n${body}`
}
function makeContent(nodes: Record<string, string>, taxonomy = TAXONOMY): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expia-'))
  fs.mkdirSync(path.join(dir, 'nodes'))
  fs.writeFileSync(path.join(dir, 'taxonomy.yaml'), taxonomy)
  for (const [name, text] of Object.entries(nodes)) fs.writeFileSync(path.join(dir, 'nodes', `${name}.mdx`), text)
  return dir
}
function errorsOf(dir: string): string[] {
  try {
    loadCatalog(dir)
    return []
  } catch (e) {
    if (e instanceof ContentError) return e.errors
    throw e
  }
}

describe('loadCatalog', () => {
  it('carga un catálogo válido ordenado por fecha', () => {
    const dir = makeContent({
      b: file(fm('b', { requires: '[a]', released: '2021-03' })),
      a: file(fm('a', { released: '2019' })),
    })
    const cat = loadCatalog(dir)
    expect(cat.nodes.map((n) => n.id)).toEqual(['a', 'b'])
    expect(cat.byId.get('b')!.requires).toEqual(['a'])
    expect(cat.byId.get('a')!.sections).toEqual({ purpose: 'A', usage: 'B', nonTechnical: 'C' })
    expect(cat.byId.get('a')!.related).toEqual([])
    expect(cat.categories).toHaveLength(2)
  })

  it('trata fechas que YAML convertiría solo como texto', () => {
    const dir = makeContent({
      a: file(fm('a', { released: '2020-05-22' })),
      b: file(fm('b', { released: '2020' })),
    })
    const cat = loadCatalog(dir)
    expect(cat.byId.get('a')!.released).toBe('2020-05-22')
    expect(cat.byId.get('a')!.date.precision).toBe('day')
    expect(cat.byId.get('a')!.added).toBe('2026-10-17')
    expect(cat.byId.get('b')!.released).toBe('2020')
  })

  it('reporta un requires inexistente con archivo y campo', () => {
    const errs = errorsOf(makeContent({ b: file(fm('b', { requires: '[zzz]' })) }))
    expect(errs).toContain('nodes/b.mdx › requires: "zzz" no existe')
  })

  it('reporta ciclos', () => {
    const errs = errorsOf(makeContent({
      a: file(fm('a', { requires: '[b]' })),
      b: file(fm('b', { requires: '[a]' })),
    }))
    expect(errs.some((e) => /ciclo/.test(e))).toBe(true)
  })

  it('reporta la autodependencia como ciclo', () => {
    const errs = errorsOf(makeContent({ a: file(fm('a', { requires: '[a]' })) }))
    expect(errs).toContain('requires: ciclo a → a')
  })

  it('reporta una categoría desconocida', () => {
    const errs = errorsOf(makeContent({ a: file(fm('a', { category: '[nope]' })) }))
    expect(errs).toContain('nodes/a.mdx › category: "nope" no existe en taxonomy.yaml')
  })

  it('reporta un id distinto del nombre del archivo', () => {
    const errs = errorsOf(makeContent({ a: file(fm('otro')) }))
    expect(errs.some((e) => e.startsWith('nodes/a.mdx › id:'))).toBe(true)
  })

  it('reporta las secciones faltantes', () => {
    const errs = errorsOf(makeContent({ a: file(fm('a'), '## Para qué sirve\nA\n') }))
    expect(errs).toContain('nodes/a.mdx › cuerpo: falta la sección "## Cómo se usa"')
  })

  it('reporta un summary demasiado largo', () => {
    const errs = errorsOf(makeContent({ a: file(fm('a', { summary: `"${'x'.repeat(161)}"` })) }))
    expect(errs.some((e) => e.startsWith('nodes/a.mdx › summary'))).toBe(true)
  })

  it('acumula errores de varios archivos', () => {
    const errs = errorsOf(makeContent({
      a: file(fm('a', { level: 'experto' })),
      b: file(fm('b', { released: '2020-13' })),
    }))
    expect(errs.some((e) => e.startsWith('nodes/a.mdx'))).toBe(true)
    expect(errs.some((e) => e.startsWith('nodes/b.mdx'))).toBe(true)
  })
})
```

Run: `npx vitest run tests/load.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/content/load"`

- [ ] **Step 6: Implementar `lib/content/load.ts`**

```ts
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import yaml from 'js-yaml'
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
const loadYaml = (s: string) => yaml.load(s, { schema: yaml.JSON_SCHEMA })
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
    const { sections, missing } = splitSections(content)
    for (const h of missing) errors.push(`${rel} › cuerpo: falta la sección "## ${h}"`)
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
```

Run: `npx vitest run tests/load.test.ts tests/sections.test.ts`
Expected: PASS

- [ ] **Step 7: Crear la taxonomía, los 3 nodos iniciales y el README de personas**

`content/taxonomy.yaml`:

```yaml
categories:
  - { id: foundations, label: "Fundamentos", color: "#64748b" }
  - { id: llm, label: "LLMs", color: "#6366f1" }
  - { id: llm-apps, label: "Apps con LLM", color: "#8b5cf6" }
  - { id: agents, label: "Agentes", color: "#ec4899" }
  - { id: retrieval, label: "Recuperación", color: "#14b8a6" }
  - { id: vision, label: "Visión", color: "#f59e0b" }
  - { id: audio, label: "Audio", color: "#f97316" }
  - { id: generative-media, label: "Medios generativos", color: "#e11d48" }
  - { id: infra, label: "Infraestructura", color: "#0ea5e9" }
  - { id: protocols, label: "Protocolos", color: "#22c55e" }
  - { id: frameworks, label: "Frameworks", color: "#a855f7" }
  - { id: dev-tools, label: "Herramientas de desarrollo", color: "#3b82f6" }
  - { id: evaluation, label: "Evaluación", color: "#84cc16" }
  - { id: safety, label: "Seguridad", color: "#ef4444" }
```

`content/nodes/machine-learning.mdx`:

```mdx
---
id: machine-learning
title: "Machine Learning"
kind: concept
category: [foundations]
released: 1959
origin: "Arthur Samuel (IBM)"
audience: [technical, business]
level: fundamentals
requires: []
status: mainstream
summary: "Programas que aprenden patrones a partir de datos en lugar de seguir reglas escritas a mano."
verified: false
added: 2026-10-17
---

## Para qué sirve

Permite resolver problemas en los que escribir reglas explícitas es imposible o muy costoso: clasificar correos como spam, predecir demanda, recomendar productos o detectar fraude. El sistema ajusta un modelo a partir de ejemplos y luego generaliza a casos nuevos.

## Cómo se usa

1. Reúnes datos de ejemplo (entradas y, si es aprendizaje supervisado, la respuesta correcta).
2. Eliges un tipo de modelo (regresión, árbol de decisión, red neuronal…).
3. Entrenas: el algoritmo ajusta los parámetros del modelo para reducir el error.
4. Evalúas con datos que el modelo no vio durante el entrenamiento.

```python
from sklearn.linear_model import LogisticRegression

model = LogisticRegression()
model.fit(X_train, y_train)          # aprende de ejemplos
print(model.score(X_test, y_test))   # mide qué tan bien generaliza
```

## Para no técnicos

Es como enseñarle a alguien a reconocer frutas mostrándole muchas fotos, en vez de darle un manual con reglas. Después de ver suficientes ejemplos, reconoce frutas nuevas por sí mismo. En una empresa se usa para predecir ventas, detectar clientes que van a irse o automatizar decisiones repetitivas basadas en datos históricos.
```

`content/nodes/neural-network.mdx`:

```mdx
---
id: neural-network
title: "Redes neuronales"
kind: concept
category: [foundations]
released: 1943
origin: "McCulloch y Pitts"
audience: [technical, business]
level: fundamentals
requires: [machine-learning]
status: mainstream
summary: "Modelos formados por capas de 'neuronas' artificiales conectadas que aprenden ajustando el peso de cada conexión."
verified: false
added: 2026-10-17
---

## Para qué sirve

Son la base de casi toda la IA moderna: reconocimiento de imágenes, voz, traducción y modelos de lenguaje. Pueden aprender relaciones muy complejas y no lineales entre entradas y salidas.

## Cómo se usa

Una red recibe números (píxeles, palabras convertidas en vectores, etc.), los pasa por capas de neuronas que multiplican por pesos y aplican una función de activación, y produce una salida. Durante el entrenamiento, los pesos se ajustan para reducir el error.

```python
import torch.nn as nn

model = nn.Sequential(
    nn.Linear(784, 128), nn.ReLU(),
    nn.Linear(128, 10),
)
```

## Para no técnicos

Imagina una red de miles de pequeños interruptores que se activan más o menos según lo que reciben. Al entrenarla, se ajusta la sensibilidad de cada interruptor hasta que la red, en conjunto, da la respuesta correcta. Es la "maquinaria" que hay dentro de ChatGPT, Claude o el reconocimiento facial del teléfono.
```

`content/nodes/deep-learning.mdx`:

```mdx
---
id: deep-learning
title: "Deep Learning"
kind: concept
category: [foundations]
released: 2006
origin: "Hinton, Osindero y Teh (deep belief nets)"
audience: [technical, business]
level: fundamentals
requires: [neural-network]
status: mainstream
summary: "Redes neuronales con muchas capas que aprenden representaciones cada vez más abstractas de los datos."
verified: false
added: 2026-10-17
---

## Para qué sirve

Permite trabajar directamente con datos crudos (imágenes, audio, texto) sin diseñar características a mano. Gracias a más datos y GPUs, desde 2012 superó a casi todos los métodos anteriores en visión, voz y lenguaje.

## Cómo se usa

Se apilan muchas capas, se entrena con grandes volúmenes de datos usando backpropagation y descenso de gradiente, normalmente en GPU. Frameworks como PyTorch o JAX hacen la parte pesada.

```python
for x, y in loader:
    loss = loss_fn(model(x), y)
    loss.backward()      # calcula gradientes
    optimizer.step()     # ajusta los pesos
    optimizer.zero_grad()
```

## Para no técnicos

Es una red neuronal "profunda": cada capa aprende algo un poco más abstracto que la anterior. En una foto, las primeras capas detectan bordes, las siguientes formas y las últimas objetos completos. Es la razón por la que la IA dio un salto enorme en la última década.
```

`content/people/README.md`:

```markdown
# Referentes (subproyecto 2)

Aquí vivirán los perfiles de referentes de IA, un archivo por persona: `content/people/<id>.mdx`.
Los nodos ya aceptan `voices: [<id>, ...]` en su frontmatter, pero el campo aún no se muestra.
El formato se definirá en la especificación del subproyecto 2.
```

- [ ] **Step 8: Escribir el test de integridad del contenido real**

`tests/content-integrity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { loadCatalog } from '@/lib/content/load'

describe('content/ real', () => {
  it('pasa todas las reglas de integridad', () => {
    const catalog = loadCatalog()
    expect(catalog.nodes.length).toBeGreaterThan(0)
  })
})
```

Run: `npm test`
Expected: PASS en todos los archivos de test.

- [ ] **Step 9: Commit**

```bash
git add lib/content content tests
git commit -m "feat: esquema Zod, cargador de contenido con reglas de integridad y nodos iniciales"
```

---

### Task 5: Shell de la app, audiencia, búsqueda y `/explore`

**Files:**
- Create: `lib/audience.ts`, `lib/search.ts`, `hooks/use-url-filters.ts`, `components/audience-provider.tsx`, `components/audience-toggle.tsx`, `components/site-header.tsx`, `components/node-card.tsx`, `components/year-input.tsx`, `components/filter-bar.tsx`, `components/explore-client.tsx`, `app/explore/page.tsx`
- Modify: `app/layout.tsx` (reemplazar completo), `app/page.tsx` (placeholder temporal hasta Task 9)
- Test: `tests/audience.test.ts`, `tests/search.test.ts`

**Interfaces:**
- Consumes: `Filters`, `parseFilters`, `serializeFilters`, `applyFilters`, `toggleValue`, `EMPTY_FILTERS` (Task 3); `NodeMeta`, `toMeta`, `Category`, `getCatalog`, `SectionKey` (Task 4); `formatReleased` (Task 1); `LABELS` y enums (Task 3)
- Produces:
  - `type AudiencePref = 'all' | 'technical' | 'business'`, `readAudience(storage?: Pick<Storage,'getItem'>): AudiencePref`, `writeAudience(storage: Pick<Storage,'setItem'> | undefined, v: AudiencePref): void`, `safeLocalStorage(): Storage | undefined`, `sectionOrder(pref: AudiencePref): SectionKey[]`
  - `createSearch<T extends { title: string; summary: string; category: string[] }>(nodes: T[]): (q: string) => T[]`
  - `useUrlFilters(categoryIds: readonly string[]): [Filters, (f: Filters) => void]`
  - `useAudience(): { audience: AudiencePref; setAudience: (v: AudiencePref) => void }`
  - `<NodeCard node categories />`, `<FilterBar categories filters onChange />`

- [ ] **Step 1: Escribir los tests (fallan)**

`tests/audience.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readAudience, writeAudience, sectionOrder, AUDIENCE_KEY } from '@/lib/audience'

describe('readAudience', () => {
  it('lee un valor válido', () => {
    expect(readAudience({ getItem: () => 'business' })).toBe('business')
  })
  it('devuelve "all" para valores desconocidos o sin storage', () => {
    expect(readAudience({ getItem: () => 'otro' })).toBe('all')
    expect(readAudience({ getItem: () => null })).toBe('all')
    expect(readAudience(undefined)).toBe('all')
  })
  it('devuelve "all" si el storage lanza error', () => {
    expect(readAudience({ getItem: () => { throw new Error('SecurityError') } })).toBe('all')
  })
})

describe('writeAudience', () => {
  it('escribe con la clave esperada y no lanza error si el storage falla', () => {
    const store: Record<string, string> = {}
    writeAudience({ setItem: (k, v) => { store[k] = v } }, 'technical')
    expect(store[AUDIENCE_KEY]).toBe('technical')
    expect(() => writeAudience({ setItem: () => { throw new Error('QuotaExceeded') } }, 'all')).not.toThrow()
  })
})

describe('sectionOrder', () => {
  it('pone primero la sección no técnica para business', () => {
    expect(sectionOrder('business')).toEqual(['nonTechnical', 'purpose', 'usage'])
    expect(sectionOrder('technical')).toEqual(['purpose', 'usage', 'nonTechnical'])
    expect(sectionOrder('all')).toEqual(['purpose', 'usage', 'nonTechnical'])
  })
})
```

`tests/search.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createSearch } from '@/lib/search'

const nodes = [
  { id: 'rag', title: 'RAG (Retrieval-Augmented Generation)', summary: 'Darle al LLM información externa', category: ['retrieval'] },
  { id: 'mcp', title: 'Model Context Protocol', summary: 'Protocolo para conectar herramientas', category: ['protocols'] },
]

describe('createSearch', () => {
  const search = createSearch(nodes)
  it('devuelve todo con una consulta vacía o de espacios', () => {
    expect(search('')).toEqual(nodes)
    expect(search('   ')).toEqual(nodes)
  })
  it('encuentra por título, resumen y categoría', () => {
    expect(search('retrieval').map((n) => n.id)).toContain('rag')
    expect(search('protocolo').map((n) => n.id)).toEqual(['mcp'])
  })
  it('tolera errores de escritura', () => {
    expect(search('protocl').map((n) => n.id)).toContain('mcp')
  })
})
```

Run: `npx vitest run tests/audience.test.ts tests/search.test.ts`
Expected: FAIL, los imports no resuelven.

- [ ] **Step 2: Implementar `lib/audience.ts` y `lib/search.ts`**

`lib/audience.ts`:

```ts
import type { SectionKey } from '@/lib/content/sections'

export type AudiencePref = 'all' | 'technical' | 'business'
export const AUDIENCE_KEY = 'expia.audience'

export function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function readAudience(storage?: Pick<Storage, 'getItem'>): AudiencePref {
  try {
    const v = storage?.getItem(AUDIENCE_KEY)
    return v === 'technical' || v === 'business' ? v : 'all'
  } catch {
    return 'all'
  }
}

export function writeAudience(storage: Pick<Storage, 'setItem'> | undefined, value: AudiencePref): void {
  try {
    storage?.setItem(AUDIENCE_KEY, value)
  } catch {
    // almacenamiento bloqueado: la preferencia vive solo en memoria
  }
}

export function sectionOrder(pref: AudiencePref): SectionKey[] {
  return pref === 'business' ? ['nonTechnical', 'purpose', 'usage'] : ['purpose', 'usage', 'nonTechnical']
}
```

`lib/search.ts`:

```ts
import Fuse from 'fuse.js'

export function createSearch<T extends { title: string; summary: string; category: string[] }>(nodes: T[]) {
  const fuse = new Fuse(nodes, { keys: ['title', 'summary', 'category'], threshold: 0.35, ignoreLocation: true })
  return (q: string): T[] => {
    const query = q.trim()
    return query ? fuse.search(query).map((r) => r.item) : nodes
  }
}
```

Run: `npx vitest run tests/audience.test.ts tests/search.test.ts`
Expected: PASS

- [ ] **Step 3: Crear el proveedor de audiencia, el selector y la cabecera**

`components/audience-provider.tsx`:

```tsx
'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { readAudience, writeAudience, safeLocalStorage, type AudiencePref } from '@/lib/audience'

const AudienceContext = createContext<{ audience: AudiencePref; setAudience: (v: AudiencePref) => void }>({
  audience: 'all',
  setAudience: () => {},
})

export function AudienceProvider({ children }: { children: ReactNode }) {
  const [audience, setState] = useState<AudiencePref>('all')
  useEffect(() => setState(readAudience(safeLocalStorage())), [])
  const setAudience = (v: AudiencePref) => {
    setState(v)
    writeAudience(safeLocalStorage(), v)
  }
  return <AudienceContext.Provider value={{ audience, setAudience }}>{children}</AudienceContext.Provider>
}

export const useAudience = () => useContext(AudienceContext)
```

`components/audience-toggle.tsx`:

```tsx
'use client'
import { useAudience } from './audience-provider'
import type { AudiencePref } from '@/lib/audience'

const OPTIONS: { value: AudiencePref; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'technical', label: 'Técnico' },
  { value: 'business', label: 'No técnico' },
]

export function AudienceToggle() {
  const { audience, setAudience } = useAudience()
  return (
    <div role="group" aria-label="Audiencia" className="inline-flex rounded-md border p-0.5 text-sm">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={audience === o.value}
          onClick={() => setAudience(o.value)}
          className={`rounded px-2.5 py-1 transition ${audience === o.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
```

`components/site-header.tsx`:

```tsx
import Link from 'next/link'
import { AudienceToggle } from './audience-toggle'

const NAV = [
  { href: '/', label: 'Inicio' },
  { href: '/timeline', label: 'Línea de tiempo' },
  { href: '/explore', label: 'Explorar' },
  { href: '/graph', label: 'Mapa' },
]

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/" className="text-base font-bold">ExpIA</Link>
          {NAV.slice(1).map((n) => (
            <Link key={n.href} href={n.href} className="text-muted-foreground hover:text-foreground">{n.label}</Link>
          ))}
        </nav>
        <AudienceToggle />
      </div>
    </header>
  )
}
```

`app/layout.tsx` (reemplazar completo):

```tsx
import type { Metadata } from 'next'
import './globals.css'
import { AudienceProvider } from '@/components/audience-provider'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: { default: 'ExpIA', template: '%s · ExpIA' },
  description: 'Aprende IA navegando conceptos y herramientas por fecha, dependencias y tendencia.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AudienceProvider>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </AudienceProvider>
      </body>
    </html>
  )
}
```

`app/page.tsx` (placeholder temporal, se reemplaza en Task 9):

```tsx
export default function Home() {
  return <h1 className="text-3xl font-bold">ExpIA</h1>
}
```

- [ ] **Step 4: Crear el hook de filtros en la URL, la tarjeta y la barra de filtros**

`hooks/use-url-filters.ts`:

```ts
'use client'
import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { parseFilters, serializeFilters, type Filters } from '@/lib/filters'

export function useUrlFilters(categoryIds: readonly string[]): [Filters, (f: Filters) => void] {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const filters = useMemo(
    () => parseFilters(new URLSearchParams(params.toString()), categoryIds),
    [params, categoryIds],
  )
  const setFilters = useCallback(
    (f: Filters) => {
      const qs = serializeFilters(f)
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname],
  )
  return [filters, setFilters]
}
```

`components/node-card.tsx`:

```tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { LABELS } from '@/lib/content/enums'
import { formatReleased } from '@/lib/dates'
import type { NodeMeta } from '@/lib/content/types'
import type { Category } from '@/lib/content/schema'

export function NodeCard({ node, categories }: { node: NodeMeta; categories: Category[] }) {
  const cats = node.category.map((id) => categories.find((c) => c.id === id)).filter((c): c is Category => !!c)
  return (
    <Link
      href={`/node/${node.id}`}
      data-testid="node-card"
      className="block rounded-lg border p-4 transition hover:border-foreground/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">{node.title}</h3>
        <span className="shrink-0 text-xs text-muted-foreground">{formatReleased(node.date)}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{node.summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{LABELS[node.kind]}</Badge>
        <Badge variant="outline">{LABELS[node.level]}</Badge>
        {(node.status === 'emerging' || node.status === 'rising') && <Badge>{LABELS[node.status]}</Badge>}
        {cats.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
      </div>
    </Link>
  )
}
```

`components/year-input.tsx` (estado local que se confirma al salir del campo o con Enter, para que escribir "20…" no se borre al pasar por la URL):

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'

export function YearInput({ label, value, onCommit }: { label: string; value?: number; onCommit: (v?: number) => void }) {
  const [text, setText] = useState(value?.toString() ?? '')
  useEffect(() => setText(value?.toString() ?? ''), [value])
  const commit = () => {
    if (text === '') return onCommit(undefined)
    if (/^\d{4}$/.test(text)) return onCommit(Number(text))
    setText(value?.toString() ?? '')
  }
  return (
    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {label}
      <Input
        inputMode="numeric"
        className="h-8 w-20"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </label>
  )
}
```

`components/filter-bar.tsx`:

```tsx
'use client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { YearInput } from './year-input'
import { KINDS, AUDIENCES, LEVELS, STATUSES, LICENSES, PRICINGS, LABELS } from '@/lib/content/enums'
import { EMPTY_FILTERS, toggleValue, type Filters } from '@/lib/filters'
import type { Category } from '@/lib/content/schema'

type ListKey = 'cat' | 'kind' | 'aud' | 'level' | 'status' | 'license' | 'pricing'
type Option = { value: string; label: string; color?: string }

function ChipGroup({ label, options, selected, onToggle }: { label: string; options: Option[]; selected: string[]; onToggle: (v: string) => void }) {
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

const enumOptions = (values: readonly string[]): Option[] => values.map((v) => ({ value: v, label: LABELS[v] }))

export function FilterBar({ categories, filters, onChange }: { categories: Category[]; filters: Filters; onChange: (f: Filters) => void }) {
  const toggle = (key: ListKey, v: string) => onChange({ ...filters, [key]: toggleValue(filters[key] as string[], v) } as Filters)
  const groups: { key: ListKey; label: string; options: Option[] }[] = [
    { key: 'cat', label: 'Categoría', options: categories.map((c) => ({ value: c.id, label: c.label, color: c.color })) },
    { key: 'kind', label: 'Tipo', options: enumOptions(KINDS) },
    { key: 'aud', label: 'Audiencia', options: enumOptions(AUDIENCES) },
    { key: 'level', label: 'Nivel', options: enumOptions(LEVELS) },
    { key: 'status', label: 'Estado', options: enumOptions(STATUSES) },
    { key: 'license', label: 'Licencia', options: enumOptions(LICENSES) },
    { key: 'pricing', label: 'Precio', options: enumOptions(PRICINGS) },
  ]
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Input placeholder="Buscar conceptos y herramientas…" value={filters.q} onChange={(e) => onChange({ ...filters, q: e.target.value })} />
      {groups.map((g) => (
        <ChipGroup key={g.key} label={g.label} options={g.options} selected={filters[g.key] as string[]} onToggle={(v) => toggle(g.key, v)} />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <YearInput label="Desde" value={filters.from} onCommit={(from) => onChange({ ...filters, from })} />
        <YearInput label="Hasta" value={filters.to} onCommit={(to) => onChange({ ...filters, to })} />
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>Limpiar filtros</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Crear `/explore`**

`components/explore-client.tsx`:

```tsx
'use client'
import { useMemo } from 'react'
import { FilterBar } from './filter-bar'
import { NodeCard } from './node-card'
import { Button } from '@/components/ui/button'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { applyFilters, EMPTY_FILTERS } from '@/lib/filters'
import { createSearch } from '@/lib/search'
import type { NodeMeta } from '@/lib/content/types'
import type { Category } from '@/lib/content/schema'

export function ExploreClient({ nodes, categories }: { nodes: NodeMeta[]; categories: Category[] }) {
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories])
  const [filters, setFilters] = useUrlFilters(categoryIds)
  const search = useMemo(() => createSearch(nodes), [nodes])
  const results = useMemo(() => applyFilters(search(filters.q), filters), [search, filters])

  return (
    <div className="space-y-6">
      <FilterBar categories={categories} filters={filters} onChange={setFilters} />
      <p className="text-sm text-muted-foreground">{results.length} de {nodes.length} nodos</p>
      {results.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground">Ningún nodo coincide con estos filtros.</p>
          <Button variant="link" onClick={() => setFilters(EMPTY_FILTERS)}>Limpiar filtros</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((n) => <NodeCard key={n.id} node={n} categories={categories} />)}
        </div>
      )}
    </div>
  )
}
```

`app/explore/page.tsx`:

```tsx
import { Suspense } from 'react'
import { getCatalog } from '@/lib/content/load'
import { toMeta } from '@/lib/content/types'
import { ExploreClient } from '@/components/explore-client'

export const metadata = { title: 'Explorar' }

export default function ExplorePage() {
  const { nodes, categories } = getCatalog()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Explorar</h1>
      <Suspense>
        <ExploreClient nodes={nodes.map(toMeta)} categories={categories} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 6: Verificar**

Run: `npm test && npm run build`
Expected: tests PASS; la compilación lista `/explore` como estática (○).

Run: `npm run dev`, abrir `http://localhost:3000/explore`. Verificar: se ven 3 tarjetas; al pulsar "Fundamentos" la URL pasa a `?level=fundamentals`; `?level=foo` muestra las 3 tarjetas; el selector de audiencia cambia de estado y lo conserva al recargar.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: shell de la app, selector de audiencia y página Explorar con filtros en URL"
```

---

### Task 6: Ficha de nodo `/node/[id]`

**Files:**
- Create: `components/markdown.tsx`, `components/node-sections.tsx`, `components/prereq-list.tsx`, `app/node/[id]/page.tsx`

**Interfaces:**
- Consumes: `getCatalog`, `toMeta`, `NodeMeta`, `SECTION_HEADINGS`, `SectionKey` (Task 4); `getPrerequisites`, `getDependents` (Task 2); `useAudience`, `sectionOrder` (Task 5); `LABELS` (Task 3); `formatReleased` (Task 1); `NodeCard` (Task 5)
- Produces: `<Markdown source />`, `<NodeSectionsView rendered />`, `<PrereqList nodes />`

- [ ] **Step 1: Crear los componentes**

`components/markdown.tsx`:

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Markdown({ source }: { source: string }) {
  return (
    <div className="prose prose-neutral max-w-none dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  )
}
```

`components/node-sections.tsx`:

```tsx
'use client'
import type { ReactNode } from 'react'
import { useAudience } from './audience-provider'
import { sectionOrder } from '@/lib/audience'
import { SECTION_HEADINGS, type SectionKey } from '@/lib/content/sections'

export function NodeSectionsView({ rendered }: { rendered: Record<SectionKey, ReactNode> }) {
  const { audience } = useAudience()
  return (
    <div className="space-y-8">
      {sectionOrder(audience).map((key) => (
        <section key={key}>
          <h2 className="mb-3 text-xl font-semibold">{SECTION_HEADINGS[key]}</h2>
          {rendered[key]}
        </section>
      ))}
    </div>
  )
}
```

`components/prereq-list.tsx`:

```tsx
import Link from 'next/link'
import { LABELS } from '@/lib/content/enums'
import type { NodeMeta } from '@/lib/content/types'

export function PrereqList({ nodes }: { nodes: NodeMeta[] }) {
  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">No tiene prerrequisitos: es un buen punto de partida.</p>
  }
  return (
    <ol className="space-y-1.5 text-sm">
      {nodes.map((n, i) => (
        <li key={n.id} className="flex items-baseline gap-2">
          <span className="w-5 shrink-0 text-right text-muted-foreground">{i + 1}.</span>
          <Link href={`/node/${n.id}`} className="hover:underline">{n.title}</Link>
          <span className="text-xs text-muted-foreground">{LABELS[n.level]}</span>
        </li>
      ))}
    </ol>
  )
}
```

- [ ] **Step 2: Crear la página**

`app/node/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalog } from '@/lib/content/load'
import { toMeta } from '@/lib/content/types'
import { getPrerequisites, getDependents } from '@/lib/graph'
import { LABELS } from '@/lib/content/enums'
import { formatReleased } from '@/lib/dates'
import { Badge } from '@/components/ui/badge'
import { Markdown } from '@/components/markdown'
import { NodeSectionsView } from '@/components/node-sections'
import { PrereqList } from '@/components/prereq-list'
import { NodeCard } from '@/components/node-card'

type Props = { params: Promise<{ id: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return getCatalog().nodes.map((n) => ({ id: n.id }))
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const node = getCatalog().byId.get(id)
  return node ? { title: node.title, description: node.summary } : {}
}

const LINK_LABELS: Record<string, string> = { docs: 'Documentación', paper: 'Paper', repo: 'Repositorio', site: 'Sitio' }

export default async function NodePage({ params }: Props) {
  const { id } = await params
  const { nodes, byId, categories } = getCatalog()
  const node = byId.get(id)
  if (!node) notFound()

  const meta = (ids: string[]) => ids.map((i) => toMeta(byId.get(i)!))
  const prereqs = meta(getPrerequisites(nodes, id))
  const dependents = meta(getDependents(nodes, id))
  const related = meta(node.related)

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
      <article className="min-w-0 space-y-6">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">{node.title}</h1>
          <p className="text-lg text-muted-foreground">{node.summary}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{LABELS[node.kind]}</Badge>
            <Badge variant="outline">{LABELS[node.level]}</Badge>
            <Badge variant="outline">{LABELS[node.status]}</Badge>
            {node.license && <Badge variant="outline">{LABELS[node.license]}</Badge>}
            {node.pricing && <Badge variant="outline">{LABELS[node.pricing]}</Badge>}
            <span className="text-muted-foreground">
              {formatReleased(node.date)}{node.origin ? ` · ${node.origin}` : ''}
            </span>
          </div>
          {Object.keys(node.links).length > 0 && (
            <div className="flex flex-wrap gap-3 text-sm">
              {Object.entries(node.links).map(([k, url]) => (
                <a key={k} href={url} target="_blank" rel="noreferrer" className="underline underline-offset-4">{LINK_LABELS[k]}</a>
              ))}
            </div>
          )}
          {!node.verified && (
            <p role="note" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              Contenido sin verificar: las fechas y los enlaces de esta ficha aún no han sido revisados por una persona.
            </p>
          )}
        </header>
        <NodeSectionsView
          rendered={{
            purpose: <Markdown source={node.sections.purpose} />,
            usage: <Markdown source={node.sections.usage} />,
            nonTechnical: <Markdown source={node.sections.nonTechnical} />,
          }}
        />
      </article>

      <aside className="space-y-8">
        <section>
          <h2 className="mb-2 font-semibold">Ruta sugerida</h2>
          <p className="mb-2 text-xs text-muted-foreground">Lo que conviene conocer antes, en orden.</p>
          <PrereqList nodes={prereqs} />
        </section>
        {dependents.length > 0 && (
          <section>
            <h2 className="mb-2 font-semibold">Qué se apoya en esto</h2>
            <ul className="space-y-1 text-sm">
              {dependents.map((d) => (
                <li key={d.id}><Link href={`/node/${d.id}`} className="hover:underline">{d.title}</Link></li>
              ))}
            </ul>
          </section>
        )}
        {related.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-semibold">Relacionados</h2>
            {related.map((r) => <NodeCard key={r.id} node={r} categories={categories} />)}
          </section>
        )}
      </aside>
    </div>
  )
}
```

- [ ] **Step 3: Verificar**

Run: `npm test && npm run build`
Expected: PASS; la salida de la compilación muestra `/node/[id]` con 3 rutas pre-generadas (●).

Run: `npm run dev`, abrir `http://localhost:3000/node/deep-learning`. Verificar: "Ruta sugerida" muestra `1. Machine Learning`, `2. Redes neuronales`; se ve el aviso de contenido sin verificar; al cambiar la audiencia a "No técnico", "Para no técnicos" pasa a ser la primera sección. `/node/no-existe` responde 404.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: ficha de nodo con ruta de prerrequisitos y secciones según audiencia"
```

---

### Task 7: Línea de tiempo `/timeline`

**Files:**
- Create: `lib/timeline.ts`, `components/timeline-client.tsx`, `app/timeline/page.tsx`
- Test: `tests/timeline.test.ts`

**Interfaces:**
- Consumes: `toFractionalYear`, `compareDates`, `formatReleased`, `ReleasedDate`, `Precision` (Task 1); `KINDS`, `Kind`, `LABELS` (Task 3); `useUrlFilters`, `FilterBar`, `createSearch` (Task 5); `applyFilters` (Task 3)
- Produces:
  - `interface TimelineInput { id: string; title: string; kind: Kind; category: string[]; date: ReleasedDate }`
  - `interface TimelineItem { id: string; title: string; kind: Kind; color: string; x: number; width: number; row: number; precision: Precision; dateLabel: string }`
  - `interface TimelineLayout { items: TimelineItem[]; lanes: { kind: Kind; startRow: number; rows: number }[]; totalRows: number; minYear: number; maxYear: number; width: number }`
  - `layoutTimeline(nodes: TimelineInput[], colorOf: (categoryId: string) => string, opts: { pxPerYear: number; maxYear: number; labelWidth: number }): TimelineLayout`
  - `tickStep(pxPerYear: number): number`

- [ ] **Step 1: Escribir el test que falla**

`tests/timeline.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { layoutTimeline, tickStep, type TimelineInput } from '@/lib/timeline'
import { parseReleased } from '@/lib/dates'

const n = (id: string, released: string, kind: TimelineInput['kind'] = 'concept'): TimelineInput => ({
  id, title: id, kind, category: ['llm'], date: parseReleased(released),
})
const opts = { pxPerYear: 10, maxYear: 2030, labelWidth: 50 }
const color = () => '#000000'

describe('layoutTimeline', () => {
  it('redondea minYear hacia abajo a la década y calcula el ancho', () => {
    const l = layoutTimeline([n('a', '2017'), n('b', '2023-06')], color, opts)
    expect(l.minYear).toBe(2010)
    expect(l.width).toBe(200)
  })
  it('dibuja las fechas de solo año como barra de un año y las precisas como punto', () => {
    const l = layoutTimeline([n('a', '2017'), n('b', '2017-07')], color, opts)
    const a = l.items.find((i) => i.id === 'a')!
    const b = l.items.find((i) => i.id === 'b')!
    expect(a).toMatchObject({ x: 70, width: 10, precision: 'year', dateLabel: '2017' })
    expect(b.width).toBe(0)
    expect(b.x).toBeCloseTo(75)
  })
  it('pone en filas distintas los elementos que se solapan', () => {
    const l = layoutTimeline([n('a', '2017'), n('b', '2018'), n('c', '2025')], color, opts)
    const row = (id: string) => l.items.find((i) => i.id === id)!.row
    expect(row('a')).not.toBe(row('b'))   // a ocupa 70..120 por el ancho de etiqueta; b empieza en 80
    expect(row('c')).toBe(row('a'))       // c empieza en 150, ya libre
  })
  it('agrupa por carril de kind en el orden de KINDS, solo los presentes', () => {
    const l = layoutTimeline([n('t', '2020', 'tool'), n('c', '2020', 'concept')], color, opts)
    expect(l.lanes.map((x) => x.kind)).toEqual(['concept', 'tool'])
    expect(l.lanes[1].startRow).toBe(l.lanes[0].rows)
    expect(l.totalRows).toBe(2)
  })
  it('maneja una lista vacía', () => {
    const l = layoutTimeline([], color, opts)
    expect(l.items).toEqual([])
    expect(l.totalRows).toBe(0)
  })
})

describe('tickStep', () => {
  it('adapta las marcas al zoom', () => {
    expect(tickStep(100)).toBe(1)
    expect(tickStep(40)).toBe(5)
    expect(tickStep(10)).toBe(10)
  })
})
```

Run: `npx vitest run tests/timeline.test.ts`
Expected: FAIL, el import no resuelve.

- [ ] **Step 2: Implementar `lib/timeline.ts`**

```ts
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
```

Run: `npx vitest run tests/timeline.test.ts`
Expected: PASS

- [ ] **Step 3: Crear el componente y la página**

`components/timeline-client.tsx`:

```tsx
'use client'
import { useMemo, useState } from 'react'
import { FilterBar } from './filter-bar'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { applyFilters } from '@/lib/filters'
import { createSearch } from '@/lib/search'
import { layoutTimeline, tickStep } from '@/lib/timeline'
import { LABELS } from '@/lib/content/enums'
import type { NodeMeta } from '@/lib/content/types'
import type { Category } from '@/lib/content/schema'

const ROW_H = 28
const AXIS_H = 28
const LABEL_W = 170

export function TimelineClient({ nodes, categories }: { nodes: NodeMeta[]; categories: Category[] }) {
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories])
  const [filters, setFilters] = useUrlFilters(categoryIds)
  const [pxPerYear, setPxPerYear] = useState(40)
  const search = useMemo(() => createSearch(nodes), [nodes])
  const visible = useMemo(() => applyFilters(search(filters.q), filters), [search, filters])
  const colorOf = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.color]))
    return (id: string) => m.get(id) ?? '#888888'
  }, [categories])
  const layout = useMemo(
    () => layoutTimeline(visible, colorOf, { pxPerYear, maxYear: new Date().getFullYear() + 1, labelWidth: LABEL_W }),
    [visible, colorOf, pxPerYear],
  )
  const step = tickStep(pxPerYear)
  const ticks: number[] = []
  for (let y = layout.minYear; y <= layout.maxYear; y += step) ticks.push(y)
  const height = AXIS_H + layout.totalRows * ROW_H + 8

  return (
    <div className="space-y-4">
      <FilterBar categories={categories} filters={filters} onChange={setFilters} />
      <label className="flex items-center gap-3 text-sm text-muted-foreground">
        Zoom
        <input type="range" min={10} max={160} value={pxPerYear} onChange={(e) => setPxPerYear(Number(e.target.value))} className="w-48" />
      </label>
      {layout.items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">Ningún nodo coincide con estos filtros.</p>
      ) : (
        <div className="flex rounded-lg border">
          <div className="relative w-28 shrink-0 border-r text-xs font-medium text-muted-foreground" style={{ height }}>
            {layout.lanes.map((lane) => (
              <div key={lane.kind} className="absolute left-2 border-t pt-1" style={{ top: AXIS_H + lane.startRow * ROW_H, right: 0 }}>
                {LABELS[lane.kind]}
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <svg width={layout.width + LABEL_W} height={height} className="block text-foreground">
              {ticks.map((y) => {
                const x = (y - layout.minYear) * pxPerYear
                return (
                  <g key={y}>
                    <line x1={x} x2={x} y1={AXIS_H - 6} y2={height} stroke="currentColor" strokeOpacity={0.08} />
                    <text x={x + 3} y={16} fontSize={11} fill="currentColor" fillOpacity={0.6}>{y}</text>
                  </g>
                )
              })}
              {layout.lanes.map((lane) => (
                <line key={lane.kind} x1={0} x2={layout.width + LABEL_W} y1={AXIS_H + lane.startRow * ROW_H} y2={AXIS_H + lane.startRow * ROW_H} stroke="currentColor" strokeOpacity={0.15} />
              ))}
              {layout.items.map((item) => {
                const y = AXIS_H + item.row * ROW_H
                return (
                  <a key={item.id} href={`/node/${item.id}`} aria-label={`${item.title}, ${item.dateLabel}`}>
                    <title>{`${item.title} · ${item.dateLabel}`}</title>
                    {item.width > 0 ? (
                      <rect x={item.x} y={y + 7} width={item.width} height={14} rx={3} fill={item.color} fillOpacity={0.3} stroke={item.color} />
                    ) : (
                      <circle cx={item.x} cy={y + 14} r={6} fill={item.color} />
                    )}
                    <text x={item.x + (item.width > 0 ? 4 : 10)} y={y + 18} fontSize={12} fill="currentColor">{item.title}</text>
                  </a>
                )
              })}
            </svg>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Las barras indican que solo se conoce el año; los puntos, una fecha más precisa.</p>
    </div>
  )
}
```

`app/timeline/page.tsx`:

```tsx
import { Suspense } from 'react'
import { getCatalog } from '@/lib/content/load'
import { toMeta } from '@/lib/content/types'
import { TimelineClient } from '@/components/timeline-client'

export const metadata = { title: 'Línea de tiempo' }

export default function TimelinePage() {
  const { nodes, categories } = getCatalog()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Línea de tiempo</h1>
      <Suspense>
        <TimelineClient nodes={nodes.map(toMeta)} categories={categories} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 4: Verificar**

Run: `npm test && npm run build`
Expected: PASS

Run: `npm run dev`, abrir `http://localhost:3000/timeline`. Verificar: aparecen 3 barras en el carril "Concepto" (1943, 1959, 2006); el zoom cambia el espaciado; con el filtro `?from=2000` solo queda Deep Learning; al hacer clic se navega a la ficha.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: línea de tiempo con carriles por tipo, zoom y fechas imprecisas como barras"
```

---

### Task 8: Mapa del grafo `/graph`

**Files:**
- Create: `lib/graph-layout.ts`, `components/graph-client.tsx`, `app/graph/page.tsx`
- Test: `tests/graph-layout.test.ts`

**Interfaces:**
- Consumes: `getPrerequisites`, `getDependents` (Task 2); `useUrlFilters`, `FilterBar`, `createSearch` (Task 5); `applyFilters` (Task 3)
- Produces:
  - `NODE_SIZE = { width: 180, height: 44 }`
  - `layoutGraph(nodes: { id: string; requires: string[] }[]): { positions: Record<string, { x: number; y: number }>; edges: { id: string; source: string; target: string }[] }`

- [ ] **Step 1: Escribir el test que falla**

`tests/graph-layout.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { layoutGraph } from '@/lib/graph-layout'

describe('layoutGraph', () => {
  const nodes = [
    { id: 'a', requires: [] },
    { id: 'b', requires: ['a'] },
    { id: 'c', requires: ['b', 'oculto'] },
  ]
  it('pone cada prerrequisito a la izquierda de quien lo requiere', () => {
    const { positions } = layoutGraph(nodes)
    expect(positions.a.x).toBeLessThan(positions.b.x)
    expect(positions.b.x).toBeLessThan(positions.c.x)
  })
  it('solo crea aristas entre nodos visibles, del prerrequisito al dependiente', () => {
    const { edges } = layoutGraph(nodes)
    expect(edges).toEqual([
      { id: 'a->b', source: 'a', target: 'b' },
      { id: 'b->c', source: 'b', target: 'c' },
    ])
  })
  it('maneja una lista vacía', () => {
    expect(layoutGraph([])).toEqual({ positions: {}, edges: [] })
  })
})
```

Run: `npx vitest run tests/graph-layout.test.ts`
Expected: FAIL, el import no resuelve.

- [ ] **Step 2: Implementar `lib/graph-layout.ts`**

```ts
import dagre from '@dagrejs/dagre'

export const NODE_SIZE = { width: 180, height: 44 }

export function layoutGraph(nodes: { id: string; requires: string[] }[]) {
  const visible = new Set(nodes.map((n) => n.id))
  const edges = nodes.flatMap((n) =>
    n.requires.filter((r) => visible.has(r)).map((r) => ({ id: `${r}->${n.id}`, source: r, target: n.id })),
  )
  const positions: Record<string, { x: number; y: number }> = {}
  if (nodes.length === 0) return { positions, edges }

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 16, ranksep: 70 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of nodes) g.setNode(n.id, { ...NODE_SIZE })
  for (const e of edges) g.setEdge(e.source, e.target)
  dagre.layout(g)

  for (const n of nodes) {
    const { x, y } = g.node(n.id)
    positions[n.id] = { x: x - NODE_SIZE.width / 2, y: y - NODE_SIZE.height / 2 }
  }
  return { positions, edges }
}
```

Run: `npx vitest run tests/graph-layout.test.ts`
Expected: PASS

- [ ] **Step 3: Crear el componente y la página**

`components/graph-client.tsx`:

```tsx
'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ReactFlow, Background, Controls, Position, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { FilterBar } from './filter-bar'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { applyFilters } from '@/lib/filters'
import { createSearch } from '@/lib/search'
import { layoutGraph, NODE_SIZE } from '@/lib/graph-layout'
import { getPrerequisites, getDependents } from '@/lib/graph'
import type { NodeMeta } from '@/lib/content/types'
import type { Category } from '@/lib/content/schema'

export function GraphClient({ nodes, categories }: { nodes: NodeMeta[]; categories: Category[] }) {
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories])
  const [filters, setFilters] = useUrlFilters(categoryIds)
  const [selected, setSelected] = useState<string | null>(null)
  const search = useMemo(() => createSearch(nodes), [nodes])
  const visible = useMemo(() => applyFilters(search(filters.q), filters), [search, filters])
  const layout = useMemo(() => layoutGraph(visible), [visible])
  const colorOf = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories])

  const selectedNode = visible.find((n) => n.id === selected)
  const highlight = useMemo(
    () => (selectedNode ? new Set([selectedNode.id, ...getPrerequisites(visible, selectedNode.id), ...getDependents(visible, selectedNode.id)]) : null),
    [selectedNode, visible],
  )

  const rfNodes: Node[] = visible.map((n) => ({
    id: n.id,
    position: layout.positions[n.id],
    data: { label: n.title },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    style: {
      width: NODE_SIZE.width,
      fontSize: 12,
      borderWidth: 2,
      borderColor: colorOf.get(n.category[0]) ?? '#888888',
      opacity: highlight && !highlight.has(n.id) ? 0.2 : 1,
    },
  }))
  const rfEdges: Edge[] = layout.edges.map((e) => {
    const on = !!highlight && highlight.has(e.source) && highlight.has(e.target)
    return { ...e, animated: on, style: { opacity: highlight && !on ? 0.08 : 1 } }
  })

  return (
    <div className="space-y-4">
      <FilterBar categories={categories} filters={filters} onChange={setFilters} />
      <p className="text-sm text-muted-foreground">Haz clic en un nodo para resaltar lo que necesitas antes y lo que se apoya en él.</p>
      <div className="relative h-[70vh] rounded-lg border">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodeClick={(_, n) => setSelected(n.id)}
          onPaneClick={() => setSelected(null)}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          minZoom={0.1}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
        {selectedNode && (
          <div className="absolute right-3 top-3 z-10 w-64 rounded-lg border bg-background p-3 text-sm shadow">
            <p className="font-semibold">{selectedNode.title}</p>
            <p className="mt-1 text-muted-foreground">{selectedNode.summary}</p>
            <Link href={`/node/${selectedNode.id}`} className="mt-2 inline-block underline underline-offset-4">Ver ficha</Link>
          </div>
        )}
      </div>
    </div>
  )
}
```

`app/graph/page.tsx`:

```tsx
import { Suspense } from 'react'
import { getCatalog } from '@/lib/content/load'
import { toMeta } from '@/lib/content/types'
import { GraphClient } from '@/components/graph-client'

export const metadata = { title: 'Mapa' }

export default function GraphPage() {
  const { nodes, categories } = getCatalog()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mapa de dependencias</h1>
      <Suspense>
        <GraphClient nodes={nodes.map(toMeta)} categories={categories} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 4: Verificar**

Run: `npm test && npm run build`
Expected: PASS

Run: `npm run dev`, abrir `http://localhost:3000/graph`. Verificar: 3 nodos de izquierda a derecha (Machine Learning → Redes neuronales → Deep Learning); clic en Deep Learning resalta los tres y muestra el panel; clic en el fondo limpia la selección.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: mapa interactivo del grafo de dependencias con resaltado"
```

---

### Task 9: Dashboard `/`

**Files:**
- Create: `lib/dashboard.ts`
- Modify: `app/page.tsx` (reemplazar el placeholder de Task 5)
- Test: `tests/dashboard.test.ts`

**Interfaces:**
- Consumes: `NodeMeta`, `Category`, `getCatalog`, `toMeta` (Task 4); `compareDates` (Task 1); `NodeCard` (Task 5)
- Produces:
  - `countByCategory(nodes: NodeMeta[], categories: Category[]): { category: Category; count: number }[]` (desc, sin categorías vacías)
  - `selectTrending(nodes: NodeMeta[], limit?: number): NodeMeta[]` (por defecto 8)
  - `selectLatestAdded(nodes: NodeMeta[], limit?: number): NodeMeta[]` (por defecto 6)
  - `selectFundamentals(nodes: NodeMeta[]): NodeMeta[]` (fecha asc)

- [ ] **Step 1: Escribir el test que falla**

`tests/dashboard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { countByCategory, selectTrending, selectLatestAdded, selectFundamentals } from '@/lib/dashboard'
import { parseReleased } from '@/lib/dates'
import type { NodeMeta } from '@/lib/content/types'

const n = (id: string, o: Partial<NodeMeta> & { released?: string } = {}): NodeMeta => {
  const released = o.released ?? '2020'
  return {
    id, title: id, kind: 'concept', category: ['llm'], released, audience: ['technical'], level: 'intermediate',
    requires: [], related: [], status: 'mainstream', links: {}, summary: 's', verified: false, added: '2026-10-17',
    voices: [], ...o, date: parseReleased(released),
  }
}

describe('dashboard', () => {
  it('countByCategory ordena desc y omite las vacías', () => {
    const cats = [{ id: 'llm', label: 'LLM', color: '#000000' }, { id: 'agents', label: 'A', color: '#111111' }, { id: 'audio', label: 'Au', color: '#222222' }]
    const res = countByCategory([n('a'), n('b', { category: ['llm', 'agents'] })], cats)
    expect(res.map((r) => [r.category.id, r.count])).toEqual([['llm', 2], ['agents', 1]])
  })
  it('selectTrending toma emerging/rising, los más recientes primero, con límite', () => {
    const nodes = [
      n('old', { status: 'rising', released: '2019' }),
      n('new', { status: 'emerging', released: '2025-03' }),
      n('main', { status: 'mainstream', released: '2026' }),
      n('mid', { status: 'rising', released: '2023' }),
    ]
    expect(selectTrending(nodes).map((x) => x.id)).toEqual(['new', 'mid', 'old'])
    expect(selectTrending(nodes, 2).map((x) => x.id)).toEqual(['new', 'mid'])
  })
  it('selectLatestAdded ordena por added desc, por defecto 6', () => {
    const nodes = Array.from({ length: 8 }, (_, i) => n(`n${i}`, { added: `2026-10-0${i + 1}` }))
    expect(selectLatestAdded(nodes).map((x) => x.id)).toEqual(['n7', 'n6', 'n5', 'n4', 'n3', 'n2'])
  })
  it('selectFundamentals filtra por nivel y ordena por fecha', () => {
    const nodes = [n('b', { level: 'fundamentals', released: '2006' }), n('x'), n('a', { level: 'fundamentals', released: '1959' })]
    expect(selectFundamentals(nodes).map((x) => x.id)).toEqual(['a', 'b'])
  })
})
```

Run: `npx vitest run tests/dashboard.test.ts`
Expected: FAIL, el import no resuelve.

- [ ] **Step 2: Implementar `lib/dashboard.ts`**

```ts
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
```

Run: `npx vitest run tests/dashboard.test.ts`
Expected: PASS

- [ ] **Step 3: Reemplazar `app/page.tsx`**

```tsx
import Link from 'next/link'
import { getCatalog } from '@/lib/content/load'
import { toMeta } from '@/lib/content/types'
import { countByCategory, selectTrending, selectLatestAdded, selectFundamentals } from '@/lib/dashboard'
import { NodeCard } from '@/components/node-card'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export default function Home() {
  const { nodes, categories } = getCatalog()
  const metas = nodes.map(toMeta)
  const counts = countByCategory(metas, categories)
  const max = Math.max(1, ...counts.map((c) => c.count))
  const trending = selectTrending(metas)
  const latest = selectLatestAdded(metas)
  const fundamentals = selectFundamentals(metas)

  return (
    <div className="space-y-12">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold">ExpIA</h1>
        <p className="max-w-2xl text-muted-foreground">
          Aprende IA navegando conceptos y herramientas por fecha, por lo que necesitas saber antes y por lo que está tomando fuerza.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Nodos en total" value={metas.length} />
        <Stat label="Conceptos y técnicas" value={metas.filter((n) => n.kind === 'concept' || n.kind === 'technique').length} />
        <Stat label="Herramientas y modelos" value={metas.filter((n) => n.kind === 'tool' || n.kind === 'model').length} />
        <Stat label="Tomando fuerza" value={metas.filter((n) => n.status === 'emerging' || n.status === 'rising').length} />
      </section>

      {trending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Tomando fuerza</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trending.map((n) => <NodeCard key={n.id} node={n} categories={categories} />)}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Por categoría</h2>
        <ul className="space-y-1.5">
          {counts.map(({ category, count }) => (
            <li key={category.id}>
              <Link href={`/explore?cat=${category.id}`} className="group grid grid-cols-[160px_1fr_32px] items-center gap-3 text-sm">
                <span className="truncate group-hover:underline">{category.label}</span>
                <span className="h-2 rounded-full bg-muted">
                  <span className="block h-2 rounded-full" style={{ width: `${(count / max) * 100}%`, background: category.color }} />
                </span>
                <span className="text-right tabular-nums text-muted-foreground">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Empieza por los fundamentos</h2>
        <div className="flex flex-wrap gap-2">
          {fundamentals.map((n) => (
            <Link key={n.id} href={`/node/${n.id}`} className="rounded-full border px-3 py-1 text-sm hover:border-foreground/40">{n.title}</Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Últimos agregados</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((n) => <NodeCard key={n.id} node={n} categories={categories} />)}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Verificar**

Run: `npm test && npm run build`
Expected: PASS

Run: `npm run dev`, abrir `http://localhost:3000/`. Verificar: las estadísticas muestran 3 nodos; "Tomando fuerza" no aparece (aún no hay nodos emerging/rising); la barra de "Fundamentos" enlaza a `/explore?cat=foundations`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: dashboard con estadísticas, tendencias, categorías y fundamentos"
```

---

### Task 10: Contenido semilla (unos 60 nodos)

**Files:**
- Create: `content/nodes/<id>.mdx` para cada fila de la tabla (los 3 marcados "existe" ya están creados)
- Test: `tests/content-integrity.test.ts` (ya existe; es la barrera de calidad)

**Interfaces:**
- Consumes: esquema del nodo (Task 4) y taxonomía (Task 4)

**Reglas de redacción (para todos los nodos):**
- Español. Frontmatter exactamente como el de `content/nodes/deep-learning.mdx`, con los valores de la tabla. Todos llevan `verified: false` y `added: 2026-10-17`.
- `summary`: una frase de 160 caracteres como máximo, sin jerga.
- `## Para qué sirve`: 1 o 2 párrafos con casos concretos.
- `## Cómo se usa`: pasos numerados. Las herramientas, APIs y técnicas técnicas llevan un bloque de código corto y realista (TypeScript o Python). Los conceptos explican el flujo de trabajo.
- `## Para no técnicos`: una analogía y un caso de negocio, sin jerga ni código.
- `links`: solo URLs oficiales que conozcas con certeza (documentación oficial, arXiv, repo principal). Si dudas, omite el link: un link ausente es mejor que uno inventado.
- `origin`: la organización o los autores. Si no es claro, omítelo.
- `related`: opcional, 0 a 3 IDs de esta misma tabla.

**Tabla de nodos.** Columnas: id · title · kind · category · released · level · audience (T=technical, B=business) · requires · status · license/pricing

| id | title | kind | category | released | level | aud | requires | status | lic/price |
|---|---|---|---|---|---|---|---|---|---|
| machine-learning | Machine Learning | concept | foundations | 1959 | fundamentals | T,B | — | mainstream | — (existe) |
| neural-network | Redes neuronales | concept | foundations | 1943 | fundamentals | T,B | machine-learning | mainstream | — (existe) |
| deep-learning | Deep Learning | concept | foundations | 2006 | fundamentals | T,B | neural-network | mainstream | — (existe) |
| perceptron | Perceptrón | concept | foundations | 1958 | fundamentals | T | neural-network | declining | — |
| backpropagation | Backpropagation | technique | foundations | 1986 | intermediate | T | neural-network | mainstream | — |
| cnn | Redes convolucionales (CNN) | concept | foundations, vision | 1989 | intermediate | T | deep-learning, backpropagation | mainstream | — |
| rnn-lstm | RNN y LSTM | concept | foundations | 1997 | intermediate | T | deep-learning, backpropagation | declining | — |
| embeddings | Embeddings | concept | foundations, retrieval | 2013 | fundamentals | T,B | neural-network | mainstream | — |
| tokenization | Tokens y tokenización | concept | foundations, llm | 2015-08 | fundamentals | T,B | — | mainstream | — |
| gans | GANs | concept | generative-media | 2014-06 | intermediate | T | deep-learning | declining | — |
| attention | Mecanismo de atención | concept | foundations | 2014-09 | intermediate | T | rnn-lstm, embeddings | mainstream | — |
| transformer | Transformer | concept | foundations, llm | 2017-06 | intermediate | T,B | attention, embeddings, tokenization | mainstream | — |
| transfer-learning | Transfer learning | technique | foundations | 2018-01 | intermediate | T | deep-learning | mainstream | — |
| llm | Modelos de lenguaje grandes (LLM) | concept | llm | 2018-06 | fundamentals | T,B | transformer, tokenization | mainstream | — |
| fine-tuning | Fine-tuning | technique | llm | 2018-06 | intermediate | T,B | llm, transfer-learning | mainstream | — |
| gpt | GPT (OpenAI) | model | llm | 2018-06 | fundamentals | T,B | llm | mainstream | proprietary/freemium |
| bert | BERT | model | llm | 2018-10 | intermediate | T | transformer | declining | open-source/free |
| rlhf | RLHF | technique | llm, safety | 2017-06 | advanced | T | fine-tuning | mainstream | — |
| prompting | Prompt engineering | technique | llm-apps | 2020-05 | fundamentals | T,B | llm | mainstream | — |
| rag | RAG (Retrieval-Augmented Generation) | technique | retrieval, llm-apps | 2020-05 | intermediate | T,B | llm, embeddings, vector-db | mainstream | — |
| semantic-search | Búsqueda semántica | technique | retrieval | 2019-08 | intermediate | T,B | embeddings | mainstream | — |
| vector-db | Bases de datos vectoriales | concept | retrieval, infra | 2019-10 | intermediate | T | embeddings | mainstream | — |
| diffusion-models | Modelos de difusión | concept | generative-media | 2020-06 | intermediate | T,B | deep-learning | mainstream | — |
| openai-api | OpenAI API | tool | llm | 2020-06 | fundamentals | T | gpt | mainstream | proprietary/paid |
| multimodal-models | Modelos multimodales | concept | llm, vision | 2021-01 | intermediate | T,B | llm, embeddings | mainstream | — |
| pinecone | Pinecone | tool | retrieval, infra | 2021-01 | intermediate | T | vector-db | mainstream | proprietary/freemium |
| pgvector | pgvector | tool | retrieval, infra | 2021-04 | intermediate | T | vector-db | mainstream | open-source/free |
| lora | LoRA | technique | llm | 2021-06 | advanced | T | fine-tuning | mainstream | — |
| github-copilot | GitHub Copilot | tool | dev-tools | 2021-06 | fundamentals | T | llm | mainstream | proprietary/paid |
| chain-of-thought | Chain-of-thought | technique | llm-apps | 2022-01 | intermediate | T | prompting | mainstream | — |
| quantization | Cuantización | technique | infra | 2022-08 | advanced | T | llm | mainstream | — |
| stable-diffusion | Stable Diffusion | model | generative-media | 2022-08 | fundamentals | T,B | diffusion-models | mainstream | open-source/free |
| whisper | Whisper | model | audio | 2022-09 | intermediate | T | transformer | mainstream | open-source/free |
| agents | Agentes de IA | concept | agents | 2022-10 | intermediate | T,B | llm, tool-use, prompting | mainstream | — |
| langchain | LangChain | tool | frameworks | 2022-10 | intermediate | T | llm, prompting | mainstream | open-source/free |
| chroma | Chroma | tool | retrieval | 2022-10 | intermediate | T | vector-db | mainstream | open-source/free |
| llamaindex | LlamaIndex | tool | frameworks, retrieval | 2022-11 | intermediate | T | rag | mainstream | open-source/free |
| llama | Llama (Meta) | model | llm | 2023-02 | intermediate | T | llm | mainstream | open-source/free |
| claude | Claude (Anthropic) | model | llm | 2023-03 | fundamentals | T,B | llm | mainstream | proprietary/freemium |
| anthropic-api | Anthropic API | tool | llm | 2023-03 | fundamentals | T | claude | mainstream | proprietary/paid |
| cursor | Cursor | tool | dev-tools | 2023-03 | fundamentals | T | llm | mainstream | proprietary/freemium |
| evals | Evals | technique | evaluation | 2023-03 | intermediate | T,B | llm, prompting | rising | — |
| tool-use | Function calling / Tool use | technique | llm-apps, agents | 2023-06 | intermediate | T | llm, prompting | mainstream | — |
| vercel-ai-sdk | Vercel AI SDK | tool | frameworks | 2023-06 | intermediate | T | llm, tool-use | mainstream | open-source/free |
| vllm | vLLM | tool | infra | 2023-06 | advanced | T | llm | mainstream | open-source/free |
| ollama | Ollama | tool | infra | 2023-07 | intermediate | T | llm, quantization | mainstream | open-source/free |
| guardrails | Guardrails | technique | safety | 2023 | intermediate | T,B | llm, evals | rising | — |
| multi-agent | Sistemas multiagente | concept | agents | 2023-08 | advanced | T,B | agents | rising | — |
| mistral | Mistral | model | llm | 2023-09 | intermediate | T | llm | mainstream | open-source/freemium |
| gemini | Gemini (Google) | model | llm | 2023-12 | fundamentals | T,B | llm | mainstream | proprietary/freemium |
| hugging-face | Hugging Face | tool | infra, frameworks | 2018-11 | intermediate | T | llm | mainstream | open-source/freemium |
| n8n | n8n | tool | agents, dev-tools | 2019-10 | fundamentals | T,B | llm | rising | —/freemium |
| structured-outputs | Salidas estructuradas | technique | llm-apps | 2024-08 | intermediate | T | tool-use | mainstream | — |
| reasoning-models | Modelos de razonamiento | concept | llm | 2024-09 | intermediate | T,B | llm, chain-of-thought | rising | — |
| computer-use | Computer use | technique | agents | 2024-10 | advanced | T,B | agents, multimodal-models | rising | — |
| mcp | Model Context Protocol (MCP) | protocol | protocols, agents | 2024-11 | intermediate | T,B | tool-use | mainstream | open-source/free |
| claude-code | Claude Code | tool | dev-tools, agents | 2025-02 | fundamentals | T | agents | rising | proprietary/paid |
| a2a | Protocolo A2A | protocol | protocols, agents | 2025-04 | advanced | T | agents, mcp | emerging | open-source/free |
| context-engineering | Context engineering | technique | llm-apps, agents | 2025-06 | intermediate | T,B | prompting, rag, tool-use | rising | — |
| claude-agent-sdk | Claude Agent SDK | tool | frameworks, agents | 2025-09 | intermediate | T | agents, tool-use, anthropic-api | rising | open-source/free |
| agent-skills | Agent Skills | concept | agents | 2025-10 | intermediate | T,B | agents, context-engineering | emerging | — |

- [ ] **Step 1: Lote 1, fundamentos (filas perceptron a transfer-learning, 10 nodos)**

Crear cada archivo siguiendo las reglas de redacción. Después:

Run: `npx vitest run tests/content-integrity.test.ts`
Expected: PASS. Si falla, el mensaje indica `nodes/<archivo>.mdx › <campo>`: corregir y volver a correr.

```bash
git add content/nodes && git commit -m "content: lote 1, fundamentos"
```

- [ ] **Step 2: Lote 2, LLMs y modelos (llm, fine-tuning, gpt, bert, rlhf, llama, claude, mistral, gemini, diffusion-models, multimodal-models, reasoning-models, stable-diffusion, whisper)**

Los `requires` de este lote apuntan a nodos de lotes futuros (p. ej. `reasoning-models` → `chain-of-thought`). Para que el test de integridad pase al cerrar cada lote, crea primero los nodos referenciados que falten, adelantándolos de lotes posteriores, o crea los nodos en el orden de la tabla.

Run: `npx vitest run tests/content-integrity.test.ts`
Expected: PASS

```bash
git add content/nodes && git commit -m "content: lote 2, LLMs y modelos"
```

- [ ] **Step 3: Lote 3, construir con IA (prompting, chain-of-thought, rag, semantic-search, vector-db, tool-use, structured-outputs, agents, multi-agent, computer-use, mcp, a2a, context-engineering, agent-skills, evals, guardrails, lora, quantization)**

Run: `npx vitest run tests/content-integrity.test.ts`
Expected: PASS

```bash
git add content/nodes && git commit -m "content: lote 3, construir con IA"
```

- [ ] **Step 4: Lote 4, herramientas (openai-api, anthropic-api, langchain, llamaindex, claude-agent-sdk, vercel-ai-sdk, hugging-face, ollama, vllm, cursor, claude-code, github-copilot, pgvector, pinecone, chroma, n8n)**

Run: `npx vitest run tests/content-integrity.test.ts && ls content/nodes | wc -l`
Expected: PASS; 61 archivos.

```bash
git add content/nodes && git commit -m "content: lote 4, herramientas"
```

- [ ] **Step 5: Verificación visual**

Run: `npm run build && npm run start`
Abrir `/`, `/timeline`, `/graph` y `/node/rag`. Verificar: el dashboard muestra 61 nodos y "Tomando fuerza" lista 8 (los emerging/rising más recientes, empezando por Agent Skills); la ruta sugerida de `/node/rag` incluye Embeddings, Bases de datos vectoriales y LLM; el mapa se ve legible con el zoom de React Flow.

---

### Task 11: Smoke tests E2E, CI y README

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`, `.github/workflows/ci.yml`
- Modify: `README.md` (reemplazar completo)

**Interfaces:**
- Consumes: todas las rutas; `data-testid="node-card"` (Task 5); botones de filtro con `aria-pressed` y etiquetas de `LABELS` (Task 5)

- [ ] **Step 1: Configurar Playwright**

```bash
npx playwright install chromium
```

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:3100' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run start -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
```

En `vitest.config.ts`, el `include: ['tests/**/*.test.ts']` ya excluye `e2e/`.

- [ ] **Step 2: Escribir los smoke tests**

`e2e/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('el dashboard muestra tendencias', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ExpIA', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tomando fuerza' })).toBeVisible()
})

test('explorar filtra por tipo y lo refleja en la URL', async ({ page }) => {
  await page.goto('/explore')
  const cards = page.getByTestId('node-card')
  const total = await cards.count()
  expect(total).toBeGreaterThan(10)
  await page.getByRole('button', { name: 'Herramienta' }).click()
  await expect(page).toHaveURL(/kind=tool/)
  await expect.poll(() => cards.count()).toBeLessThan(total)
  for (const card of await cards.all()) await expect(card).toContainText('Herramienta')
})

test('explorar tolera parámetros inválidos', async ({ page }) => {
  await page.goto('/explore?level=foo&from=abc&cat=nope&to=99999')
  await expect(page.getByTestId('node-card').first()).toBeVisible()
})

test('la ficha muestra la ruta de prerrequisitos', async ({ page }) => {
  await page.goto('/node/rag')
  await expect(page.getByRole('heading', { name: 'Ruta sugerida' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Embeddings' }).first()).toBeVisible()
})

test('la línea de tiempo enlaza a las fichas', async ({ page }) => {
  await page.goto('/timeline')
  await expect(page.locator('svg a[href="/node/transformer"]')).toHaveCount(1)
})

test('el mapa dibuja los nodos', async ({ page }) => {
  await page.goto('/graph')
  await expect.poll(() => page.locator('.react-flow__node').count()).toBeGreaterThan(10)
})
```

- [ ] **Step 3: Correr los E2E**

Run: `npm run test:e2e`
Expected: 6 passed

- [ ] **Step 4: Crear el CI**

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env:
          CI: 'true'
```

- [ ] **Step 5: Reemplazar `README.md`**

````markdown
# ExpIA

Dashboard para aprender y enseñar IA: conceptos y herramientas en una línea de tiempo, con filtros, dependencias, explicaciones técnicas y no técnicas, y lo que está tomando fuerza.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit + integridad del contenido
npm run test:e2e   # smoke tests con Playwright
```

## Agregar o editar contenido

Cada concepto o herramienta es un archivo `content/nodes/<id>.mdx`. Copia uno existente, ajusta el frontmatter y escribe las tres secciones obligatorias (`## Para qué sirve`, `## Cómo se usa`, `## Para no técnicos`). Las categorías válidas están en `content/taxonomy.yaml`.

`npm test` valida todo el contenido: dependencias inexistentes, ciclos, categorías desconocidas o secciones faltantes hacen fallar el test con el archivo y el campo exactos. Cuando revises fechas y links de un nodo, cambia `verified: false` a `true`.

## Hoja de ruta

1. **Catálogo y exploración** (este repo)
2. Referentes por tema y red social
3. Radar tecnológico personal y de equipo
4. Tendencias y resumen automático (agente que propone PRs)
5. Modo enseñanza: rutas, cursos y progreso

Especificación: `docs/superpowers/specs/2026-10-17-catalogo-ia-design.md`
````

- [ ] **Step 6: Verificación final**

Run: `npm test && npm run test:e2e`
Expected: todos los tests unitarios y E2E en PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: smoke tests E2E, CI en GitHub Actions y README"
```
