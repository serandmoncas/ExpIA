import type { Person } from '@/lib/content/types'
import { fetchText, type FetchFn } from './fetch-sources'

export function extractChannelId(html: string): string | null {
  const m =
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/.exec(html) ??
    /"(?:externalId|channelId)":"(UC[\w-]{22})"/.exec(html)
  return m ? m[1] : null
}

export interface ResolvedFeed {
  personId: string
  channelId: string
  youtubeUrl: string
}

export async function resolveMissingFeeds(people: Person[], fetchFn: FetchFn): Promise<{ resolved: ResolvedFeed[]; failures: string[] }> {
  const resolved: ResolvedFeed[] = []
  const failures: string[] = []
  // En serie para no disparar los límites de YouTube
  for (const p of people) {
    const youtubeUrl = p.platforms.youtube
    if (!youtubeUrl || p.feeds?.youtubeChannelId) continue
    try {
      const channelId = extractChannelId(await fetchText(fetchFn, youtubeUrl, { headers: { 'Accept-Language': 'en' } }))
      if (channelId) resolved.push({ personId: p.id, channelId, youtubeUrl })
      else failures.push(`${p.id}: no se encontró el ID del canal`)
    } catch (e) {
      failures.push(`${p.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { resolved, failures }
}
