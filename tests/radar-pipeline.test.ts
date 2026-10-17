import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { runRadar } from '@/scripts/radar/pipeline'
import type { FetchFn } from '@/scripts/radar/fetch-sources'
import type { Judgement, JudgeClient } from '@/scripts/radar/judge'
import { loadCatalog } from '@/lib/content/load'
import { BASE_FILES, PERSON, makeDir } from './helpers/radar-content'

const fixture = (name: string) => fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/radar', name), 'utf8')
const NOW = new Date('2026-10-23T13:00:00Z')

function fakeFetch(routes: Record<string, string>): FetchFn {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    const hit = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))
    return hit ? new Response(hit[1]) : new Response('no encontrado', { status: 404 })
  }) as FetchFn
}
const ROUTES = {
  'https://www.youtube.com/@p': fixture('channel.html'),
  'https://www.youtube.com/feeds/videos.xml': fixture('atom.xml'),
  'https://blog.example.com/feed.xml': fixture('rss.xml'),
}

const JUDGEMENT: Judgement = {
  summary: 'Semana de agentes.',
  items: [
    { url: 'https://blog.example.com/nuevo-modelo', topics: ['mcp'], relevance: 'high', summary: 'Un modelo nuevo para agentes.' },
    { url: 'https://inventado.example.com/x', topics: ['mcp'], relevance: 'medium', summary: 'No existe.' },
  ],
  statusChanges: [{ nodeId: 'mcp', to: 'rising', reason: 'Más adopción', evidence: ['https://blog.example.com/nuevo-modelo'] }],
  newNodes: [],
  highlights: [{ personId: 'p', url: 'https://www.youtube.com/watch?v=abc123', format: 'video', topic: 'mcp', reason: 'Buen video' }],
}

function fakeClient(result: Judgement) {
  const calls: { messages: { content: string }[] }[] = []
  const client = {
    beta: { messages: { parse: async (params: { messages: { content: string }[] }) => { calls.push(params); return { stop_reason: 'end_turn', parsed_output: result } } } },
  } as unknown as JudgeClient
  return { client, calls }
}

describe('runRadar', () => {
  it('recolecta, juzga, valida, aplica y escribe un informe válido', async () => {
    const dir = makeDir(BASE_FILES)
    const { client, calls } = fakeClient(JUDGEMENT)
    const res = await runRadar({ contentDir: dir, now: NOW, fetch: fakeFetch(ROUTES), client, write: true })

    expect(calls).toHaveLength(1)
    expect(calls[0].messages[0].content).toContain('https://www.youtube.com/watch?v=abc123')
    expect(res.hasChanges).toBe(true)
    expect(res.week).toBe('2026-10-23')
    expect(res.report!.items.map((i) => i.url)).toEqual(['https://blog.example.com/nuevo-modelo'])
    expect(res.report!.proposals.map((p) => p.type)).toEqual(['status', 'highlight', 'feeds'])
    expect(res.report!.sourcesChecked).toBe(2)
    expect(res.discarded.some((d) => d.includes('inventado.example.com'))).toBe(true)
    expect(res.prBody).toContain('Cambios aplicados')
    expect(res.prBody).toContain('Propuestas descartadas por validación')

    const cat = loadCatalog(dir)
    expect(cat.byId.get('mcp')!.status).toBe('rising')
    expect(cat.peopleById.get('p')!.highlights).toHaveLength(2)
    expect(cat.peopleById.get('p')!.feeds?.youtubeChannelId).toBe('UCabcdefghijklmnopqrstuv')
    expect(cat.reports[0]).toMatchObject({ week: '2026-10-23', summary: 'Semana de agentes.' })
  })

  it('con write: false no toca los archivos', async () => {
    const dir = makeDir(BASE_FILES)
    const res = await runRadar({ contentDir: dir, now: NOW, fetch: fakeFetch(ROUTES), client: fakeClient(JUDGEMENT).client, write: false })
    expect(res.hasChanges).toBe(true)
    expect(res.changed).toEqual([])
    expect(loadCatalog(dir).byId.get('mcp')!.status).toBe('emerging')
    expect(fs.existsSync(path.join(dir, 'radar'))).toBe(false)
  })

  it('sin ítems nuevos ni feeds no llama al modelo ni reporta cambios', async () => {
    const noYoutube = PERSON.replace('  youtube: https://www.youtube.com/@p', '  x: https://x.com/p')
    const dir = makeDir({ ...BASE_FILES, 'people/p.mdx': noYoutube })
    const { client, calls } = fakeClient(JUDGEMENT)
    const res = await runRadar({ contentDir: dir, now: new Date('2026-12-01T13:00:00Z'), fetch: fakeFetch(ROUTES), client, write: true })
    expect(calls).toHaveLength(0)
    expect(res.hasChanges).toBe(false)
    expect(res.changed).toEqual([])
  })
})
