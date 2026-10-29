import { describe, expect, it } from 'vitest'
import { getCatalog } from '@/lib/content/load'
import { curatedRef, generatedRef, resolvePathRef } from '@/lib/path-refs'

const catalog = getCatalog()

describe('resolvePathRef', () => {
  it('resuelve una ruta curada', () => {
    const r = resolvePathRef(curatedRef('fundamentos'), catalog)!
    expect(r.title).toBe(catalog.paths.find((p) => p.id === 'fundamentos')!.title)
    expect(r.ids[0]).toBe('machine-learning')
    expect(r.ids.at(-1)).toBe('llm')
    expect(r.href).toBe('/paths/fundamentos')
  })
  it('resuelve una ruta generada que termina en su nodo', () => {
    const r = resolvePathRef(generatedRef('llm'), catalog)!
    expect(r.ids.at(-1)).toBe('llm')
    expect(r.title).toBe(`Hasta ${catalog.byId.get('llm')!.title}`)
    expect(r.href).toBe('/learn/llm')
  })
  it.each(['curated:no-existe', 'generated:no-existe', 'guide:abc', 'fundamentos', ''])('devuelve null para %s', (ref) => {
    expect(resolvePathRef(ref, catalog)).toBeNull()
  })
})
