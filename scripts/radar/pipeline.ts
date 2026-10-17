import { loadCatalog } from '@/lib/content/load'
import { LABELS } from '@/lib/content/enums'
import type { Proposal, RadarFrontmatter } from '@/lib/content/schema'
import type { Catalog } from '@/lib/content/types'
import { formatWeek } from '@/lib/radar'
import { collectItems, seenUrls, type RawItem } from './collect'
import { buildRequests, fetchAll, type FetchFn } from './fetch-sources'
import { resolveMissingFeeds } from './resolve-feeds'
import { judge, EMPTY_JUDGEMENT, MODEL, type JudgeClient, type JudgeInput } from './judge'
import { validateJudgement } from './validate'
import { applyProposals, writeReport, type Proposals } from './apply'

export const MAX_ITEMS = 150
const DAY = 86_400_000
const toDay = (d: Date) => d.toISOString().slice(0, 10)

export interface RadarDeps {
  contentDir: string
  now: Date
  fetch: FetchFn
  client: JudgeClient
  githubToken?: string
  write: boolean
  log?: (msg: string) => void
}

export interface RadarResult {
  week: string
  hasChanges: boolean
  report?: RadarFrontmatter
  changed: string[]
  discarded: string[]
  failures: string[]
  prBody: string
}

export async function collectWeek(catalog: Catalog, deps: Pick<RadarDeps, 'now' | 'fetch' | 'githubToken'>) {
  const feeds = await resolveMissingFeeds(catalog.people, deps.fetch)
  // Los canales recién resueltos ya se leen esta misma semana
  const extra = Object.fromEntries(feeds.resolved.map((f) => [f.personId, f.channelId]))
  const fetched = await fetchAll(buildRequests(catalog.sources, catalog.people, deps.now, extra), deps.fetch, deps.githubToken)
  const items = collectItems(fetched.items, { now: deps.now, seen: seenUrls(catalog.reports), max: MAX_ITEMS })
  return {
    items,
    resolved: feeds.resolved,
    sourcesChecked: fetched.sourcesChecked,
    failures: [...feeds.failures, ...fetched.failures.map((f) => `${f.sourceId}: ${f.error} (${f.url})`)],
  }
}

export function buildJudgeInput(catalog: Catalog, items: RawItem[]): JudgeInput {
  return {
    items,
    nodes: catalog.nodes.map((n) => ({ id: n.id, title: n.title, status: n.status, level: n.level, summary: n.summary })),
    people: catalog.people.map((p) => ({ id: p.id, name: p.name, topics: p.topics, highlightCount: p.highlights.length })),
    categories: catalog.categories.map((c) => ({ id: c.id, label: c.label })),
  }
}

export function toReportProposals(p: Proposals): Proposal[] {
  return [
    ...p.statusChanges.map((c): Proposal => ({ type: 'status', target: c.nodeId, from: c.from, to: c.to, reason: c.reason, evidence: c.evidence })),
    ...p.newNodes.map((n): Proposal => ({ type: 'new-node', target: n.front.id, reason: n.reason, evidence: n.evidence })),
    ...p.highlights.map((h): Proposal => ({ type: 'highlight', target: h.personId, reason: h.reason, evidence: h.evidence })),
    ...p.feeds.map((f): Proposal => ({ type: 'feeds', target: f.personId, reason: 'ID del canal de YouTube resuelto automáticamente', evidence: [f.youtubeUrl] })),
  ]
}

export function renderPrBody({ report, summary, discarded, failures }: { report: RadarFrontmatter; summary: string; discarded: string[]; failures: string[] }): string {
  const lines = [
    `## Radar IA: semana del ${formatWeek(report.week)}`, '',
    summary, '',
    `**Ítems:** ${report.items.length} · **Fuentes consultadas:** ${report.sourcesChecked}`, '',
  ]
  if (report.proposals.length) {
    lines.push('### Cambios aplicados', '')
    for (const p of report.proposals) {
      const step = p.type === 'status' ? ` (${p.from} → ${p.to})` : ''
      lines.push(`- **${LABELS[p.type]}** \`${p.target}\`${step}: ${p.reason}`)
    }
    lines.push('')
  }
  if (discarded.length) lines.push('### Propuestas descartadas por validación', '', ...discarded.map((d) => `- ${d}`), '')
  if (failures.length) lines.push('### Fuentes con error', '', ...failures.map((f) => `- ${f}`), '')
  lines.push('Revisa los cambios antes de mergear: los nodos nuevos llegan con `verified: false`.', '', 'Generado por el radar semanal de ExpIA.')
  return lines.join('\n')
}

export async function runRadar(deps: RadarDeps): Promise<RadarResult> {
  const log = deps.log ?? (() => {})
  const catalog = loadCatalog(deps.contentDir)
  const week = toDay(deps.now)
  const { items, resolved, failures, sourcesChecked } = await collectWeek(catalog, deps)
  log(`${items.length} ítems nuevos de ${sourcesChecked} fuentes; ${failures.length} fallos`)

  const judgement = items.length ? await judge(deps.client, buildJudgeInput(catalog, items)) : EMPTY_JUDGEMENT
  const validated = validateJudgement(judgement, {
    items,
    nodes: catalog.nodes,
    people: catalog.people,
    categoryIds: catalog.categories.map((c) => c.id),
    today: week,
  })
  const proposals: Proposals = { statusChanges: validated.statusChanges, newNodes: validated.newNodes, highlights: validated.highlights, feeds: resolved }
  const proposalCount = proposals.statusChanges.length + proposals.newNodes.length + proposals.highlights.length + proposals.feeds.length
  if (validated.items.length === 0 && proposalCount === 0) {
    return { week, hasChanges: false, changed: [], discarded: validated.discarded, failures, prBody: '' }
  }

  const { changed, skipped, applied } = deps.write
    ? applyProposals(deps.contentDir, proposals)
    : { changed: [] as string[], skipped: [] as string[], applied: proposals }
  const report: RadarFrontmatter = {
    week,
    from: toDay(new Date(deps.now.getTime() - 7 * DAY)),
    sourcesChecked,
    items: validated.items,
    proposals: toReportProposals(applied),
    generated: { by: 'radar-agent', ...(items.length ? { model: MODEL } : {}), at: deps.now.toISOString() },
  }
  const summary = validated.summary || 'Sin novedades destacadas esta semana.'
  if (deps.write) changed.push(writeReport(deps.contentDir, report, summary))
  const discarded = [...validated.discarded, ...skipped]
  return { week, hasChanges: true, report, changed, discarded, failures, prBody: renderPrBody({ report, summary, discarded, failures }) }
}
