import { describe, it, expect } from 'vitest'
import { createSearch } from '@/lib/search'

const nodes = [
  { id: 'rag', title: 'RAG (Retrieval-Augmented Generation)', summary: 'Darle al LLM información externa', category: ['retrieval'] },
  { id: 'mcp', title: 'Model Context Protocol', summary: 'Protocolo para conectar herramientas', category: ['protocols'] },
]

describe('createSearch', () => {
  const search = createSearch(nodes)
  it('devuelve todo con una consulta vacía o de espacios', () => {
    expect(search('')).toEqual(nodes)
    expect(search('   ')).toEqual(nodes)
  })
  it('encuentra por título, resumen y categoría', () => {
    expect(search('retrieval').map((n) => n.id)).toContain('rag')
    expect(search('protocolo').map((n) => n.id)).toEqual(['mcp'])
  })
  it('tolera errores de escritura', () => {
    expect(search('protocl').map((n) => n.id)).toContain('mcp')
  })
})
