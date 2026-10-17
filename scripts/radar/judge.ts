import type Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
// El helper del SDK solo acepta esquemas de zod 4; zod 3.25 los incluye en la subruta zod/v4
import { z } from 'zod/v4'
import { KINDS, AUDIENCES, LEVELS, STATUSES, HIGHLIGHT_FORMATS, RELEVANCES } from '@/lib/content/enums'
import type { RawItem } from './collect'

export const MODEL = 'claude-opus-5-5'
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

export const judgementSchema = z.object({
  summary: z.string(),
  items: z.array(z.object({
    url: z.string(),
    topics: z.array(z.string()),
    relevance: z.enum(RELEVANCES),
    summary: z.string(),
  })),
  statusChanges: z.array(z.object({
    nodeId: z.string(),
    to: z.enum(STATUSES),
    reason: z.string(),
    evidence: z.array(z.string()),
  })),
  newNodes: z.array(z.object({
    id: z.string(),
    title: z.string(),
    kind: z.enum(KINDS),
    category: z.array(z.string()),
    released: z.string(),
    audience: z.array(z.enum(AUDIENCES)),
    level: z.enum(LEVELS),
    requires: z.array(z.string()),
    related: z.array(z.string()),
    status: z.enum(['emerging', 'rising']),
    summary: z.string(),
    purpose: z.string(),
    usage: z.string(),
    nonTechnical: z.string(),
    reason: z.string(),
    evidence: z.array(z.string()),
  })),
  highlights: z.array(z.object({
    personId: z.string(),
    url: z.string(),
    format: z.enum(HIGHLIGHT_FORMATS),
    topic: z.string().optional(),
    reason: z.string(),
  })),
})

export type Judgement = z.infer<typeof judgementSchema>

export const EMPTY_JUDGEMENT: Judgement = { summary: '', items: [], statusChanges: [], newNodes: [], highlights: [] }

export interface JudgeInput {
  items: RawItem[]
  nodes: { id: string; title: string; status: string; level: string; summary: string }[]
  people: { id: string; name: string; topics: string[]; highlightCount: number }[]
  categories: { id: string; label: string }[]
}

export type JudgeClient = { beta: { messages: Pick<Anthropic['beta']['messages'], 'parse'> } }

export class JudgeError extends Error {
  name = 'JudgeError'
}

export const SYSTEM_PROMPT = `Eres el editor del radar semanal de ExpIA, un sitio en español para aprender inteligencia artificial. Su público incluye perfiles técnicos, personas no técnicas y estudiantes.

Recibes el catálogo actual (nodos con su estado), los referentes y los ítems publicados en los últimos 7 días por fuentes curadas. Devuelve:

1. items: hasta 15 ítems realmente relevantes para alguien que aprende o trabaja con IA. Para cada uno: los temas del catálogo que toca (IDs existentes), la relevancia (high: cambia cómo se trabaja o se entiende un tema; medium: vale la pena conocerlo) y un resumen en español neutro de máximo 280 caracteres que explique por qué importa.
2. summary: el resumen de la semana en Markdown, de 1 a 3 párrafos, en español, sin títulos.
3. statusChanges: cambios de estado de nodos existentes, solo cuando la evidencia de esta semana lo justifique. Los estados, en orden, son emerging (recién aparece), rising (adopción creciente), mainstream (uso establecido) y declining (perdiendo uso). Solo se puede mover un paso.
4. newNodes: conceptos o herramientas significativos que aún no están en el catálogo (máximo 3). Escribe en español las tres secciones: purpose (para qué sirve), usage (cómo se usa) y nonTechnical (explicación para no técnicos), cada una de 1 a 3 párrafos en Markdown sin títulos. category, requires y related solo con IDs existentes; released en formato YYYY-MM; status emerging o rising; summary de máximo 160 caracteres; id en kebab-case.
5. highlights: recursos destacados para un referente (máximo 5), solo con ítems cuya fuente (source) es ese referente.

Reglas:
- Usa solo URLs que aparezcan en la lista de ítems. Cualquier otra URL se descarta.
- Cada propuesta necesita evidencia: URLs de ítems de esta semana.
- Prefiere no proponer a proponer con poca evidencia. Una semana sin cambios es un resultado válido.
- Ignora ofertas de empleo, contenido promocional sin sustancia y noticias sin relación con la IA.`

export function buildUserMessage(input: JudgeInput): string {
  return [
    '## Categorías', JSON.stringify(input.categories),
    '## Nodos del catálogo', JSON.stringify(input.nodes),
    '## Referentes', JSON.stringify(input.people),
    `## Ítems de los últimos 7 días (${input.items.length})`, JSON.stringify(input.items),
  ].join('\n\n')
}

export async function judge(client: JudgeClient, input: JudgeInput): Promise<Judgement> {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(input) }],
    output_config: { effort: 'medium', format: betaZodOutputFormat(judgementSchema) },
  })
  if (response.stop_reason === 'refusal') throw new JudgeError('El modelo rechazó la petición (stop_reason: refusal)')
  if (response.stop_reason === 'max_tokens') throw new JudgeError('La respuesta se cortó por max_tokens')
  if (!response.parsed_output) throw new JudgeError('La respuesta no cumple el esquema')
  return response.parsed_output
}
