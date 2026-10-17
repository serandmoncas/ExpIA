import { describe, it, expect } from 'vitest'
import { LEARNED_KEY, parseLearned, readLearned, writeLearned, toggleLearned, toggleStored } from '@/lib/learned'

const known = new Set(['a', 'b', 'c'])

describe('parseLearned', () => {
  it('lee una lista válida', () => {
    expect(parseLearned('["a","c"]', known)).toEqual(['a', 'c'])
  })
  it('trata como vacío lo ausente, corrupto o que no es lista', () => {
    expect(parseLearned(null, known)).toEqual([])
    expect(parseLearned('{no es json', known)).toEqual([])
    expect(parseLearned('{"a":1}', known)).toEqual([])
    expect(parseLearned('"a"', known)).toEqual([])
  })
  it('ignora ids desconocidos o que no son texto, y quita duplicados', () => {
    expect(parseLearned('["a","borrado",3,null,"a","b"]', known)).toEqual(['a', 'b'])
  })
})

describe('readLearned y writeLearned', () => {
  it('lee y escribe con la clave esperada', () => {
    const store: Record<string, string> = {}
    writeLearned({ setItem: (k, v) => { store[k] = v } }, ['a', 'b'])
    expect(store[LEARNED_KEY]).toBe('["a","b"]')
    expect(readLearned({ getItem: (k) => store[k] ?? null }, known)).toEqual(['a', 'b'])
  })
  it('no lanza error si el almacenamiento falla o no existe', () => {
    expect(readLearned({ getItem: () => { throw new Error('SecurityError') } }, known)).toEqual([])
    expect(readLearned(undefined, known)).toEqual([])
    expect(() => writeLearned({ setItem: () => { throw new Error('QuotaExceeded') } }, ['a'])).not.toThrow()
    expect(() => writeLearned(undefined, ['a'])).not.toThrow()
  })
})

describe('toggleLearned', () => {
  it('marca y desmarca sin mutar la lista', () => {
    const ids = ['a']
    expect(toggleLearned(ids, 'b')).toEqual(['a', 'b'])
    expect(toggleLearned(ids, 'a')).toEqual([])
    expect(ids).toEqual(['a'])
  })
})

describe('toggleStored', () => {
  const storageWith = (raw: string | null) => {
    const store: Record<string, string> = raw === null ? {} : { [LEARNED_KEY]: raw }
    return { store, storage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } } }
  }
  it('parte de lo guardado aunque el estado en memoria esté desfasado', () => {
    const { store, storage } = storageWith('["a","b"]')
    expect(toggleStored(storage, known, [], 'c')).toEqual(['a', 'b', 'c'])
    expect(store[LEARNED_KEY]).toBe('["a","b","c"]')
  })
  it('sin almacenamiento usa el estado en memoria', () => {
    expect(toggleStored(undefined, known, ['a'], 'b')).toEqual(['a', 'b'])
  })
  it('si leer falla usa el estado en memoria', () => {
    const storage = { getItem: () => { throw new Error('SecurityError') }, setItem: () => {} }
    expect(toggleStored(storage, known, ['a'], 'a')).toEqual([])
  })
})
