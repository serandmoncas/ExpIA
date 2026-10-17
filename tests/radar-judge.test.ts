import { describe, it, expect } from 'vitest'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { judge, judgementSchema, EMPTY_JUDGEMENT, JudgeError, MODEL, FALLBACK_BETA, type Judgement, type JudgeClient, type JudgeInput } from '@/scripts/radar/judge'

const INPUT: JudgeInput = {
  items: [{ title: 'Nuevo', url: 'https://blog.example.com/nuevo', source: 'blog', publishedAt: '2026-10-21T00:00:00.000Z', excerpt: 'x' }],
  nodes: [{ id: 'mcp', title: 'MCP', status: 'emerging', level: 'intermediate', summary: 'Protocolo' }],
  people: [{ id: 'p', name: 'P', topics: ['mcp'], highlightCount: 2 }],
  categories: [{ id: 'llm-apps', label: 'Apps' }],
}
const RESULT: Judgement = { ...EMPTY_JUDGEMENT, summary: 'Semana tranquila.' }

function fakeClient(response: { stop_reason: string; parsed_output: Judgement | null }) {
  const calls: Record<string, unknown>[] = []
  const client = {
    beta: { messages: { parse: async (params: Record<string, unknown>) => { calls.push(params); return response } } },
  } as unknown as JudgeClient
  return { client, calls }
}

describe('judgementSchema', () => {
  it('funciona con el helper de salida estructurada del SDK (zod v4)', () => {
    expect(betaZodOutputFormat(judgementSchema).parse(JSON.stringify(RESULT))).toEqual(RESULT)
  })
})

describe('judge', () => {
  it('pide salida estructurada al modelo correcto, con esfuerzo medio y respaldo ante rechazos', async () => {
    const { client, calls } = fakeClient({ stop_reason: 'end_turn', parsed_output: RESULT })
    expect(await judge(client, INPUT)).toEqual(RESULT)
    const params = calls[0] as { model: string; betas: string[]; fallbacks: string; output_config: { effort: string; format: { type: string } }; messages: { content: string }[] }
    expect(params.model).toBe(MODEL)
    expect(params.betas).toContain(FALLBACK_BETA)
    expect(params.fallbacks).toBe('default')
    expect(params.output_config.effort).toBe('medium')
    expect(params.output_config.format.type).toBe('json_schema')
    expect(params.messages[0].content).toContain('https://blog.example.com/nuevo')
  })
  it('falla si toda la cadena rechaza la petición', async () => {
    const { client } = fakeClient({ stop_reason: 'refusal', parsed_output: null })
    await expect(judge(client, INPUT)).rejects.toThrow(JudgeError)
    await expect(judge(client, INPUT)).rejects.toThrow(/refusal/)
  })
  it('falla si la respuesta se corta por max_tokens', async () => {
    const { client } = fakeClient({ stop_reason: 'max_tokens', parsed_output: null })
    await expect(judge(client, INPUT)).rejects.toThrow(/max_tokens/)
  })
  it('falla si la respuesta no cumple el esquema', async () => {
    const { client } = fakeClient({ stop_reason: 'end_turn', parsed_output: null })
    await expect(judge(client, INPUT)).rejects.toThrow(/esquema/)
  })
})
