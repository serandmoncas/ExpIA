import type { Source } from '@/lib/content/schema'
import type { Person } from '@/lib/content/types'
import { parseFeed, parseHackerNews, parseGitHub, type RawItem } from './collect'

export type FetchFn = typeof fetch

export interface SourceRequest {
  sourceId: string
  kind: 'feed' | 'hackernews' | 'github'
  url: string
}

export interface FetchFailure {
  sourceId: string
  url: string
  error: string
}

export interface FetchResult {
  items: RawItem[]
  failures: FetchFailure[]
  sourcesChecked: number
}

const DAY = 86_400_000
const USER_AGENT = 'expia-radar (+https://github.com/serandmoncas/ExpIA)'

export const youtubeFeedUrl = (channelId: string) => `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`

export function buildRequests(sources: Source[], people: Person[], now: Date, extraChannelIds: Record<string, string> = {}): SourceRequest[] {
  const since = new Date(now.getTime() - 7 * DAY)
  const sinceSec = Math.floor(since.getTime() / 1000)
  const sinceDay = since.toISOString().slice(0, 10)
  const out: SourceRequest[] = []
  for (const s of sources) {
    if (s.kind === 'rss') out.push({ sourceId: s.id, kind: 'feed', url: s.url })
    if (s.kind === 'hackernews') {
      for (const query of s.keywords) {
        const qs = new URLSearchParams({ query, tags: 'story', numericFilters: `created_at_i>${sinceSec},points>=${s.minPoints}`, hitsPerPage: '30' })
        out.push({ sourceId: s.id, kind: 'hackernews', url: `https://hn.algolia.com/api/v1/search?${qs}` })
      }
    }
    if (s.kind === 'github') {
      for (const topic of s.topics) {
        const qs = new URLSearchParams({ q: `topic:${topic} created:>=${sinceDay} stars:>=${s.minStars}`, sort: 'stars', order: 'desc', per_page: '20' })
        out.push({ sourceId: s.id, kind: 'github', url: `https://api.github.com/search/repositories?${qs}` })
      }
    }
  }
  for (const p of people) {
    const channelId = p.feeds?.youtubeChannelId ?? extraChannelIds[p.id]
    if (channelId) out.push({ sourceId: p.id, kind: 'feed', url: youtubeFeedUrl(channelId) })
    if (p.feeds?.rss) out.push({ sourceId: p.id, kind: 'feed', url: p.feeds.rss })
  }
  return out
}

export async function fetchText(
  fetchFn: FetchFn,
  url: string,
  { timeoutMs = 10_000, retries = 1, headers = {} }: { timeoutMs?: number; retries?: number; headers?: Record<string, string> } = {},
): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchFn(url, { headers: { 'User-Agent': USER_AGENT, ...headers }, signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (e) {
      lastError = e
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

const PARSERS = { feed: parseFeed, hackernews: parseHackerNews, github: parseGitHub }

export async function fetchAll(requests: SourceRequest[], fetchFn: FetchFn, githubToken?: string): Promise<FetchResult> {
  const results = await Promise.all(
    requests.map(async (r) => {
      try {
        const headers: Record<string, string> = r.kind === 'github'
          ? { Accept: 'application/vnd.github+json', ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}) }
          : {}
        const body = await fetchText(fetchFn, r.url, { headers })
        return { r, items: PARSERS[r.kind](body, r.sourceId) }
      } catch (e) {
        return { r, error: e instanceof Error ? e.message : String(e) }
      }
    }),
  )
  const ok = new Set<string>()
  const out: FetchResult = { items: [], failures: [], sourcesChecked: 0 }
  for (const res of results) {
    if (res.error !== undefined) out.failures.push({ sourceId: res.r.sourceId, url: res.r.url, error: res.error })
    else {
      ok.add(res.r.sourceId)
      out.items.push(...res.items)
    }
  }
  out.sourcesChecked = ok.size
  return out
}
