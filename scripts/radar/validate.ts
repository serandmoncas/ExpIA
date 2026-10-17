import { nodeFrontmatterSchema, type NodeFrontmatter, type ReportItem } from '@/lib/content/schema'
import type { Status } from '@/lib/content/enums'
import type { Highlight, Person } from '@/lib/content/types'
import { isAdjacentStatus } from '@/lib/radar'
import { normalizeUrl, type RawItem } from './collect'
import type { Judgement } from './judge'

export const LIMITS = { items: 15, statusChanges: 5, newNodes: 3, highlights: 5 } as const
const MAX_HIGHLIGHTS = 5

export interface ValidationContext {
  items: RawItem[]
  nodes: { id: string; status: Status }[]
  people: Person[]
  categoryIds: string[]
  today: string
}

export interface StatusChange { nodeId: string; from: Status; to: Status; reason: string; evidence: string[] }
export interface NewNode { front: NodeFrontmatter; sections: { purpose: string; usage: string; nonTechnical: string }; reason: string; evidence: string[] }
export interface HighlightProposal { personId: string; highlight: Highlight; reason: string; evidence: string[] }

export interface ValidatedJudgement {
  summary: string
  items: ReportItem[]
  statusChanges: StatusChange[]
  newNodes: NewNode[]
  highlights: HighlightProposal[]
  discarded: string[]
}

// Descarta (nunca corrige) todo lo que el modelo no pueda respaldar con la entrada
export function validateJudgement(j: Judgement, ctx: ValidationContext): ValidatedJudgement {
  const inputByUrl = new Map(ctx.items.map((i) => [i.url, i]))
  const find = (url: string) => inputByUrl.get(normalizeUrl(url) ?? url)
  const nodeStatus = new Map(ctx.nodes.map((n) => [n.id, n.status]))
  const peopleById = new Map(ctx.people.map((p) => [p.id, p]))
  const categories = new Set(ctx.categoryIds)
  const discarded: string[] = []
  const reject = (what: string, why: string) => discarded.push(`${what} — ${why}`)
  const evidenceProblem = (ev: string[]): string | null => {
    if (ev.length === 0) return 'sin evidencia'
    const missing = ev.find((u) => !find(u))
    return missing ? `evidencia fuera de la entrada: ${missing}` : null
  }
  const resolveEvidence = (ev: string[]) => [...new Set(ev.map((u) => find(u)!.url))]

  const items: ReportItem[] = []
  for (const it of j.items) {
    const label = `ítem ${it.url}`
    const src = find(it.url)
    if (!src) { reject(label, 'URL no incluida en la entrada'); continue }
    if (items.some((x) => x.url === src.url)) { reject(label, 'duplicado'); continue }
    const unknown = it.topics.filter((t) => !nodeStatus.has(t))
    if (it.topics.length === 0) { reject(label, 'sin temas'); continue }
    if (unknown.length) { reject(label, `temas inexistentes: ${unknown.join(', ')}`); continue }
    const summary = it.summary.trim()
    if (!summary || summary.length > 280) { reject(label, 'resumen vacío o de más de 280 caracteres'); continue }
    if (items.length >= LIMITS.items) { reject(label, `supera el tope de ${LIMITS.items}`); continue }
    items.push({
      title: src.title, url: src.url, source: src.source, publishedAt: src.publishedAt.slice(0, 10),
      topics: [...new Set(it.topics)], relevance: it.relevance, summary,
    })
  }

  const statusChanges: StatusChange[] = []
  for (const c of j.statusChanges) {
    const label = `estado de ${c.nodeId}`
    const from = nodeStatus.get(c.nodeId)
    if (!from) { reject(label, 'el nodo no existe'); continue }
    if (!isAdjacentStatus(from, c.to)) { reject(label, `${from} → ${c.to} no es un paso adyacente`); continue }
    const problem = evidenceProblem(c.evidence)
    if (problem) { reject(label, problem); continue }
    if (statusChanges.some((s) => s.nodeId === c.nodeId)) { reject(label, 'duplicado'); continue }
    if (statusChanges.length >= LIMITS.statusChanges) { reject(label, `supera el tope de ${LIMITS.statusChanges}`); continue }
    statusChanges.push({ nodeId: c.nodeId, from, to: c.to, reason: c.reason, evidence: resolveEvidence(c.evidence) })
  }

  const newNodes: NewNode[] = []
  for (const n of j.newNodes) {
    const label = `nodo nuevo ${n.id}`
    if (nodeStatus.has(n.id) || newNodes.some((x) => x.front.id === n.id)) { reject(label, 'el id ya existe'); continue }
    const badRefs = [...n.requires, ...n.related].filter((r) => !nodeStatus.has(r))
    if (badRefs.length) { reject(label, `referencias inexistentes: ${badRefs.join(', ')}`); continue }
    const badCats = n.category.filter((c) => !categories.has(c))
    if (badCats.length) { reject(label, `categorías inexistentes: ${badCats.join(', ')}`); continue }
    const problem = evidenceProblem(n.evidence)
    if (problem) { reject(label, problem); continue }
    if (![n.purpose, n.usage, n.nonTechnical].every((s) => s.trim())) { reject(label, 'falta el texto de alguna sección'); continue }
    const parsed = nodeFrontmatterSchema.safeParse({
      id: n.id, title: n.title, kind: n.kind, category: n.category, released: n.released, audience: n.audience,
      level: n.level, requires: n.requires, related: n.related, status: n.status, summary: n.summary,
      verified: false, added: ctx.today,
    })
    if (!parsed.success) { reject(label, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')); continue }
    if (newNodes.length >= LIMITS.newNodes) { reject(label, `supera el tope de ${LIMITS.newNodes}`); continue }
    newNodes.push({
      front: parsed.data,
      sections: { purpose: n.purpose.trim(), usage: n.usage.trim(), nonTechnical: n.nonTechnical.trim() },
      reason: n.reason,
      evidence: resolveEvidence(n.evidence),
    })
  }

  const highlights: HighlightProposal[] = []
  for (const h of j.highlights) {
    const label = `recurso para ${h.personId}`
    const person = peopleById.get(h.personId)
    const src = find(h.url)
    if (!person) { reject(label, 'el referente no existe'); continue }
    if (!src) { reject(label, 'URL no incluida en la entrada'); continue }
    if (src.source !== person.id) { reject(label, 'el ítem no es de este referente'); continue }
    const already = person.highlights.some((x) => (normalizeUrl(x.url) ?? x.url) === src.url) || highlights.some((x) => x.highlight.url === src.url)
    if (already) { reject(label, 'el recurso ya existe'); continue }
    if (h.topic && !nodeStatus.has(h.topic)) { reject(label, `tema inexistente: ${h.topic}`); continue }
    const pending = highlights.filter((x) => x.personId === person.id).length
    if (person.highlights.length + pending >= MAX_HIGHLIGHTS) { reject(label, `el referente ya tiene ${MAX_HIGHLIGHTS} recursos`); continue }
    if (highlights.length >= LIMITS.highlights) { reject(label, `supera el tope de ${LIMITS.highlights}`); continue }
    highlights.push({
      personId: person.id,
      highlight: { title: src.title, url: src.url, format: h.format, ...(h.topic ? { topic: h.topic } : {}) },
      reason: h.reason,
      evidence: [src.url],
    })
  }

  return { summary: j.summary.trim(), items, statusChanges, newNodes, highlights, discarded }
}
