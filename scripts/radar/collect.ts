import { XMLParser } from 'fast-xml-parser'

export interface RawItem {
  title: string
  url: string
  source: string
  publishedAt: string
  excerpt: string
}

const DAY = 24 * 60 * 60 * 1000
const EXCERPT_MAX = 300

// parseTagValue: false evita que un título como "2026" se convierta en número
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false, parseAttributeValue: false })

type XmlNode = Record<string, unknown>
const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v])

function text(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (v && typeof v === 'object' && '#text' in v) return String((v as XmlNode)['#text'])
  return ''
}

function cleanText(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function excerpt(s: string): string {
  const t = cleanText(s)
  return t.length > EXCERPT_MAX ? `${t.slice(0, EXCERPT_MAX - 1)}…` : t
}

function iso(s: string): string | null {
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

function atomLink(v: unknown): string {
  const links = asArray(v as XmlNode | XmlNode[])
  const alt = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0]
  return alt ? text(alt['@_href']) : ''
}

export function parseFeed(body: string, source: string): RawItem[] {
  const doc = xml.parse(body) as XmlNode
  const channel = (doc.rss as XmlNode | undefined)?.channel as XmlNode | undefined
  const feed = doc.feed as XmlNode | undefined
  if (!channel && !feed) throw new Error('no es un feed RSS ni Atom')

  const out: RawItem[] = []
  const push = (title: string, url: string, date: string, desc: string) => {
    const publishedAt = iso(date)
    if (title.trim() && url.trim() && publishedAt) {
      out.push({ title: cleanText(title), url: url.trim(), source, publishedAt, excerpt: excerpt(desc) })
    }
  }
  for (const it of asArray(channel?.item as XmlNode | XmlNode[] | undefined)) {
    push(text(it.title), text(it.link), text(it.pubDate ?? it['dc:date']), text(it.description))
  }
  for (const e of asArray(feed?.entry as XmlNode | XmlNode[] | undefined)) {
    const media = e['media:group'] as XmlNode | undefined
    push(text(e.title), atomLink(e.link), text(e.published ?? e.updated), text(e.summary ?? e.content ?? media?.['media:description']))
  }
  return out
}

interface HnHit { title?: string | null; url?: string | null; objectID: string; created_at: string; story_text?: string | null }

export function parseHackerNews(body: string, source: string): RawItem[] {
  const { hits } = JSON.parse(body) as { hits: HnHit[] }
  return hits.flatMap((h) => {
    const publishedAt = iso(h.created_at)
    if (!h.title || !publishedAt) return []
    const url = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`
    return [{ title: cleanText(h.title), url, source, publishedAt, excerpt: excerpt(h.story_text ?? '') }]
  })
}

interface GhRepo { full_name: string; html_url: string; description: string | null; created_at: string; stargazers_count: number }

export function parseGitHub(body: string, source: string): RawItem[] {
  const { items } = JSON.parse(body) as { items: GhRepo[] }
  return items.flatMap((r) => {
    const publishedAt = iso(r.created_at)
    if (!publishedAt) return []
    return [{ title: r.full_name, url: r.html_url, source, publishedAt, excerpt: excerpt(`${r.description ?? ''} (★ ${r.stargazers_count})`) }]
  })
}

export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    for (const key of [...u.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_')) u.searchParams.delete(key)
    }
    return u.toString()
  } catch {
    return null
  }
}

export function seenUrls(reports: { items: { url: string }[] }[]): Set<string> {
  return new Set(reports.flatMap((r) => r.items.map((i) => normalizeUrl(i.url) ?? i.url)))
}

export interface CollectOptions {
  now: Date
  seen: Set<string>
  max: number
  days?: number
}

export function collectItems(raw: RawItem[], { now, seen, max, days = 7 }: CollectOptions): RawItem[] {
  const since = now.getTime() - days * DAY
  const until = now.getTime() + DAY
  const byUrl = new Map<string, RawItem>()
  for (const item of raw) {
    const url = normalizeUrl(item.url)
    const t = Date.parse(item.publishedAt)
    if (!url || seen.has(url) || byUrl.has(url) || t < since || t > until) continue
    byUrl.set(url, { ...item, url })
  }
  // Si hay más de `max`, se descartan los más antiguos
  return [...byUrl.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, max)
}
