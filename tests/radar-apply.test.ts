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
