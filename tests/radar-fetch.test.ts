import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildRequests, fetchAll, fetchText, youtubeFeedUrl, type FetchFn, type SourceRequest } from '@/scripts/radar/fetch-sources'
import { extractChannelId, resolveMissingFeeds } from '@/scripts/radar/resolve-feeds'
import type { Source } from '@/lib/content/schema'
import type { Person } from '@/lib/content/types'

const fixture = (name: string) => fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/radar', name), 'utf8')
const NOW = new Date('2026-10-23T13:00:00Z')

type Call = { url: string; init?: RequestInit }
function fakeFetch(routes: Record<string, string | number>, calls: Call[] = []): FetchFn {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    const hit = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))
    if (!hit) throw new Error(`sin ruta: ${url}`)
    return typeof hit[1] === 'number' ? new Response('error', { status: hit[1] }) : new Response(hit[1])
  }) as FetchFn
}

const person = (id: string, o: Partial<Person> = {}): Person => ({
  id, name: id, kind: 'person', languages: ['en'], topics: ['rag'], audience: ['technical'], level: 'intermediate',
  summary: 's', platforms: { x: `https://x.com/${id}` },
  highlights: [{ title: 'h', url: `https://example.com/${id}`, format: 'video' }],
  verified: false, added: '2026-10-17', why: 'w', ...o,
})

const SOURCES: Source[] = [
  { id: 'blog', name: 'Blog', kind: 'rss', url: 'https://blog.example.com/feed.xml' },
  { id: 'hn', name: 'HN', kind: 'hackernews', minPoints: 200, keywords: ['LLM', 'RAG'] },
  { id: 'gh', name: 'GitHub', kind: 'github', minStars: 300, topics: ['llm'] },
]

describe('buildRequests', () => {
  const reqs = buildRequests(SOURCES, [
    person('p', { feeds: { youtubeChannelId: 'UCx', rss: 'https://p.example.com/rss' } }),
    person('q'),
  ], NOW, { q: 'UCq' })

  it('genera una petición por palabra clave de Hacker News con la ventana y los puntos', () => {
    const hn = reqs.filter((r) => r.sourceId === 'hn')
    expect(hn).toHaveLength(2)
    const since = Math.floor((NOW.getTime() - 7 * 86_400_000) / 1000)
    expect(new URL(hn[0].url).searchParams.get('numericFilters')).toBe(`created_at_i>${since},points>=200`)
    expect(new URL(hn[0].url).searchParams.get('query')).toBe('LLM')
  })
  it('busca en GitHub repos creados en la ventana con estrellas mínimas', () => {
    const gh = reqs.find((r) => r.sourceId === 'gh')!
    expect(new URL(gh.url).searchParams.get('q')).toBe('topic:llm created:>=2026-10-16 stars:>=300')
  })
  it('incluye los feeds de los referentes, también los recién resueltos', () => {
    expect(reqs.filter((r) => r.sourceId === 'p').map((r) => r.url)).toEqual([youtubeFeedUrl('UCx'), 'https://p.example.com/rss'])
    expect(reqs.filter((r) => r.sourceId === 'q').map((r) => r.url)).toEqual([youtubeFeedUrl('UCq')])
  })
})

describe('fetchAll', () => {
  const requests: SourceRequest[] = [
    { sourceId: 'blog', kind: 'feed', url: 'https://blog.example.com/feed.xml' },
    { sourceId: 'hn', kind: 'hackernews', url: 'https://hn.algolia.com/api/v1/search?query=LLM' },
    { sourceId: 'gh', kind: 'github', url: 'https://api.github.com/search/repositories?q=x' },
  ]

  it('una fuente que falla no aborta la ejecución', async () => {
    const res = await fetchAll(requests, fakeFetch({
      'https://blog.example.com': fixture('rss.xml'),
      'https://hn.algolia.com': 500,
      'https://api.github.com': fixture('github.json'),
    }))
    expect(res.items).toHaveLength(3)
    expect(res.failures.map((f) => f.sourceId)).toEqual(['hn'])
    expect(res.failures[0].error).toBe('HTTP 500')
    expect(res.sourcesChecked).toBe(2)
  })
  it('una página HTML en lugar de un feed cuenta como fallo', async () => {
    const res = await fetchAll([requests[0]], fakeFetch({ 'https://blog.example.com': '<html><body>Captcha</body></html>' }))
    expect(res.items).toEqual([])
    expect(res.failures[0].error).toMatch(/no es un feed/)
  })
  it('envía el token a GitHub cuando existe', async () => {
    const calls: Call[] = []
    await fetchAll([requests[2]], fakeFetch({ 'https://api.github.com': fixture('github.json') }, calls), 't0k3n')
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer t0k3n')
  })
})

describe('fetchText', () => {
  it('reintenta una vez antes de fallar', async () => {
    let n = 0
    const flaky = (async () => (++n === 1 ? new Response('', { status: 503 }) : new Response('ok'))) as unknown as FetchFn
    expect(await fetchText(flaky, 'https://e.com')).toBe('ok')
    expect(n).toBe(2)
  })
})

describe('extractChannelId', () => {
  it('lee el ID desde el enlace canónico', () => {
    expect(extractChannelId(fixture('channel.html'))).toBe('UCabcdefghijklmnopqrstuv')
  })
  it('lee el ID desde los datos embebidos', () => {
    expect(extractChannelId('<script>var x = {"externalId":"UC1234567890123456789012"}</script>')).toBe('UC1234567890123456789012')
  })
  it('devuelve null si no lo encuentra', () => {
    expect(extractChannelId('<html></html>')).toBeNull()
  })
})

describe('resolveMissingFeeds', () => {
  it('resuelve solo referentes con YouTube y sin ID, y registra los fallos', async () => {
    const calls: Call[] = []
    const people = [
      person('a', { platforms: { youtube: 'https://www.youtube.com/@a' } }),
      person('b', { platforms: { youtube: 'https://www.youtube.com/@b' }, feeds: { youtubeChannelId: 'UCbbbbbbbbbbbbbbbbbbbbbb' } }),
      person('c'),
      person('d', { platforms: { youtube: 'https://www.youtube.com/@d' } }),
    ]
    const res = await resolveMissingFeeds(people, fakeFetch({ 'https://www.youtube.com/@a': fixture('channel.html'), 'https://www.youtube.com/@d': 404 }, calls))
    expect(res.resolved).toEqual([{ personId: 'a', channelId: 'UCabcdefghijklmnopqrstuv', youtubeUrl: 'https://www.youtube.com/@a' }])
    expect(res.failures).toHaveLength(1)
    expect(res.failures[0]).toMatch(/^d: /)
    expect(calls.some((c) => c.url.includes('@b'))).toBe(false)
  })
})
