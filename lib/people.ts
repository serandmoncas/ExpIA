import type { AudiencePref } from '@/lib/audience'
import type { Language } from '@/lib/content/enums'
import type { Highlight, Person } from '@/lib/content/types'

export interface TopicHighlight {
  person: Person
  highlight: Highlight
}

export function getHighlightsForTopic(people: Person[], nodeId: string): TopicHighlight[] {
  return people.flatMap((person) =>
    person.highlights.filter((h) => h.topic === nodeId).map((highlight) => ({ person, highlight })),
  )
}

// La lista completa puede ser larga en temas populares (LLM); la ficha muestra solo unos pocos
export function selectTopicHighlights(highlights: TopicHighlight[], pref: AudiencePref = 'all', limit = 5): TopicHighlight[] {
  const score = (h: TopicHighlight) => (pref === 'business' && h.person.audience.includes('business') ? 1 : 0)
  return highlights
    .map((h, i) => ({ h, i, s: score(h) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.h)
}

export function getVoicesForTopic(people: Person[], nodeId: string, pref: AudiencePref = 'all'): Person[] {
  const score = (p: Person) =>
    (pref === 'business' && p.audience.includes('business') ? 2 : 0) +
    (p.highlights.some((h) => h.topic === nodeId) ? 1 : 0)
  return people
    .filter((p) => p.topics.includes(nodeId))
    .map((p, i) => ({ p, i, s: score(p) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p)
}

export function findUncoveredFundamentals(nodes: { id: string; level: string }[], people: { topics: string[] }[]): string[] {
  const covered = new Set(people.flatMap((p) => p.topics))
  return nodes.filter((n) => n.level === 'fundamentals' && !covered.has(n.id)).map((n) => n.id)
}

export function selectStarterPeople(people: Person[], limit = 6): Person[] {
  const es = (p: Person) => (p.languages.includes('es') ? 0 : 1)
  return people
    .filter((p) => p.level === 'fundamentals')
    .sort((a, b) => es(a) - es(b) || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit)
}

export function highlightLanguage(person: Pick<Person, 'languages'>, h: Pick<Highlight, 'language'>): Language {
  return h.language ?? person.languages[0]
}

export function resolveTopic(topics: { id: string; title: string }[], text: string): string | undefined {
  const needle = text.trim().toLowerCase()
  if (!needle) return undefined
  return topics.find((t) => t.title.toLowerCase() === needle)?.id
}
