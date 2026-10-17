# Modo enseñanza (5a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rutas de aprendizaje (4 curadas + una generada por nodo) con preguntas de repaso en los 61 nodos y progreso por nodo guardado en el navegador.

**Architecture:** Contenido nuevo en MDX validado al cargar (`review` opcional en nodos, `content/paths/*.mdx`). Lógica pura en `lib/paths.ts` y `lib/learned.ts`; páginas estáticas (`/paths`, `/paths/[id]`, `/learn/[id]`); el progreso lo lee un `LearnedProvider` cliente desde `localStorage` tras hidratar, igual que `AudienceProvider`.

**Tech Stack:** Next.js 15.5 SSG, React 19, TypeScript, Tailwind 4, Zod 3, gray-matter + js-yaml (`JSON_SCHEMA`), Vitest (entorno node), Playwright (puerto 3100).

**Spec:** `docs/superpowers/specs/2026-10-17-modo-ensenanza-design.md`

## Global Constraints

- Todo texto visible, mensajes de error y contenido en español; ids y claves de frontmatter en inglés kebab-case/camelCase como el resto del repo.
- `review`: opcional en el nodo; si está, de 2 a 3 ítems; `question` ≤ 200 caracteres, `answer` ≤ 400.
- Ruta curada: `id` igual al nombre del archivo; `audience` ⊆ {technical, business}, mínimo 1; `goal` ≤ 160; `after` opcional; `steps` de 3 a 12; `note` ≤ 280; cuerpo sin títulos `##`.
- Reglas de integridad 3.3 del spec rompen la compilación (`ContentError`).
- Progreso en `localStorage` clave `expia.learned`, arreglo JSON de ids; corrupto → vacío; ids desconocidos ignorados; duplicados eliminados; almacenamiento bloqueado → solo en memoria.
- Sin servidor, cuentas ni base de datos. Sin dependencias nuevas.
- Las respuestas de repaso salen solo del texto del nodo; no se inventan datos.
- Commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Hidratación:** el HTML estático se renderiza sin marcas y luego aparecen; no debe haber errores de hidratación en consola en `/paths/fundamentos` (test E2E en Task 10).
2. **Clic antes de hidratar:** un clic en "Lo aprendí" antes de que React hidrate se pierde; los botones exponen `data-ready` y los E2E esperan `data-ready="true"` antes de hacer clic (Tasks 9–11).
3. **`localStorage` bloqueado** (Safari privado, cookies bloqueadas): la página no rompe y el botón funciona en memoria (test E2E con `addInitScript` que hace lanzar a `localStorage`, Task 9).
4. **Sincronización entre pestañas:** marcar en una pestaña se refleja en otra abierta del mismo navegador (test E2E con dos páginas del mismo contexto, Task 10).
5. **Nodos nuevos del radar sin `review`:** cargan, muestran "Sin preguntas de repaso aún" y no rompen el test de integridad (exentos los `new-node` de los informes; test en Task 4 y test de carga en Task 1).

---

### Task 1: Esquema de preguntas de repaso en el nodo

**Files:**
- Modify: `lib/content/schema.ts` (dentro de `nodeFrontmatterSchema`)
- Test: `tests/load.test.ts`

**Interfaces:**
- Produces: `NodeFrontmatter['review']: { question: string; answer: string }[] | undefined`; exporta `ReviewItem = NonNullable<NodeFrontmatter['review']>[number]` desde `lib/content/schema.ts`.

- [ ] **Step 1: Write the failing tests** — al final del `describe('loadCatalog', ...)` de `tests/load.test.ts`:

```ts
  it('carga las preguntas de repaso de un nodo', () => {
    const review = '[{ question: "¿Para qué sirve?", answer: "Para algo." }, { question: "¿Cuándo se usa?", answer: "Siempre." }]'
    const { byId } = loadCatalog(makeContent({ a: file(fm('a', { review })) }))
    expect(byId.get('a')!.review).toEqual([
      { question: '¿Para qué sirve?', answer: 'Para algo.' },
      { question: '¿Cuándo se usa?', answer: 'Siempre.' },
    ])
  })
  it('un nodo sin preguntas de repaso sigue cargando', () => {
    const { byId } = loadCatalog(makeContent({ a: file(fm('a')) }))
    expect(byId.get('a')!.review).toBeUndefined()
  })
  it('exige de 2 a 3 preguntas de repaso', () => {
    const one = '[{ question: "¿q?", answer: "a" }]'
    const four = `[${Array(4).fill('{ question: "¿q?", answer: "a" }').join(', ')}]`
    expect(errorsOf(makeContent({ a: file(fm('a', { review: one })) })).join()).toMatch(/nodes\/a\.mdx › review/)
    expect(errorsOf(makeContent({ a: file(fm('a', { review: four })) })).join()).toMatch(/nodes\/a\.mdx › review/)
  })
  it('limita el largo de pregunta y respuesta', () => {
    const longQ = `[{ question: "${'x'.repeat(201)}", answer: "a" }, { question: "¿q?", answer: "a" }]`
    const longA = `[{ question: "¿q?", answer: "${'x'.repeat(401)}" }, { question: "¿q?", answer: "a" }]`
    expect(errorsOf(makeContent({ a: file(fm('a', { review: longQ })) })).join()).toMatch(/review\.0\.question/)
    expect(errorsOf(makeContent({ a: file(fm('a', { review: longA })) })).join()).toMatch(/review\.0\.answer/)
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/load.test.ts`
Expected: FAIL — el primer test reporta `Unrecognized key(s) in object: 'review'` (el esquema es `.strict()`).

- [ ] **Step 3: Implement** — en `lib/content/schema.ts`, antes de `export const nodeFrontmatterSchema`:

```ts
const reviewSchema = z
  .array(z.object({ question: z.string().min(1).max(200), answer: z.string().min(1).max(400) }).strict())
  .min(2)
  .max(3)
```

y dentro del objeto de `nodeFrontmatterSchema`, después de `summary`:

```ts
    review: reviewSchema.optional(),
```

y junto a los otros tipos exportados:

```ts
export type ReviewItem = NonNullable<NodeFrontmatter['review']>[number]
```

- [ ] **Step 4: Run to verify they pass, then the whole suite**

Run: `npx vitest run tests/load.test.ts && npm test`
Expected: PASS (todas).

- [ ] **Step 5: Commit**

```bash
git add lib/content/schema.ts tests/load.test.ts
git commit -m "feat: preguntas de repaso opcionales en los nodos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tasks 2–4: Preguntas de repaso de los 61 nodos (contenido)

Las tres tareas siguen las mismas reglas; cambia solo la lista de nodos.

**Reglas de escritura (obligatorias):**
- Lee el nodo completo (`summary` y las tres secciones) antes de escribir.
- 2 o 3 preguntas por nodo, en español, que empiecen con "¿" y terminen con "?", ≤ 200 caracteres.
- Respuesta de 1 a 3 frases, ≤ 400 caracteres, **respaldada por el texto del nodo**: no agregues datos, cifras, fechas ni nombres que el nodo no diga.
- Mezcla: una pregunta de propósito ("¿para qué/por qué…?"), una de uso o aplicación ("¿cómo/cuándo…?") y, opcional, una que conecte con un prerrequisito o relacionado **solo si el texto del nodo lo menciona**.
- Nada de preguntas de sí/no ni preguntas que se respondan con el título.
- Si el texto de un nodo no da para 2 buenas preguntas, escribe las 2 mejores respaldadas y deja una línea `Task N: Ruling: <id> tiene poco texto para el repaso — …` en el ledger (irá al PR).
- Formato: bloque `review:` en el frontmatter, justo antes de `verified:`, con cadenas YAML entre comillas dobles; dentro del texto usa comillas tipográficas o simples, nunca `"` sin escapar.

**Ejemplo (respaldado por `content/nodes/embeddings.mdx`):**

```yaml
review:
  - question: "¿Qué propiedad de los embeddings permite construir una búsqueda semántica?"
    answer: "Que textos con significado parecido quedan cerca en el espacio de vectores aunque usen palabras distintas; por eso \"devolver un pedido\" puede encontrar \"política de reembolsos\"."
  - question: "¿Cuáles son los pasos para buscar documentos con embeddings?"
    answer: "Elegir un modelo de embeddings, convertir cada documento en un vector y guardarlo, convertir también la consulta y buscar los vectores más cercanos, normalmente con similitud coseno."
  - question: "¿Cómo explicarías un embedding a alguien no técnico?"
    answer: "Como las coordenadas de una idea en un mapa donde lo parecido queda junto: \"perro\" cerca de \"cachorro\". Así la computadora mide parecido por significado, no por letras."
```

**Script de verificación** (reemplaza `<ids>` por la lista de la tarea):

```bash
node -e 'const fs=require("fs"),m=require("gray-matter");let bad=0;for(const id of process.argv.slice(1)){const r=m(fs.readFileSync(`content/nodes/${id}.mdx`,"utf8")).data.review||[];if(r.length<2||r.length>3){console.log(id,"tiene",r.length);bad++}}console.log(bad?"FALTAN":"OK")' <ids>
```

### Task 2: Repaso, lote 1 (20 nodos)

**Files:** Modify `content/nodes/<id>.mdx` para: `a2a agent-skills agents anthropic-api attention backpropagation bert chain-of-thought chroma claude-agent-sdk claude-code claude cnn computer-use context-engineering cursor deep-learning diffusion-models embeddings evals`

**Interfaces:** Consumes el campo `review` de Task 1.

- [ ] **Step 1: Run the verification script to see it fail**
Expected: 20 líneas `<id> tiene 0` y `FALTAN`.
- [ ] **Step 2: Write the questions** según las reglas, nodo por nodo.
- [ ] **Step 3: Run the verification script and the suite**
Run: script con los 20 ids, luego `npm test`
Expected: `OK`; suite PASS (el cargador valida largos y cantidad).
- [ ] **Step 4: Commit**

```bash
git add content/nodes
git commit -m "content: preguntas de repaso, lote 1 (a2a–evals)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Repaso, lote 2 (20 nodos)

**Files:** Modify `content/nodes/<id>.mdx` para: `fine-tuning gans gemini github-copilot gpt guardrails hugging-face langchain llama llamaindex llm lora machine-learning mcp mistral multi-agent multimodal-models n8n neural-network ollama`

- [ ] **Step 1: Run the verification script to see it fail** — Expected: 20 líneas `tiene 0`, `FALTAN`.
- [ ] **Step 2: Write the questions** según las reglas.
- [ ] **Step 3: Run the verification script and the suite** — Expected: `OK`; suite PASS.
- [ ] **Step 4: Commit**

```bash
git add content/nodes
git commit -m "content: preguntas de repaso, lote 2 (fine-tuning–ollama)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Repaso, lote 3 (21 nodos) y test de integridad

**Files:**
- Modify `content/nodes/<id>.mdx` para: `openai-api perceptron pgvector pinecone prompting quantization rag reasoning-models rlhf rnn-lstm semantic-search stable-diffusion structured-outputs tokenization tool-use transfer-learning transformer vector-db vercel-ai-sdk vllm whisper`
- Test: `tests/content-integrity.test.ts`

**Interfaces:** Consumes `Catalog.nodes[].review`, `Catalog.reports[].proposals`.

- [ ] **Step 1: Write the failing integrity test** — dentro del `describe('content/ real', ...)`:

```ts
  it('cada nodo tiene de 2 a 3 preguntas de repaso, salvo los propuestos por el radar', () => {
    const { nodes, reports } = loadCatalog()
    // Los nodos que llegan por el radar no traen preguntas hasta que alguien las escribe
    const fromRadar = new Set(reports.flatMap((r) => r.proposals.filter((p) => p.type === 'new-node').map((p) => p.target)))
    const missing = nodes.filter((n) => !fromRadar.has(n.id) && !n.review).map((n) => n.id)
    expect(missing).toEqual([])
  })
```

- [ ] **Step 2: Run to verify it fails**
Run: `npx vitest run tests/content-integrity.test.ts`
Expected: FAIL listando exactamente los 21 ids de este lote.
- [ ] **Step 3: Write the questions** según las reglas.
- [ ] **Step 4: Run the verification script, the integrity test and the suite**
Expected: `OK`; integrity PASS; suite PASS.
- [ ] **Step 5: Commit**

```bash
git add content/nodes tests/content-integrity.test.ts
git commit -m "content: preguntas de repaso, lote 3 (openai-api–whisper)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Lógica pura de rutas (`lib/paths.ts`)

**Files:**
- Create: `lib/paths.ts`
- Test: `tests/paths.test.ts`

**Interfaces:**
- Consumes: `AudiencePref` de `lib/audience.ts`; `CatalogNode`, `Person` de `lib/content/types.ts`; `ReviewItem` de `lib/content/schema.ts`.
- Produces (todas exportadas):
  - `interface PathLike { id: string; after?: string; audience: readonly string[]; steps: readonly { node: string; note?: string }[] }`
  - `stepIds(p: Pick<PathLike, 'steps'>): string[]`
  - `resolveAfterChain(paths: Pick<PathLike, 'id' | 'after'>[], id: string): { chain: string[]; error?: string }` — `chain` de la más cercana a la más lejana.
  - `checkPathOrder(steps: string[], requiresOf: (id: string) => readonly string[] | undefined, covered: ReadonlySet<string>, after?: string): string[]`
  - `sortPaths<T extends PathLike>(paths: T[]): T[]` — por profundidad de `after` y luego `id`.
  - `pathProgress(ids: readonly string[], learned: ReadonlySet<string>): { done: number; total: number }`
  - `nextStep(ids: readonly string[], learned: ReadonlySet<string>): string | undefined`
  - `pathsContaining<T extends PathLike>(paths: T[], nodeId: string): T[]`
  - `orderPathsForAudience<T extends PathLike>(paths: T[], pref: AudiencePref): T[]`
  - `pickContinue<T extends PathLike>(paths: T[], learned: ReadonlySet<string>): { path: T; next: string; done: number; total: number } | undefined`
  - `type StepView = { node: { id: string; title: string; level: string; summary: string; review?: ReviewItem[] }; note?: string; voices: Person[] }`
  - `toStepViews(steps: readonly { node: string; note?: string }[], byId: Map<string, CatalogNode>, people: Person[]): StepView[]`

- [ ] **Step 1: Write the failing tests** — `tests/paths.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  stepIds, resolveAfterChain, checkPathOrder, sortPaths, pathProgress, nextStep,
  pathsContaining, orderPathsForAudience, pickContinue, toStepViews, type PathLike,
} from '@/lib/paths'
import type { CatalogNode, Person } from '@/lib/content/types'

const p = (id: string, steps: string[], o: Partial<PathLike> = {}): PathLike => ({
  id, audience: ['technical'], steps: steps.map((node) => ({ node })), ...o,
})
const req: Record<string, string[]> = { a: [], b: ['a'], c: ['b'], d: ['c', 'a'] }
const requiresOf = (id: string) => req[id]

describe('resolveAfterChain', () => {
  it('devuelve la cadena de rutas previas, de la más cercana a la más lejana', () => {
    const paths = [p('x', []), p('y', [], { after: 'x' }), p('z', [], { after: 'y' })]
    expect(resolveAfterChain(paths, 'z')).toEqual({ chain: ['y', 'x'] })
    expect(resolveAfterChain(paths, 'x')).toEqual({ chain: [] })
  })
  it('reporta una ruta previa inexistente', () => {
    expect(resolveAfterChain([p('y', [], { after: 'nope' })], 'y').error).toBe('after: la ruta "nope" no existe')
  })
  it('reporta un ciclo', () => {
    const paths = [p('x', [], { after: 'y' }), p('y', [], { after: 'x' })]
    expect(resolveAfterChain(paths, 'x').error).toBe('ciclo en after: x → y → x')
  })
})

describe('checkPathOrder', () => {
  it('acepta pasos que respetan sus prerrequisitos', () => {
    expect(checkPathOrder(['a', 'b', 'c', 'd'], requiresOf, new Set())).toEqual([])
  })
  it('reporta un paso antes de su prerrequisito', () => {
    expect(checkPathOrder(['b', 'a', 'c'], requiresOf, new Set())).toEqual(['"b" requiere "a", que no aparece antes'])
  })
  it('acepta prerrequisitos cubiertos por la ruta previa y lo nombra al fallar', () => {
    expect(checkPathOrder(['c', 'd'], requiresOf, new Set(['a', 'b']), 'base')).toEqual([])
    expect(checkPathOrder(['c'], requiresOf, new Set(['a']), 'base')).toEqual(['"c" requiere "b", que no aparece antes ni en la ruta "base"'])
  })
  it('ignora nodos desconocidos (los reporta el cargador)', () => {
    expect(checkPathOrder(['nope', 'a'], requiresOf, new Set())).toEqual([])
  })
})

describe('sortPaths', () => {
  it('ordena por profundidad de after y luego por id', () => {
    const paths = [p('zz', [], { after: 'm' }), p('m', []), p('b', [], { after: 'm' }), p('agente', [], { after: 'zz' })]
    expect(sortPaths(paths).map((x) => x.id)).toEqual(['m', 'b', 'zz', 'agente'])
  })
})

describe('progreso', () => {
  const ids = ['a', 'b', 'c']
  it('cuenta lo aprendido y encuentra el siguiente paso', () => {
    expect(pathProgress(ids, new Set())).toEqual({ done: 0, total: 3 })
    expect(pathProgress(ids, new Set(['b', 'zz']))).toEqual({ done: 1, total: 3 })
    expect(nextStep(ids, new Set(['a']))).toBe('b')
    expect(nextStep(ids, new Set(['a', 'c']))).toBe('b')
    expect(nextStep(ids, new Set(ids))).toBeUndefined()
  })
  it('stepIds lista los nodos en orden', () => {
    expect(stepIds(p('x', ['a', 'b']))).toEqual(['a', 'b'])
  })
})

describe('pathsContaining y orderPathsForAudience', () => {
  const tech = p('tech', ['a', 'b'])
  const biz = p('biz', ['b'], { audience: ['business'] })
  const both = p('both', ['c'], { audience: ['technical', 'business'] })
  it('encuentra las rutas que contienen un nodo', () => {
    expect(pathsContaining([tech, biz, both], 'b').map((x) => x.id)).toEqual(['tech', 'biz'])
  })
  it('pone primero las rutas de la audiencia elegida, sin perder el orden', () => {
    expect(orderPathsForAudience([tech, biz, both], 'all').map((x) => x.id)).toEqual(['tech', 'biz', 'both'])
    expect(orderPathsForAudience([tech, biz, both], 'business').map((x) => x.id)).toEqual(['biz', 'both', 'tech'])
  })
})

describe('pickContinue', () => {
  const x = p('x', ['a', 'b', 'c', 'd'])
  const y = p('y', ['a', 'b'])
  it('elige la ruta empezada con mayor progreso y su siguiente paso', () => {
    expect(pickContinue([x, y], new Set(['a']))).toEqual({ path: y, next: 'b', done: 1, total: 2 })
  })
  it('ignora rutas sin empezar o terminadas', () => {
    expect(pickContinue([x, y], new Set())).toBeUndefined()
    expect(pickContinue([y], new Set(['a', 'b']))).toBeUndefined()
  })
  it('ante empate se queda con la primera', () => {
    const z = p('z', ['c', 'd'])
    expect(pickContinue([y, z], new Set(['a', 'c']))?.path.id).toBe('y')
  })
})

describe('toStepViews', () => {
  it('arma cada paso con el nodo, la nota y los referentes del tema', () => {
    const node = (id: string) => ({ id, title: id.toUpperCase(), level: 'fundamentals', summary: 's', sections: {} }) as unknown as CatalogNode
    const byId = new Map([['a', node('a')], ['b', node('b')]])
    const people = [{ id: 'p', topics: ['b'] }, { id: 'q', topics: ['a', 'b'] }] as unknown as Person[]
    const views = toStepViews([{ node: 'a', note: 'ojo' }, { node: 'b' }], byId, people)
    expect(views.map((v) => [v.node.id, v.node.title, v.note, v.voices.map((x) => x.id)])).toEqual([
      ['a', 'A', 'ojo', ['q']],
      ['b', 'B', undefined, ['p', 'q']],
    ])
    expect(views[0].node).not.toHaveProperty('sections')
  })
})
```

- [ ] **Step 2: Run to verify they fail**
Run: `npx vitest run tests/paths.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/paths"`.

- [ ] **Step 3: Implement** — `lib/paths.ts`:

```ts
import type { AudiencePref } from '@/lib/audience'
import type { CatalogNode, Person } from '@/lib/content/types'
import type { ReviewItem } from '@/lib/content/schema'

export interface PathLike {
  id: string
  after?: string
  audience: readonly string[]
  steps: readonly { node: string; note?: string }[]
}

export function stepIds(p: Pick<PathLike, 'steps'>): string[] {
  return p.steps.map((s) => s.node)
}

export function resolveAfterChain(paths: Pick<PathLike, 'id' | 'after'>[], id: string): { chain: string[]; error?: string } {
  const byId = new Map(paths.map((p) => [p.id, p]))
  const chain: string[] = []
  const seen = new Set([id])
  let next = byId.get(id)?.after
  while (next) {
    if (seen.has(next)) return { chain, error: `ciclo en after: ${[id, ...chain, next].join(' → ')}` }
    if (!byId.has(next)) return { chain, error: `after: la ruta "${next}" no existe` }
    seen.add(next)
    chain.push(next)
    next = byId.get(next)!.after
  }
  return { chain }
}

// Basta con revisar los requires directos: si cada paso tiene los suyos antes, por inducción tiene todos
export function checkPathOrder(
  steps: string[],
  requiresOf: (id: string) => readonly string[] | undefined,
  covered: ReadonlySet<string>,
  after?: string,
): string[] {
  const seen = new Set(covered)
  const errors: string[] = []
  for (const id of steps) {
    for (const r of requiresOf(id) ?? []) {
      if (!seen.has(r)) errors.push(`"${id}" requiere "${r}", que no aparece antes${after ? ` ni en la ruta "${after}"` : ''}`)
    }
    seen.add(id)
  }
  return errors
}

export function sortPaths<T extends PathLike>(paths: T[]): T[] {
  const depth = new Map(paths.map((p) => [p.id, resolveAfterChain(paths, p.id).chain.length]))
  return [...paths].sort((a, b) => depth.get(a.id)! - depth.get(b.id)! || a.id.localeCompare(b.id))
}

export function pathProgress(ids: readonly string[], learned: ReadonlySet<string>): { done: number; total: number } {
  return { done: ids.filter((id) => learned.has(id)).length, total: ids.length }
}

export function nextStep(ids: readonly string[], learned: ReadonlySet<string>): string | undefined {
  return ids.find((id) => !learned.has(id))
}

export function pathsContaining<T extends PathLike>(paths: T[], nodeId: string): T[] {
  return paths.filter((p) => p.steps.some((s) => s.node === nodeId))
}

export function orderPathsForAudience<T extends PathLike>(paths: T[], pref: AudiencePref): T[] {
  if (pref === 'all') return [...paths]
  return [...paths.filter((p) => p.audience.includes(pref)), ...paths.filter((p) => !p.audience.includes(pref))]
}

export function pickContinue<T extends PathLike>(
  paths: T[],
  learned: ReadonlySet<string>,
): { path: T; next: string; done: number; total: number } | undefined {
  let best: { path: T; next: string; done: number; total: number } | undefined
  for (const path of paths) {
    const ids = stepIds(path)
    const { done, total } = pathProgress(ids, learned)
    if (done === 0 || done === total) continue
    if (!best || done / total > best.done / best.total) best = { path, next: nextStep(ids, learned)!, done, total }
  }
  return best
}

export type StepView = {
  node: { id: string; title: string; level: string; summary: string; review?: ReviewItem[] }
  note?: string
  voices: Person[]
}

// Solo lo que la vista necesita: las secciones del nodo no viajan al cliente
export function toStepViews(steps: readonly { node: string; note?: string }[], byId: Map<string, CatalogNode>, people: Person[]): StepView[] {
  return steps.map(({ node: id, note }) => {
    const n = byId.get(id)!
    return {
      node: { id: n.id, title: n.title, level: n.level, summary: n.summary, review: n.review },
      note,
      voices: people.filter((p) => p.topics.includes(id)),
    }
  })
}
```

- [ ] **Step 4: Run to verify they pass, then the suite**
Run: `npx vitest run tests/paths.test.ts && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/paths.ts tests/paths.test.ts
git commit -m "feat: lógica pura de rutas de aprendizaje

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Esquema y carga de rutas curadas

**Files:**
- Modify: `lib/content/schema.ts`, `lib/content/types.ts`, `lib/content/load.ts`
- Test: `tests/load.test.ts`

**Interfaces:**
- Consumes: `resolveAfterChain`, `checkPathOrder`, `sortPaths`, `stepIds` (Task 5).
- Produces: `pathFrontmatterSchema`, `PathFrontmatter`; `LearningPath = PathFrontmatter & { intro: string }`; `Catalog.paths: LearningPath[]` ordenadas con `sortPaths`.

- [ ] **Step 1: Write the failing tests** — en `tests/load.test.ts`, ampliar `makeContent` con `paths` y agregar un `describe` nuevo.

Cambiar la firma y el cuerpo de `makeContent`:

```ts
  extra: { radar?: Record<string, string>; sources?: string; paths?: Record<string, string> } = {},
```

y antes de `return dir`:

```ts
  if (extra.paths) {
    fs.mkdirSync(path.join(dir, 'paths'))
    for (const [name, text] of Object.entries(extra.paths)) fs.writeFileSync(path.join(dir, 'paths', `${name}.mdx`), text)
  }
```

Al final del archivo:

```ts
describe('loadCatalog: rutas', () => {
  const REVIEW = '[{ question: "¿a?", answer: "b" }, { question: "¿c?", answer: "d" }]'
  // Cadena n1 ← n2 ← … ← n9: cada nodo requiere el anterior
  const chainNodes = (extra: Record<string, Record<string, string>> = {}) =>
    Object.fromEntries(Array.from({ length: 9 }, (_, i) => {
      const id = `n${i + 1}`
      return [id, file(fm(id, { requires: i ? `[n${i}]` : '[]', review: REVIEW, ...extra[id] }))]
    }))
  const pathFile = (id: string, steps: string[], extra: Record<string, string> = {}, body = 'Para quien empieza.\n') =>
    file({ id, title: `"${id}"`, audience: '[technical]', goal: '"Una meta"', steps: `[${steps.map((s) => `{ node: ${s} }`).join(', ')}]`, ...extra }, body)
  const load = (paths: Record<string, string>, nodes = chainNodes()) => makeContent(nodes, TAXONOMY, {}, { paths })

  it('carga rutas válidas con su introducción, ordenadas por profundidad de after', () => {
    const { paths } = loadCatalog(load({
      'z-base': pathFile('z-base', ['n1', 'n2', 'n3']),
      'a-next': pathFile('a-next', ['n4', 'n5', 'n6'], { after: 'z-base' }),
    }))
    expect(paths.map((p) => p.id)).toEqual(['z-base', 'a-next'])
    expect(paths[0].intro).toBe('Para quien empieza.')
    expect(paths[0].steps[0]).toEqual({ node: 'n1' })
  })
  it('sin carpeta paths el catálogo carga con paths vacío', () => {
    expect(loadCatalog(makeContent(chainNodes())).paths).toEqual([])
  })
  it('acepta prerrequisitos cubiertos por una cadena de after de dos niveles', () => {
    expect(errorsOf(load({
      p0: pathFile('p0', ['n1', 'n2', 'n3']),
      p1: pathFile('p1', ['n4', 'n5', 'n6'], { after: 'p0' }),
      p2: pathFile('p2', ['n7', 'n8', 'n9'], { after: 'p1' }),
    }))).toEqual([])
  })
  it('reporta un paso antes de su prerrequisito', () => {
    expect(errorsOf(load({ p: pathFile('p', ['n2', 'n1', 'n3']) }))).toContain('paths/p.mdx › steps: "n2" requiere "n1", que no aparece antes')
  })
  it('nombra la ruta previa cuando tampoco cubre el prerrequisito', () => {
    const errors = errorsOf(load({ p0: pathFile('p0', ['n1', 'n2', 'n3']), p1: pathFile('p1', ['n5', 'n6', 'n7'], { after: 'p0' }) }))
    expect(errors).toContain('paths/p1.mdx › steps: "n5" requiere "n4", que no aparece antes ni en la ruta "p0"')
  })
  it('reporta un nodo inexistente y un paso repetido', () => {
    const errors = errorsOf(load({ p: pathFile('p', ['n1', 'nope', 'n1']) }))
    expect(errors).toContain('paths/p.mdx › steps.1.node: "nope" no existe')
    expect(errors).toContain('paths/p.mdx › steps.2.node: "n1" está repetido')
  })
  it('reporta una ruta previa inexistente y los ciclos de after', () => {
    expect(errorsOf(load({ p: pathFile('p', ['n1', 'n2', 'n3'], { after: 'nope' }) }))).toContain('paths/p.mdx › after: la ruta "nope" no existe')
    const errors = errorsOf(load({ x: pathFile('x', ['n1', 'n2', 'n3'], { after: 'y' }), y: pathFile('y', ['n1', 'n2', 'n3'], { after: 'x' }) }))
    expect(errors).toContain('paths/x.mdx › ciclo en after: x → y → x')
  })
  it('exige al menos 2 preguntas de repaso en los nodos de una ruta', () => {
    const nodes = { ...chainNodes(), n2: file(fm('n2', { requires: '[n1]' })) }
    expect(errorsOf(load({ p: pathFile('p', ['n1', 'n2', 'n3']) }, nodes))).toContain('paths/p.mdx › steps.1.node: "n2" necesita al menos 2 preguntas de repaso')
  })
  it('valida el esquema: id, cantidad de pasos y cuerpo sin títulos ##', () => {
    expect(errorsOf(load({ q: pathFile('p', ['n1', 'n2', 'n3']) })).join()).toMatch(/paths\/q\.mdx › id: "p" no coincide/)
    expect(errorsOf(load({ p: pathFile('p', ['n1', 'n2']) })).join()).toMatch(/paths\/p\.mdx › steps/)
    expect(errorsOf(load({ p: pathFile('p', ['n1', 'n2', 'n3'], {}, '## Título\nTexto\n') })))
      .toContain('paths/p.mdx › cuerpo: la introducción no lleva títulos ## ("Título")')
  })
})
```

- [ ] **Step 2: Run to verify they fail**
Run: `npx vitest run tests/load.test.ts`
Expected: FAIL — `paths` es `undefined` en el catálogo (y los demás tests nuevos fallan por no reportar errores).

- [ ] **Step 3: Implement the schema** — en `lib/content/schema.ts`, después de `PersonFrontmatter`:

```ts
export const pathFrontmatterSchema = z
  .object({
    id,
    title: z.string().min(1),
    audience: z.array(z.enum(AUDIENCES)).min(1),
    goal: z.string().min(1).max(160),
    after: id.optional(),
    steps: z.array(z.object({ node: id, note: z.string().min(1).max(280).optional() }).strict()).min(3).max(12),
  })
  .strict()

export type PathFrontmatter = z.infer<typeof pathFrontmatterSchema>
```

- [ ] **Step 4: Implement the types** — en `lib/content/types.ts`: importar `PathFrontmatter` en la línea de tipos de `./schema`, agregar

```ts
export type LearningPath = PathFrontmatter & { intro: string }
```

y en `Catalog`:

```ts
  paths: LearningPath[]
```

- [ ] **Step 5: Implement the loader** — en `lib/content/load.ts`:

Imports: agregar `pathFrontmatterSchema` al import de `./schema`, `LearningPath` al de `./types`, y

```ts
import { resolveAfterChain, checkPathOrder, sortPaths, stepIds } from '@/lib/paths'
```

Antes de `if (errors.length) throw new ContentError(errors)`:

```ts
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
```

Nota: el mensaje de `after` inexistente sale de `resolveAfterChain` como `after: la ruta "nope" no existe`, de ahí `paths/p.mdx › after: …`.

En el objeto que devuelve `loadCatalog`, agregar:

```ts
    paths: sortPaths(paths),
```

- [ ] **Step 6: Run to verify they pass, then typecheck and the suite**
Run: `npx vitest run tests/load.test.ts && npx tsc --noEmit && npm test`
Expected: PASS; `tsc` sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/content tests/load.test.ts
git commit -m "feat: esquema y carga de rutas curadas con validación de orden

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Las 4 rutas curadas (contenido) y README

**Files:**
- Create: `content/paths/fundamentos.mdx`, `content/paths/ia-para-tu-negocio.mdx`, `content/paths/construir-con-llms.mdx`, `content/paths/construir-un-agente.mdx`
- Modify: `README.md` (hoja de ruta y sección nueva)
- Test: `tests/content-integrity.test.ts`

**Interfaces:** Consumes `Catalog.paths`, `getLearningPath` (`lib/graph.ts`).

- [ ] **Step 1: Write the failing integrity tests** — dentro del `describe('content/ real', ...)`; agregar `import { getLearningPath } from '@/lib/graph'` arriba:

```ts
  it('las 4 rutas curadas cargan en orden de profundidad', () => {
    expect(loadCatalog().paths.map((p) => p.id)).toEqual(['fundamentos', 'construir-con-llms', 'ia-para-tu-negocio', 'construir-un-agente'])
  })

  it('toda ruta generada termina en su meta', () => {
    const { nodes } = loadCatalog()
    for (const n of nodes) expect(getLearningPath(nodes, n.id).at(-1)).toBe(n.id)
  })
```

- [ ] **Step 2: Run to verify it fails**
Run: `npx vitest run tests/content-integrity.test.ts`
Expected: FAIL en el primero — `expected [] to deeply equal [ 'fundamentos', … ]`; el segundo PASA (documenta una garantía de `getLearningPath`, no lógica nueva).

- [ ] **Step 3: Write the 4 paths** — pasos exactamente como en la tabla 6.1 del spec. Plantilla (completar las demás con la misma forma):

```mdx
---
id: fundamentos
title: "Fundamentos de IA"
audience: [technical, business]
goal: "Entender qué es un modelo, cómo aprende y qué es un LLM"
steps:
  - node: machine-learning
  - node: neural-network
  - node: backpropagation
    note: "Si vienes de negocio, quédate con la idea: la red aprende corrigiendo poco a poco sus errores."
  - node: deep-learning
  - node: rnn-lstm
    note: "Interesa sobre todo por su límite: leer el texto palabra por palabra. Ese límite explica por qué llegó la atención."
  - node: embeddings
  - node: attention
    note: "La idea clave para lo que sigue: el modelo decide en qué partes del texto fijarse."
  - node: tokenization
  - node: transformer
  - node: llm
---

Para cualquiera que quiera entender de dónde salen los modelos de lenguaje. Al terminar sabrás qué es aprender de datos, cómo funciona una red neuronal y por qué el Transformer hizo posibles los LLM. Los pasos más técnicos traen una nota con la idea que conviene retener si no vienes de programación.
```

Para las otras tres:
- `ia-para-tu-negocio`: `audience: [business]`, `after: fundamentos`, goal "Saber qué puede hacer hoy la IA en tu trabajo, con qué herramientas y con qué riesgos", pasos `prompting claude chain-of-thought reasoning-models tool-use agents n8n evals guardrails`.
- `construir-con-llms`: `audience: [technical]`, `after: fundamentos`, goal "Construir aplicaciones con LLMs: prompts, APIs, salidas estructuradas y RAG", pasos `prompting claude anthropic-api tool-use structured-outputs vector-db rag evals`.
- `construir-un-agente`: `audience: [technical]`, `after: construir-con-llms`, goal "Entender y construir un agente que use herramientas", pasos `agents mcp context-engineering claude-agent-sdk agent-skills multi-agent guardrails`.

Notas: solo donde ayuden (2–4 por ruta), ≤ 280 caracteres, respaldadas por el texto del nodo; la introducción (2–3 frases) dice para quién es y qué te llevas.

- [ ] **Step 4: Update README** — en "Hoja de ruta", cambiar el punto 5 a `5. **Modo enseñanza**: rutas de aprendizaje con repaso y progreso local (este repo; cuentas y cursos llegan con el 3)`; y agregar, antes de `## Radar semanal`:

```markdown
## Rutas de aprendizaje

Las rutas curadas viven en `content/paths/<id>.mdx`: `title`, `audience`, `goal`, `after` (ruta que se asume hecha, opcional) y de 3 a 12 `steps` con `node` y una `note` opcional. `npm test` comprueba que cada paso aparezca después de sus prerrequisitos (o en la ruta `after`) y que sus nodos tengan al menos 2 preguntas de repaso (`review` en el frontmatter del nodo). Además, cada nodo tiene una ruta generada en `/learn/<id>`.
```

- [ ] **Step 5: Run the suite**
Run: `npm test`
Expected: PASS (incluidas las reglas de orden con el contenido real).

- [ ] **Step 6: Commit**

```bash
git add content/paths README.md tests/content-integrity.test.ts
git commit -m "content: cuatro rutas curadas de aprendizaje

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Progreso en el navegador (`lib/learned.ts`)

**Files:**
- Create: `lib/learned.ts`
- Test: `tests/learned.test.ts`

**Interfaces:**
- Produces: `LEARNED_KEY = 'expia.learned'`; `parseLearned(raw: string | null | undefined, known: ReadonlySet<string>): string[]`; `readLearned(storage: Pick<Storage, 'getItem'> | undefined, known: ReadonlySet<string>): string[]`; `writeLearned(storage: Pick<Storage, 'setItem'> | undefined, ids: readonly string[]): void`; `toggleLearned(ids: readonly string[], id: string): string[]`.

- [ ] **Step 1: Write the failing tests** — `tests/learned.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { LEARNED_KEY, parseLearned, readLearned, writeLearned, toggleLearned } from '@/lib/learned'

const known = new Set(['a', 'b', 'c'])

describe('parseLearned', () => {
  it('lee una lista válida', () => {
    expect(parseLearned('["a","c"]', known)).toEqual(['a', 'c'])
  })
  it('trata como vacío lo ausente, corrupto o que no es lista', () => {
    expect(parseLearned(null, known)).toEqual([])
    expect(parseLearned('{no es json', known)).toEqual([])
    expect(parseLearned('{"a":1}', known)).toEqual([])
    expect(parseLearned('"a"', known)).toEqual([])
  })
  it('ignora ids desconocidos o que no son texto, y quita duplicados', () => {
    expect(parseLearned('["a","borrado",3,null,"a","b"]', known)).toEqual(['a', 'b'])
  })
})

describe('readLearned y writeLearned', () => {
  it('lee y escribe con la clave esperada', () => {
    const store: Record<string, string> = {}
    writeLearned({ setItem: (k, v) => { store[k] = v } }, ['a', 'b'])
    expect(store[LEARNED_KEY]).toBe('["a","b"]')
    expect(readLearned({ getItem: (k) => store[k] ?? null }, known)).toEqual(['a', 'b'])
  })
  it('no lanza error si el almacenamiento falla o no existe', () => {
    expect(readLearned({ getItem: () => { throw new Error('SecurityError') } }, known)).toEqual([])
    expect(readLearned(undefined, known)).toEqual([])
    expect(() => writeLearned({ setItem: () => { throw new Error('QuotaExceeded') } }, ['a'])).not.toThrow()
    expect(() => writeLearned(undefined, ['a'])).not.toThrow()
  })
})

describe('toggleLearned', () => {
  it('marca y desmarca sin mutar la lista', () => {
    const ids = ['a']
    expect(toggleLearned(ids, 'b')).toEqual(['a', 'b'])
    expect(toggleLearned(ids, 'a')).toEqual([])
    expect(ids).toEqual(['a'])
  })
})
```

- [ ] **Step 2: Run to verify they fail**
Run: `npx vitest run tests/learned.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/learned"`.

- [ ] **Step 3: Implement** — `lib/learned.ts`:

```ts
export const LEARNED_KEY = 'expia.learned'

export function parseLearned(raw: string | null | undefined, known: ReadonlySet<string>): string[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  // Un nodo renombrado o borrado deja ids viejos: se ignoran
  return [...new Set(data.filter((x): x is string => typeof x === 'string' && known.has(x)))]
}

export function readLearned(storage: Pick<Storage, 'getItem'> | undefined, known: ReadonlySet<string>): string[] {
  try {
    return parseLearned(storage?.getItem(LEARNED_KEY), known)
  } catch {
    return []
  }
}

export function writeLearned(storage: Pick<Storage, 'setItem'> | undefined, ids: readonly string[]): void {
  try {
    storage?.setItem(LEARNED_KEY, JSON.stringify(ids))
  } catch {
    // almacenamiento bloqueado o lleno: el progreso vive solo en memoria
  }
}

export function toggleLearned(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}
```

- [ ] **Step 4: Run to verify they pass, then the suite**
Run: `npx vitest run tests/learned.test.ts && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/learned.ts tests/learned.test.ts
git commit -m "feat: progreso de aprendizaje en el navegador

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Progreso en la ficha del nodo

**Files:**
- Create: `components/learned-provider.tsx`, `components/learned-toggle.tsx`, `components/review-questions.tsx`
- Modify: `app/layout.tsx`, `app/node/[id]/page.tsx`
- Test: `e2e/learning.spec.ts`

**Interfaces:**
- Consumes: `readLearned`, `writeLearned`, `toggleLearned`, `LEARNED_KEY` (Task 8); `safeLocalStorage` (`lib/audience.ts`); `pathsContaining` (Task 5); `Catalog.paths` (Task 6); `ReviewItem` (Task 1).
- Produces:
  - `LearnedProvider({ knownIds: string[]; children })` y `useLearned(): { learned: ReadonlySet<string>; ready: boolean; toggle: (id: string) => void }` desde `components/learned-provider.tsx`. (El spec nombra `components/use-learned.ts`; el hook vive junto a su proveedor porque varios componentes de la misma página deben compartir el estado, igual que `useAudience`.)
  - `LearnedToggle({ nodeId })`: `<button data-testid="learned-toggle" data-ready aria-pressed>` con texto "Lo aprendí" / "✓ Aprendido".
  - `ReviewQuestions({ review?: ReviewItem[] })`: `<ol data-testid="review-questions">` con `<details><summary>Ver respuesta</summary>`; sin preguntas, `<p>Sin preguntas de repaso aún.</p>`.

- [ ] **Step 1: Write the failing E2E tests** — `e2e/learning.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

async function toggleOn(page: Page, scope = page.locator('body')) {
  const toggle = scope.getByTestId('learned-toggle').first()
  await expect(toggle).toHaveAttribute('data-ready', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  return toggle
}

test('la ficha muestra preguntas de repaso con la respuesta oculta', async ({ page }) => {
  await page.goto('/node/rag')
  const review = page.getByTestId('review-questions')
  const first = review.locator('details').first()
  await expect(first).not.toHaveAttribute('open', '')
  await first.getByText('Ver respuesta').click()
  await expect(first).toHaveAttribute('open', '')
})

test('marcar un nodo como aprendido persiste al recargar', async ({ page }) => {
  await page.goto('/node/rag')
  await toggleOn(page)
  await expect(page.getByTestId('learned-toggle').first()).toHaveText('✓ Aprendido')
  await page.reload()
  await expect(page.getByTestId('learned-toggle').first()).toHaveAttribute('aria-pressed', 'true')
})

test('la ficha enlaza a aprender desde cero y a las rutas que la contienen', async ({ page }) => {
  await page.goto('/node/rag')
  await expect(page.getByRole('link', { name: /Aprender desde cero \(\d+ pasos\)/ })).toHaveAttribute('href', '/learn/rag')
  await expect(page.getByTestId('in-paths').getByRole('link', { name: 'Construir con LLMs' })).toBeVisible()
})

test('con localStorage bloqueado la ficha funciona en memoria', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('bloqueado', 'SecurityError') } })
  })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/node/rag')
  await toggleOn(page)
  expect(errors).toEqual([])
})
```

- [ ] **Step 2: Run to verify they fail**
Run: `npx playwright test e2e/learning.spec.ts`
Expected: FAIL — no existe `review-questions` / `learned-toggle` (timeouts de localizador).

- [ ] **Step 3: Implement the provider** — `components/learned-provider.tsx`:

```tsx
'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LEARNED_KEY, readLearned, writeLearned, toggleLearned } from '@/lib/learned'
import { safeLocalStorage } from '@/lib/audience'

type LearnedState = { learned: ReadonlySet<string>; ready: boolean; toggle: (id: string) => void }

const LearnedContext = createContext<LearnedState>({ learned: new Set(), ready: false, toggle: () => {} })

export function LearnedProvider({ knownIds, children }: { knownIds: string[]; children: ReactNode }) {
  const known = useMemo(() => new Set(knownIds), [knownIds])
  const [ids, setIds] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  // El HTML estático sale sin marcas; se leen tras hidratar para no provocar diferencias
  useEffect(() => {
    setIds(readLearned(safeLocalStorage(), known))
    setReady(true)
    const onStorage = (e: StorageEvent) => {
      if (e.key === LEARNED_KEY || e.key === null) setIds(readLearned(safeLocalStorage(), known))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [known])

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = toggleLearned(prev, id)
      writeLearned(safeLocalStorage(), next)
      return next
    })
  }, [])

  const learned = useMemo(() => new Set(ids), [ids])
  return <LearnedContext.Provider value={{ learned, ready, toggle }}>{children}</LearnedContext.Provider>
}

export const useLearned = () => useContext(LearnedContext)
```

- [ ] **Step 4: Implement the toggle and the questions**

`components/learned-toggle.tsx`:

```tsx
'use client'
import { cn } from '@/lib/utils'
import { useLearned } from './learned-provider'

export function LearnedToggle({ nodeId }: { nodeId: string }) {
  const { learned, ready, toggle } = useLearned()
  const done = learned.has(nodeId)
  return (
    <button
      type="button"
      data-testid="learned-toggle"
      data-ready={ready}
      aria-pressed={done}
      onClick={() => toggle(nodeId)}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1 text-sm',
        done ? 'border-emerald-600 bg-emerald-600 text-white' : 'hover:border-foreground/40',
      )}
    >
      {done ? '✓ Aprendido' : 'Lo aprendí'}
    </button>
  )
}
```

`components/review-questions.tsx`:

```tsx
import type { ReviewItem } from '@/lib/content/schema'

export function ReviewQuestions({ review }: { review?: ReviewItem[] }) {
  if (!review?.length) return <p className="text-sm text-muted-foreground">Sin preguntas de repaso aún.</p>
  return (
    <ol data-testid="review-questions" className="space-y-2 text-sm">
      {review.map((r) => (
        <li key={r.question} className="rounded-md border p-3">
          <p className="font-medium">{r.question}</p>
          <details className="mt-1">
            <summary className="cursor-pointer text-muted-foreground">Ver respuesta</summary>
            <p className="mt-1">{r.answer}</p>
          </details>
        </li>
      ))}
    </ol>
  )
}
```

- [ ] **Step 5: Wire the layout** — en `app/layout.tsx`: importar `getCatalog` de `@/lib/content/load` y `LearnedProvider`; dentro de `RootLayout`, `const knownIds = getCatalog().nodes.map((n) => n.id)`, y envolver:

```tsx
        <AudienceProvider>
          <LearnedProvider knownIds={knownIds}>
            <SiteHeader />
            <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          </LearnedProvider>
        </AudienceProvider>
```

- [ ] **Step 6: Wire the node page** — en `app/node/[id]/page.tsx`:
  - imports: `LearnedToggle`, `ReviewQuestions`, `pathsContaining` de `@/lib/paths`; desestructurar también `paths` de `getCatalog()`.
  - en el `<header>`, reemplazar `<h1 className="text-3xl font-bold">{node.title}</h1>` por:

```tsx
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-3xl font-bold">{node.title}</h1>
            <LearnedToggle nodeId={id} />
          </div>
```

  - después de `<NodeSectionsView … />`:

```tsx
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Repasa</h2>
          <ReviewQuestions review={node.review} />
        </section>
```

  - en el `<section>` "Ruta sugerida", después de `<PrereqList nodes={prereqs} />`:

```tsx
          {prereqs.length > 0 && (
            <Link href={`/learn/${id}`} className="mt-2 inline-block text-sm underline underline-offset-4">
              Aprender desde cero ({prereqs.length + 1} pasos)
            </Link>
          )}
          {inPaths.length > 0 && (
            <p data-testid="in-paths" className="mt-2 text-xs text-muted-foreground">
              Aparece en:{' '}
              {inPaths.map((p, i) => (
                <span key={p.id}>{i > 0 && ', '}<Link href={`/paths/${p.id}`} className="underline underline-offset-4">{p.title}</Link></span>
              ))}
            </p>
          )}
```

  - junto a las otras constantes: `const inPaths = pathsContaining(paths, id)`.

- [ ] **Step 7: Run E2E (only this file), typecheck, lint and unit suite**
Run: `npx playwright test e2e/learning.spec.ts && npx tsc --noEmit && npm run lint && npm test`
Expected: 4 E2E PASS (el test de rutas pasa porque Task 7 ya creó `construir-con-llms`); sin errores de tipos ni lint.

- [ ] **Step 8: Commit**

```bash
git add components/learned-provider.tsx components/learned-toggle.tsx components/review-questions.tsx app/layout.tsx app/node e2e/learning.spec.ts
git commit -m "feat: repaso y progreso en la ficha del nodo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Páginas de rutas (`/paths`, `/paths/[id]`, `/learn/[id]`)

**Files:**
- Create: `components/path-progress.tsx`, `components/path-step.tsx`, `components/path-list.tsx`, `app/paths/page.tsx`, `app/paths/[id]/page.tsx`, `app/learn/[id]/page.tsx`
- Modify: `components/site-header.tsx`
- Test: `e2e/learning.spec.ts`

**Interfaces:**
- Consumes: `useLearned`, `LearnedToggle`, `ReviewQuestions` (Task 9); `useAudience` (`components/audience-provider.tsx`); `stepIds`, `pathProgress`, `nextStep`, `orderPathsForAudience`, `pathsContaining`, `toStepViews`, `StepView` (Task 5); `getLearningPath` (`lib/graph.ts`); `getVoicesForTopic` (`lib/people.ts`); `LABELS`; `Markdown`.
- Produces: `PathProgress({ ids: string[] })` con `data-testid="path-progress"`; `PathSteps({ steps: StepView[] })` con cada `<li data-testid="path-step" data-node={id} data-next>`; `PathList({ paths: LearningPath[] })` con tarjetas `data-testid="path-card"`.

- [ ] **Step 1: Write the failing E2E tests** — agregar al final de `e2e/learning.spec.ts`:

```ts
test('las rutas se listan, se abren y guardan el progreso', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Rutas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Rutas de aprendizaje', level: 1 })).toBeVisible()
  await expect(page.getByTestId('path-card')).toHaveCount(4)
  await page.getByTestId('path-card').filter({ hasText: 'Fundamentos de IA' }).click()
  await expect(page).toHaveURL(/\/paths\/fundamentos$/)
  const first = page.getByTestId('path-step').first()
  await expect(first).toHaveAttribute('data-next', 'true')
  await toggleOn(page, first)
  await expect(page.getByTestId('path-step').nth(1)).toHaveAttribute('data-next', 'true')
  await expect(page.getByTestId('path-progress').first()).toContainText('1 de 10')
  await page.reload()
  await expect(page.getByTestId('path-progress').first()).toContainText('1 de 10')
})

test('un nodo aprendido aparece marcado en otras rutas y en su ficha', async ({ page }) => {
  await page.goto('/paths/construir-con-llms')
  await toggleOn(page, page.locator('[data-testid="path-step"][data-node="prompting"]'))
  await page.goto('/paths/ia-para-tu-negocio')
  await expect(page.locator('[data-node="prompting"]').getByTestId('learned-toggle')).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/node/prompting')
  await expect(page.getByTestId('learned-toggle').first()).toHaveAttribute('aria-pressed', 'true')
})

test('la ruta generada lista los prerrequisitos antes de la meta', async ({ page }) => {
  await page.goto('/learn/rag')
  await expect(page.getByRole('heading', { name: /Aprender RAG/ })).toBeVisible()
  const nodes = await page.getByTestId('path-step').evaluateAll((els) => els.map((e) => e.getAttribute('data-node')))
  expect(nodes.at(-1)).toBe('rag')
  expect(nodes.indexOf('embeddings')).toBeGreaterThanOrEqual(0)
  expect(nodes.indexOf('embeddings')).toBeLessThan(nodes.indexOf('vector-db'))
})

test('la ruta que asume otra muestra el aviso con enlace', async ({ page }) => {
  await page.goto('/paths/construir-un-agente')
  await expect(page.getByTestId('after-notice').getByRole('link', { name: 'Construir con LLMs' })).toHaveAttribute('href', '/paths/construir-con-llms')
})

test('marcar en una pestaña se refleja en otra', async ({ context }) => {
  const a = await context.newPage()
  const b = await context.newPage()
  await a.goto('/paths/fundamentos')
  await b.goto('/paths/fundamentos')
  await expect(b.getByTestId('learned-toggle').first()).toHaveAttribute('data-ready', 'true')
  await toggleOn(a, a.getByTestId('path-step').first())
  await expect(b.getByTestId('path-step').first().getByTestId('learned-toggle')).toHaveAttribute('aria-pressed', 'true')
})

test('la ruta no produce errores de hidratación', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto('/paths/fundamentos')
  await expect(page.getByTestId('learned-toggle').first()).toHaveAttribute('data-ready', 'true')
  expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([])
})
```

- [ ] **Step 2: Run to verify they fail**
Run: `npx playwright test e2e/learning.spec.ts`
Expected: los 4 tests de Task 9 PASAN; los 6 nuevos FALLAN (no hay enlace "Rutas", `/paths/...` da 404).

- [ ] **Step 3: Implement the progress bar** — `components/path-progress.tsx`:

```tsx
'use client'
import { pathProgress } from '@/lib/paths'
import { useLearned } from './learned-provider'

export function PathProgress({ ids }: { ids: string[] }) {
  const { learned, ready } = useLearned()
  const { done, total } = ready ? pathProgress(ids, learned) : { done: 0, total: ids.length }
  return (
    <div data-testid="path-progress" className="space-y-1">
      <div className="h-1.5 rounded-full bg-muted">
        <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {done} de {total}{done === total && total > 0 ? ' · ¡Completada!' : ''}
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Implement the steps** — `components/path-step.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LABELS } from '@/lib/content/enums'
import { getVoicesForTopic } from '@/lib/people'
import { nextStep, type StepView } from '@/lib/paths'
import { useAudience } from './audience-provider'
import { useLearned } from './learned-provider'
import { LearnedToggle } from './learned-toggle'
import { ReviewQuestions } from './review-questions'

export function PathSteps({ steps }: { steps: StepView[] }) {
  const { learned, ready } = useLearned()
  const { audience } = useAudience()
  const next = ready ? nextStep(steps.map((s) => s.node.id), learned) : undefined
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => {
        const isNext = s.node.id === next
        const voices = getVoicesForTopic(s.voices, s.node.id, audience).slice(0, 2)
        return (
          <li
            key={s.node.id}
            data-testid="path-step"
            data-node={s.node.id}
            data-next={isNext || undefined}
            className={cn('space-y-3 rounded-lg border p-4', isNext && 'border-foreground')}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground">
                  Paso {i + 1} · {LABELS[s.node.level]}{isNext ? ' · Siguiente' : ''}
                </p>
                <h2 className="text-lg font-semibold">
                  <Link href={`/node/${s.node.id}`} className="hover:underline">{s.node.title}</Link>
                </h2>
                <p className="text-sm text-muted-foreground">{s.node.summary}</p>
              </div>
              <LearnedToggle nodeId={s.node.id} />
            </div>
            {s.note && <p className="rounded-md bg-muted px-3 py-2 text-sm">{s.note}</p>}
            <ReviewQuestions review={s.node.review} />
            {voices.length > 0 && (
              <p className="text-xs text-muted-foreground">
                A quién seguir:{' '}
                {voices.map((p, j) => (
                  <span key={p.id}>{j > 0 && ', '}<Link href={`/people/${p.id}`} className="underline underline-offset-4">{p.name}</Link></span>
                ))}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
```

- [ ] **Step 5: Implement the list** — `components/path-list.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { LABELS } from '@/lib/content/enums'
import { orderPathsForAudience, stepIds } from '@/lib/paths'
import type { LearningPath } from '@/lib/content/types'
import { useAudience } from './audience-provider'
import { PathProgress } from './path-progress'

export function PathList({ paths }: { paths: LearningPath[] }) {
  const { audience } = useAudience()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {orderPathsForAudience(paths, audience).map((p) => (
        <Link key={p.id} href={`/paths/${p.id}`} data-testid="path-card" className="space-y-2 rounded-lg border p-4 hover:border-foreground/40">
          <h2 className="font-semibold">{p.title}</h2>
          <p className="text-sm text-muted-foreground">{p.goal}</p>
          <p className="text-xs text-muted-foreground">
            {p.steps.length} pasos · {p.audience.map((a) => LABELS[a]).join(' · ')}
          </p>
          <PathProgress ids={stepIds(p)} />
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Implement the pages**

`app/paths/page.tsx`:

```tsx
import Link from 'next/link'
import { getCatalog } from '@/lib/content/load'
import { PathList } from '@/components/path-list'

export const metadata = { title: 'Rutas de aprendizaje' }

export default function PathsPage() {
  const { paths } = getCatalog()
  return (
    <div className="max-w-4xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Rutas de aprendizaje</h1>
        <p className="text-muted-foreground">
          Cada ruta ordena los conceptos según lo que necesitas saber antes. Marca cada paso con «Lo aprendí»: tu progreso se guarda en este navegador.
        </p>
      </header>
      <PathList paths={paths} />
      <p className="text-sm text-muted-foreground">
        ¿Quieres aprender un tema concreto? Abre cualquier ficha desde{' '}
        <Link href="/explore" className="underline underline-offset-4">Explorar</Link> y usa <em>Aprender desde cero</em>.
      </p>
    </div>
  )
}
```

`app/paths/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalog } from '@/lib/content/load'
import { stepIds, toStepViews } from '@/lib/paths'
import { LABELS } from '@/lib/content/enums'
import { Markdown } from '@/components/markdown'
import { PathProgress } from '@/components/path-progress'
import { PathSteps } from '@/components/path-step'

type Props = { params: Promise<{ id: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return getCatalog().paths.map((p) => ({ id: p.id }))
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const p = getCatalog().paths.find((x) => x.id === id)
  return p ? { title: p.title, description: p.goal } : {}
}

export default async function PathPage({ params }: Props) {
  const { id } = await params
  const { paths, byId, people } = getCatalog()
  const path = paths.find((p) => p.id === id)
  if (!path) notFound()
  const after = path.after ? paths.find((p) => p.id === path.after) : undefined

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">
          <Link href="/paths" className="hover:underline">Rutas</Link> · {path.audience.map((a) => LABELS[a]).join(' · ')}
        </p>
        <h1 className="text-3xl font-bold">{path.title}</h1>
        <p className="text-lg text-muted-foreground">{path.goal}</p>
        <Markdown source={path.intro} />
        {after && (
          <div data-testid="after-notice" className="space-y-2 rounded-md border px-3 py-2 text-sm">
            <p>Esta ruta asume <Link href={`/paths/${after.id}`} className="underline underline-offset-4">{after.title}</Link>.</p>
            <PathProgress ids={stepIds(after)} />
          </div>
        )}
        <PathProgress ids={stepIds(path)} />
      </header>
      <PathSteps steps={toStepViews(path.steps, byId, people)} />
    </div>
  )
}
```

Nota: el test E2E toma `path-progress` `.first()`; en una ruta con `after` el primero es el del aviso. El test de progreso usa `fundamentos`, que no tiene `after`.

`app/learn/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalog } from '@/lib/content/load'
import { getLearningPath } from '@/lib/graph'
import { pathsContaining, toStepViews } from '@/lib/paths'
import { PathProgress } from '@/components/path-progress'
import { PathSteps } from '@/components/path-step'

type Props = { params: Promise<{ id: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return getCatalog().nodes.map((n) => ({ id: n.id }))
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const node = getCatalog().byId.get(id)
  return node ? { title: `Aprender ${node.title} desde cero` } : {}
}

export default async function LearnPage({ params }: Props) {
  const { id } = await params
  const { nodes, byId, people, paths } = getCatalog()
  const node = byId.get(id)
  if (!node) notFound()
  const ids = getLearningPath(nodes, id)
  const inPaths = pathsContaining(paths, id)

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">Aprender {node.title} desde cero</h1>
        <p className="text-muted-foreground">
          {ids.length === 1
            ? 'No tiene prerrequisitos: puedes empezar directamente.'
            : `${ids.length} pasos: primero lo que conviene saber antes y al final ${node.title}.`}
        </p>
        {inPaths.length > 0 && (
          <p className="text-sm text-muted-foreground">
            También aparece en:{' '}
            {inPaths.map((p, i) => (
              <span key={p.id}>{i > 0 && ', '}<Link href={`/paths/${p.id}`} className="underline underline-offset-4">{p.title}</Link></span>
            ))}
          </p>
        )}
        <PathProgress ids={ids} />
      </header>
      <PathSteps steps={toStepViews(ids.map((node) => ({ node })), byId, people)} />
    </div>
  )
}
```

- [ ] **Step 7: Add the header link** — en `components/site-header.tsx`, en `NAV` después de `Inicio`:

```ts
  { href: '/paths', label: 'Rutas' },
```

- [ ] **Step 8: Run E2E (this file), typecheck, lint and unit suite**
Run: `npx playwright test e2e/learning.spec.ts && npx tsc --noEmit && npm run lint && npm test`
Expected: 10 E2E PASS; sin errores.

- [ ] **Step 9: Commit**

```bash
git add components/path-progress.tsx components/path-step.tsx components/path-list.tsx app/paths app/learn components/site-header.tsx e2e/learning.spec.ts
git commit -m "feat: páginas de rutas curadas y generadas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: "Sigue aprendiendo" en la portada

**Files:**
- Create: `components/continue-learning.tsx`
- Modify: `app/page.tsx`
- Test: `e2e/learning.spec.ts`

**Interfaces:**
- Consumes: `useLearned` (Task 9); `pickContinue`, `stepIds` (Task 5); `Catalog.paths`.
- Produces: `ContinueLearning({ paths: LearningPath[]; titles: Record<string, string> })` con `data-testid="continue-learning"`.

- [ ] **Step 1: Write the failing E2E test** — agregar a `e2e/learning.spec.ts`:

```ts
test('la portada sugiere rutas y luego el siguiente paso de la empezada', async ({ page }) => {
  await page.goto('/')
  const block = page.getByTestId('continue-learning')
  await expect(block.getByRole('heading', { name: 'Sigue aprendiendo' })).toBeVisible()
  await expect(block.getByRole('link', { name: 'Fundamentos de IA' })).toBeVisible()
  await page.goto('/paths/fundamentos')
  await toggleOn(page, page.getByTestId('path-step').first())
  await page.goto('/')
  await expect(block).toContainText('1 de 10')
  await expect(block.getByRole('link', { name: 'Redes neuronales', exact: false })).toHaveAttribute('href', '/node/neural-network')
})
```

Antes de escribirlo, confirmar el título real del nodo con `grep '^title:' content/nodes/neural-network.mdx` y usarlo en `name`.

- [ ] **Step 2: Run to verify it fails**
Run: `npx playwright test e2e/learning.spec.ts -g "portada"`
Expected: FAIL — no existe `continue-learning`.

- [ ] **Step 3: Implement** — `components/continue-learning.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { pickContinue } from '@/lib/paths'
import type { LearningPath } from '@/lib/content/types'
import { useLearned } from './learned-provider'

export function ContinueLearning({ paths, titles }: { paths: LearningPath[]; titles: Record<string, string> }) {
  const { learned, ready } = useLearned()
  if (paths.length === 0) return null
  const current = ready ? pickContinue(paths, learned) : undefined
  return (
    <section data-testid="continue-learning" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Sigue aprendiendo</h2>
        <Link href="/paths" className="text-sm underline underline-offset-4">Ver todas las rutas</Link>
      </div>
      {current ? (
        <div className="rounded-lg border p-4 text-sm">
          <p>
            Vas en <Link href={`/paths/${current.path.id}`} className="font-semibold hover:underline">{current.path.title}</Link>{' '}
            <span className="text-muted-foreground">({current.done} de {current.total})</span>.
          </p>
          <p className="mt-1">
            Siguiente paso: <Link href={`/node/${current.next}`} className="underline underline-offset-4">{titles[current.next] ?? current.next}</Link>
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {paths.map((p) => (
            <li key={p.id} className="rounded-lg border p-3">
              <Link href={`/paths/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
              <p className="text-xs text-muted-foreground">{p.goal}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Wire the home** — en `app/page.tsx`: importar `ContinueLearning`; desestructurar `paths` de `getCatalog()`; insertar después de la primera `<section>` (la del `<h1>`):

```tsx
      <ContinueLearning paths={paths} titles={topicTitles} />
```

- [ ] **Step 5: Run the whole E2E suite, typecheck, lint, unit suite and build**
Run: `npm run test:e2e && npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: 17 smoke + 11 learning E2E PASS; build sin errores y con las páginas `/paths/*` y `/learn/*` generadas.

- [ ] **Step 6: Commit**

```bash
git add components/continue-learning.tsx app/page.tsx e2e/learning.spec.ts
git commit -m "feat: sigue aprendiendo en la portada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
