import fs from 'node:fs'
import path from 'node:path'
import { dump } from 'js-yaml'
import type { RadarFrontmatter } from '@/lib/content/schema'
import type { Status } from '@/lib/content/enums'
import type { Highlight } from '@/lib/content/types'
import type { StatusChange, NewNode, HighlightProposal } from './validate'
import type { ResolvedFeed } from './resolve-feeds'

export interface Proposals {
  statusChanges: StatusChange[]
  newNodes: NewNode[]
  highlights: HighlightProposal[]
  feeds: ResolvedFeed[]
}

const yaml = (data: object) => dump(data, { lineWidth: -1, noRefs: true })

// Las ediciones tocan solo el frontmatter y conservan el resto del archivo tal cual
function withFrontmatter(text: string, edit: (front: string) => string): string {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text)
  if (!m) throw new Error('el archivo no tiene frontmatter')
  return `---\n${edit(m[1])}\n---\n${text.slice(m[0].length)}`
}

export function setStatus(text: string, to: Status): string {
  return withFrontmatter(text, (front) => front.replace(/^status:.*$/m, `status: ${to}`))
}

export function renderNewNode({ front, sections }: NewNode): string {
  const { links, ...rest } = front
  const data = Object.keys(links).length ? { ...rest, links } : rest
  return `---\n${yaml(data)}---\n\n## Para qué sirve\n\n${sections.purpose}\n\n## Cómo se usa\n\n${sections.usage}\n\n## Para no técnicos\n\n${sections.nonTechnical}\n`
}

export function addHighlight(text: string, h: Highlight): string {
  return withFrontmatter(text, (front) => {
    if (front.includes(h.url)) return front
    const lines = front.split('\n')
    const start = lines.findIndex((l) => /^highlights:\s*$/.test(l))
    if (start === -1) throw new Error('highlights no está en formato de bloque; agrégalo a mano')
    let end = start + 1
    while (end < lines.length && /^\s+\S/.test(lines[end])) end++
    lines.splice(end, 0,
      `  - title: ${JSON.stringify(h.title)}`,
      `    url: ${JSON.stringify(h.url)}`,
      `    format: ${h.format}`,
      ...(h.topic ? [`    topic: ${h.topic}`] : []),
      ...(h.language ? [`    language: ${h.language}`] : []),
    )
    return lines.join('\n')
  })
}

export function setYoutubeChannelId(text: string, channelId: string): string {
  return withFrontmatter(text, (front) => {
    if (/^\s+youtubeChannelId:/m.test(front)) return front
    const entry = `  youtubeChannelId: "${channelId}"`
    if (/^feeds:\s*$/m.test(front)) return front.replace(/^feeds:\s*$/m, `feeds:\n${entry}`)
    return front.replace(/^verified:/m, `feeds:\n${entry}\nverified:`)
  })
}

export function renderReport(report: RadarFrontmatter, summary: string): string {
  return `---\n${yaml(report)}---\n\n## Resumen de la semana\n\n${summary.trim()}\n`
}

export function applyProposals(contentDir: string, proposals: Proposals): { changed: string[]; skipped: string[]; applied: Proposals } {
  const changed: string[] = []
  const skipped: string[] = []
  const applied: Proposals = { statusChanges: [], newNodes: [], highlights: [], feeds: [] }
  const file = (rel: string) => path.join(contentDir, rel)
  const write = (rel: string, next: string) => {
    const prev = fs.existsSync(file(rel)) ? fs.readFileSync(file(rel), 'utf8') : null
    if (prev === next) return
    fs.mkdirSync(path.dirname(file(rel)), { recursive: true })
    fs.writeFileSync(file(rel), next)
    if (!changed.includes(rel)) changed.push(rel)
  }
  const edit = (rel: string, fn: (text: string) => string, label: string): boolean => {
    try {
      write(rel, fn(fs.readFileSync(file(rel), 'utf8')))
      return true
    } catch (e) {
      skipped.push(`${label} — ${e instanceof Error ? e.message : String(e)}`)
      return false
    }
  }

  for (const c of proposals.statusChanges) {
    if (edit(`nodes/${c.nodeId}.mdx`, (t) => setStatus(t, c.to), `estado de ${c.nodeId}`)) applied.statusChanges.push(c)
  }
  for (const n of proposals.newNodes) {
    const rel = `nodes/${n.front.id}.mdx`
    // Idempotente: si el nodo ya existe (una ejecución anterior lo creó), no se reescribe
    if (!fs.existsSync(file(rel))) write(rel, renderNewNode(n))
    applied.newNodes.push(n)
  }
  for (const h of proposals.highlights) {
    if (edit(`people/${h.personId}.mdx`, (t) => addHighlight(t, h.highlight), `recurso para ${h.personId}`)) applied.highlights.push(h)
  }
  for (const f of proposals.feeds) {
    if (edit(`people/${f.personId}.mdx`, (t) => setYoutubeChannelId(t, f.channelId), `feed de ${f.personId}`)) applied.feeds.push(f)
  }
  return { changed, skipped, applied }
}

export function writeReport(contentDir: string, report: RadarFrontmatter, summary: string): string {
  const rel = `radar/${report.week}.mdx`
  fs.mkdirSync(path.join(contentDir, 'radar'), { recursive: true })
  fs.writeFileSync(path.join(contentDir, rel), renderReport(report, summary))
  return rel
}
