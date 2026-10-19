import { describe, expect, it } from 'vitest'
import { mergeLearned, pendingImport, revertToggle } from '@/lib/learned-sync'

describe('sincronizar lo aprendido', () => {
  it('une sin repetir y conserva el orden', () => {
    expect(mergeLearned(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
  })
  it('revertir deshace solo si el estado sigue siendo el que se pidió', () => {
    expect(revertToggle(['a', 'b'], 'b', true)).toEqual(['a'])
    expect(revertToggle(['a'], 'b', false)).toEqual(['a', 'b'])
    // Si otra acción ya lo cambió, no se toca
    expect(revertToggle(['a'], 'b', true)).toEqual(['a'])
  })
  it('ofrece importar solo lo local que falta en el servidor, una vez', () => {
    expect(pendingImport(['a', 'b'], ['a'], false)).toEqual(['b'])
    expect(pendingImport(['a'], ['a'], false)).toEqual([])
    expect(pendingImport(['a', 'b'], [], true)).toEqual([])
  })
})
