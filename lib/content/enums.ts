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

export const LANGUAGES = ['es', 'en'] as const
export const PLATFORMS = ['youtube', 'x', 'linkedin', 'github', 'blog', 'podcast', 'newsletter', 'site'] as const
export const PERSON_KINDS = ['person', 'organization'] as const
export const HIGHLIGHT_FORMATS = ['video', 'course', 'article', 'thread', 'podcast', 'book', 'repo'] as const

export type Language = (typeof LANGUAGES)[number]
export type Platform = (typeof PLATFORMS)[number]
export type PersonKind = (typeof PERSON_KINDS)[number]
export type HighlightFormat = (typeof HIGHLIGHT_FORMATS)[number]

export const RELEVANCES = ['high', 'medium'] as const
export const PROPOSAL_TYPES = ['status', 'new-node', 'highlight', 'feeds'] as const
export const SOURCE_KINDS = ['rss', 'hackernews', 'github'] as const
export const GENERATORS = ['radar-agent', 'manual'] as const

export type Relevance = (typeof RELEVANCES)[number]
export type ProposalType = (typeof PROPOSAL_TYPES)[number]
export type SourceKind = (typeof SOURCE_KINDS)[number]

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
  es: 'Español',
  en: 'Inglés',
  youtube: 'YouTube',
  x: 'X',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  blog: 'Blog',
  podcast: 'Podcast',
  newsletter: 'Newsletter',
  site: 'Sitio web',
  person: 'Persona',
  organization: 'Organización',
  video: 'Video',
  course: 'Curso',
  article: 'Artículo',
  thread: 'Hilo',
  book: 'Libro',
  repo: 'Repositorio',
  high: 'Alta',
  medium: 'Media',
  status: 'Cambio de estado',
  'new-node': 'Nodo nuevo',
  highlight: 'Recurso destacado',
  feeds: 'Feed de YouTube',
  rss: 'RSS',
  hackernews: 'Hacker News',
}
