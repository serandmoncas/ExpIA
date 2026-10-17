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
