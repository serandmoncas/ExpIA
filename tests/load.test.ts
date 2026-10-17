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

  it('reporta títulos H2 desconocidos y duplicados', () => {
    const errs = errorsOf(makeContent({ a: file(fm('a'), BODY + '## Ejemplo\nX\n## Para qué sirve\nY\n') }))
    expect(errs).toContain('nodes/a.mdx › cuerpo: sección desconocida "## Ejemplo" (usa ### para subsecciones)')
    expect(errs).toContain('nodes/a.mdx › cuerpo: sección duplicada "## Para qué sirve"')
  })

  it('rechaza el campo retirado voices en un nodo', () => {
    const errs = errorsOf(makeContent({ a: file(fm('a', { voices: '[]' })) }))
    expect(errs.some((e) => e.startsWith('nodes/a.mdx') && e.includes('voices'))).toBe(true)
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
