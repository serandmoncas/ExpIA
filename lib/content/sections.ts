export type SectionKey = 'purpose' | 'usage' | 'nonTechnical'
export type NodeSections = Record<SectionKey, string>

export const SECTION_HEADINGS: Record<SectionKey, string> = {
  purpose: 'Para qué sirve',
  usage: 'Cómo se usa',
  nonTechnical: 'Para no técnicos',
}

const KEYS = Object.keys(SECTION_HEADINGS) as SectionKey[]

export function splitSections(body: string): {
  sections: Partial<NodeSections>
  missing: string[]
  unknown: string[]
  duplicates: string[]
} {
  const collected: Partial<Record<SectionKey, string[]>> = {}
  const unknown: string[] = []
  const duplicates: string[] = []
  let current: SectionKey | null = null
  let inFence = false

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    const heading = !inFence ? /^## +(.+?)\s*$/.exec(line) : null
    if (heading) {
      current = KEYS.find((k) => SECTION_HEADINGS[k] === heading[1]) ?? null
      if (!current) unknown.push(heading[1])
      else if (collected[current]) duplicates.push(heading[1])
      if (current) collected[current] = []
      continue
    }
    if (current) collected[current]!.push(line)
  }

  const sections: Partial<NodeSections> = {}
  for (const k of KEYS) if (collected[k]) sections[k] = collected[k]!.join('\n').trim()
  const missing = KEYS.filter((k) => !collected[k]).map((k) => SECTION_HEADINGS[k])
  return { sections, missing, unknown, duplicates }
}
