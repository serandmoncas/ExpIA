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

describe('validateJudgement: títulos ## en el texto del modelo', () => {
  it('descarta un nodo nuevo con un título ## en una sección', () => {
    const v = validateJudgement(j({ newNodes: [newNode('con-titulo', { usage: 'Intro\n\n## Ejemplo\nX' })] }), ctx())
    expect(v.newNodes).toEqual([])
    expect(v.discarded[0]).toMatch(/título ##/)
  })
  it('acepta ## dentro de un bloque de código', () => {
    const v = validateJudgement(j({ newNodes: [newNode('con-codigo', { usage: '```md\n## no es título\n```' })] }), ctx())
    expect(v.newNodes).toHaveLength(1)
  })
  it('baja a ### los títulos ## del resumen semanal y lo registra', () => {
    const v = validateJudgement(j({ summary: '## Lo importante\nTexto' }), ctx())
    expect(v.summary).toBe('### Lo importante\nTexto')
    expect(v.discarded.some((d) => d.startsWith('resumen semanal'))).toBe(true)
  })
})
