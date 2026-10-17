import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseFeed, parseHackerNews, parseGitHub, normalizeUrl, collectItems, seenUrls, type RawItem } from '@/scripts/radar/collect'

const fixture = (name: string) => fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/radar', name), 'utf8')
const NOW = new Date('2026-10-23T13:00:00Z')
const raw = (url: string, publishedAt: string, source = 's'): RawItem => ({ title: url, url, source, publishedAt, excerpt: '' })
const opts = (o: Partial<{ seen: Set<string>; max: number }> = {}) => ({ now: NOW, seen: new Set<string>(), max: 150, ...o })

describe('parseFeed', () => {
  it('lee RSS 2.0 con entidades, CDATA y HTML', () => {
    const items = parseFeed(fixture('rss.xml'), 'blog')
    expect(items).toHaveLength(2)
    expect(items[0]).toEqual({
      title: 'Nuevo modelo & agentes',
      url: 'https://blog.example.com/nuevo-modelo?utm_source=rss',
      source: 'blog',
      publishedAt: '2026-10-20T10:00:00.000Z',
      excerpt: 'Un modelo nuevo para agentes.',
    })
  })
  it('lee Atom de YouTube con la descripción de media:group', () => {
    expect(parseFeed(fixture('atom.xml'), 'canal')).toEqual([{
      title: 'Cómo funciona MCP',
      url: 'https://www.youtube.com/watch?v=abc123',
      source: 'canal',
      publishedAt: '2026-10-21T15:00:00.000Z',
      excerpt: 'Explicación de MCP paso a paso.',
    }])
  })
  it('falla con un documento que no es un feed', () => {
    expect(() => parseFeed('<html><body>Captcha</body></html>', 'x')).toThrow(/no es un feed/)
  })
})

describe('parseHackerNews', () => {
  it('usa el enlace de la discusión cuando la historia no tiene URL', () => {
    const items = parseHackerNews(fixture('hn.json'), 'hn')
    expect(items.map((i) => i.url)).toEqual(['https://github.com/example/agente', 'https://news.ycombinator.com/item?id=2'])
    expect(items[1].excerpt).toBe('Pregunta')
  })
})

describe('parseGitHub', () => {
  it('convierte repositorios en ítems con las estrellas en el extracto', () => {
    const [item] = parseGitHub(fixture('github.json'), 'gh')
    expect(item).toMatchObject({ title: 'example/fast-rag', url: 'https://github.com/example/fast-rag', source: 'gh', publishedAt: '2026-10-19T09:00:00.000Z' })
    expect(item.excerpt).toContain('★ 812')
  })
})

describe('normalizeUrl', () => {
  it('quita utm_* y el fragmento', () => {
    expect(normalizeUrl('https://Example.com/a?utm_source=x&id=3#top')).toBe('https://example.com/a?id=3')
  })
  it('rechaza esquemas que no son http(s) y textos inválidos', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeUrl('no es url')).toBeNull()
  })
})

describe('collectItems', () => {
  it('se queda con la ventana de 7 días y normaliza las URLs', () => {
    const items = collectItems(parseFeed(fixture('rss.xml'), 'blog'), opts())
    expect(items.map((i) => i.url)).toEqual(['https://blog.example.com/nuevo-modelo'])
  })
  it('quita lo ya publicado en informes anteriores', () => {
    const seen = seenUrls([{ items: [{ url: 'https://e.com/a?utm_medium=x' }] }])
    const items = collectItems([raw('https://e.com/a', '2026-10-22T00:00:00Z'), raw('https://e.com/b', '2026-10-22T00:00:00Z')], opts({ seen }))
    expect(items.map((i) => i.url)).toEqual(['https://e.com/b'])
  })
  it('deduplica la misma URL de dos fuentes y conserva la primera', () => {
    const items = collectItems([raw('https://e.com/a', '2026-10-22T00:00:00Z', 'uno'), raw('https://e.com/a#x', '2026-10-22T00:00:00Z', 'dos')], opts())
    expect(items.map((i) => i.source)).toEqual(['uno'])
  })
  it('recorta a max conservando los más recientes', () => {
    const items = collectItems([
      raw('https://e.com/1', '2026-10-17T00:00:00Z'),
      raw('https://e.com/2', '2026-10-22T00:00:00Z'),
      raw('https://e.com/3', '2026-10-20T00:00:00Z'),
    ], opts({ max: 2 }))
    expect(items.map((i) => i.url)).toEqual(['https://e.com/2', 'https://e.com/3'])
  })
  it('descarta fechas futuras', () => {
    expect(collectItems([raw('https://e.com/f', '2026-11-01T00:00:00Z')], opts())).toEqual([])
  })
})
