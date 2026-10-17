import { describe, it, expect } from 'vitest'
import { splitSections } from '@/lib/content/sections'

const FULL = '## Para qué sirve\nA\n\n## Cómo se usa\nB\n\n## Para no técnicos\nC\n'

describe('splitSections', () => {
  it('extrae las tres secciones', () => {
    const { sections, missing } = splitSections(FULL)
    expect(sections).toEqual({ purpose: 'A', usage: 'B', nonTechnical: 'C' })
    expect(missing).toEqual([])
  })
  it('reporta las secciones que faltan por su título', () => {
    expect(splitSections('## Para qué sirve\nA\n').missing).toEqual(['Cómo se usa', 'Para no técnicos'])
  })
  it('no parte en "## " dentro de un bloque de código', () => {
    const body = '## Para qué sirve\nA\n## Cómo se usa\n```python\n## paso 1\nx = 1\n```\n## Para no técnicos\nC'
    const { sections, missing } = splitSections(body)
    expect(missing).toEqual([])
    expect(sections.usage).toContain('## paso 1')
  })
  it('soporta finales de línea CRLF', () => {
    const { sections, missing } = splitSections(FULL.replace(/\n/g, '\r\n'))
    expect(missing).toEqual([])
    expect(sections.purpose).toBe('A')
  })
  it('reporta los títulos H2 desconocidos y no los mezcla con la sección anterior', () => {
    const { sections, unknown } = splitSections('## Para qué sirve\nA\n## Extra\nZ\n## Cómo se usa\nB\n## Para no técnicos\nC')
    expect(sections.purpose).toBe('A')
    expect(unknown).toEqual(['Extra'])
  })
  it('reporta las secciones duplicadas', () => {
    expect(splitSections(FULL + '## Para qué sirve\nD\n').duplicates).toEqual(['Para qué sirve'])
  })
})
