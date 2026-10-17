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
