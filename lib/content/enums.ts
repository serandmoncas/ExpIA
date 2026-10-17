export const KINDS = ['concept', 'technique', 'model', 'tool', 'protocol'] as const
export const AUDIENCES = ['technical', 'business'] as const
export const LEVELS = ['fundamentals', 'intermediate', 'advanced'] as const
export const STATUSES = ['emerging', 'rising', 'mainstream', 'declining'] as const
export const LICENSES = ['open-source', 'proprietary'] as const
export const PRICINGS = ['free', 'freemium', 'paid'] as const

export type Kind = (typeof KINDS)[number]
export type Audience = (typeof AUDIENCES)[number]
export type Level = (typeof LEVELS)[number]
export type Status = (typeof STATUSES)[number]
export type License = (typeof LICENSES)[number]
export type Pricing = (typeof PRICINGS)[number]

export const LABELS: Record<string, string> = {
  concept: 'Concepto',
  technique: 'Técnica',
  model: 'Modelo',
  tool: 'Herramienta',
  protocol: 'Protocolo',
  technical: 'Técnico',
  business: 'No técnico',
  fundamentals: 'Fundamentos',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
  emerging: 'Emergente',
  rising: 'Tomando fuerza',
  mainstream: 'Consolidado',
  declining: 'En declive',
  'open-source': 'Open source',
  proprietary: 'Propietario',
  free: 'Gratis',
  freemium: 'Freemium',
  paid: 'Pago',
}
