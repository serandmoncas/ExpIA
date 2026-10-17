export type SectionKey = 'purpose' | 'usage' | 'nonTechnical'
export type NodeSections = Record<SectionKey, string>

export const SECTION_HEADINGS: Record<SectionKey, string> = {
  purpose: 'Para qué sirve',
  usage: 'Cómo se usa',
  nonTechnical: 'Para no técnicos',
}

export const PERSON_SECTION_HEADINGS: Record<'why', string> = { why: 'Por qué seguirle' }

export interface SplitResult<K extends string> {
  sections: Partial<Record<K, string>>
  missing: string[]
  unknown: string[]
  duplicates: string[]
}

export function splitSectionsBy<K extends string>(body: string, headings: Record<K, string>): SplitResult<K> {
  const keys = Object.keys(headings) as K[]
  const collected: Partial<Record<K, string[]>> = {}
  const unknown: string[] = []
  const duplicates: string[] = []
  let current: K | null = null
  let inFence = false

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    const heading = !inFence ? /^## +(.+?)\s*$/.exec(line) : null
    if (heading) {
      current = keys.find((k) => headings[k] === heading[1]) ?? null
      if (!current) unknown.push(heading[1])
      else if (collected[current]) duplicates.push(heading[1])
      if (current) collected[current] = []
      continue
    }
    if (current) collected[current]!.push(line)
  }

  const sections: Partial<Record<K, string>> = {}
  for (const k of keys) if (collected[k]) sections[k] = collected[k]!.join('\n').trim()
  const missing = keys.filter((k) => !collected[k]).map((k) => headings[k])
  return { sections, missing, unknown, duplicates }
}

export function splitSections(body: string): SplitResult<SectionKey> {
  return splitSectionsBy(body, SECTION_HEADINGS)
}
