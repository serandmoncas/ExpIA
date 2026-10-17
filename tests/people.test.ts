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
