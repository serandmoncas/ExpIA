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
