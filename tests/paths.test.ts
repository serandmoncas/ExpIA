import { describe, it, expect } from 'vitest'
import {
  stepIds, resolveAfterChain, checkPathOrder, sortPaths, pathProgress, nextStep,
  pathsContaining, orderPathsForAudience, pickContinue, toStepViews, type PathLike,
} from '@/lib/paths'
import type { CatalogNode, Person } from '@/lib/content/types'

const p = (id: string, steps: string[], o: Partial<PathLike> = {}): PathLike => ({
  id, audience: ['technical'], steps: steps.map((node) => ({ node })), ...o,
})
const req: Record<string, string[]> = { a: [], b: ['a'], c: ['b'], d: ['c', 'a'] }
const requiresOf = (id: string) => req[id]

describe('resolveAfterChain', () => {
  it('devuelve la cadena de rutas previas, de la más cercana a la más lejana', () => {
    const paths = [p('x', []), p('y', [], { after: 'x' }), p('z', [], { after: 'y' })]
    expect(resolveAfterChain(paths, 'z')).toEqual({ chain: ['y', 'x'] })
    expect(resolveAfterChain(paths, 'x')).toEqual({ chain: [] })
  })
  it('reporta una ruta previa inexistente', () => {
    expect(resolveAfterChain([p('y', [], { after: 'nope' })], 'y').error).toBe('after: la ruta "nope" no existe')
  })
  it('reporta un ciclo', () => {
    const paths = [p('x', [], { after: 'y' }), p('y', [], { after: 'x' })]
    expect(resolveAfterChain(paths, 'x').error).toBe('ciclo en after: x → y → x')
  })
})

describe('checkPathOrder', () => {
  it('acepta pasos que respetan sus prerrequisitos', () => {
    expect(checkPathOrder(['a', 'b', 'c', 'd'], requiresOf, new Set())).toEqual([])
  })
  it('reporta un paso antes de su prerrequisito', () => {
    expect(checkPathOrder(['b', 'a', 'c'], requiresOf, new Set())).toEqual(['"b" requiere "a", que no aparece antes'])
  })
  it('acepta prerrequisitos cubiertos por la ruta previa y lo nombra al fallar', () => {
    expect(checkPathOrder(['c', 'd'], requiresOf, new Set(['a', 'b']), 'base')).toEqual([])
    expect(checkPathOrder(['c'], requiresOf, new Set(['a']), 'base')).toEqual(['"c" requiere "b", que no aparece antes ni en la ruta "base"'])
  })
  it('ignora nodos desconocidos (los reporta el cargador)', () => {
    expect(checkPathOrder(['nope', 'a'], requiresOf, new Set())).toEqual([])
  })
})

describe('sortPaths', () => {
  it('ordena por profundidad de after y luego por id', () => {
    const paths = [p('zz', [], { after: 'm' }), p('m', []), p('b', [], { after: 'm' }), p('agente', [], { after: 'zz' })]
    expect(sortPaths(paths).map((x) => x.id)).toEqual(['m', 'b', 'zz', 'agente'])
  })
})

describe('progreso', () => {
  const ids = ['a', 'b', 'c']
  it('cuenta lo aprendido y encuentra el siguiente paso', () => {
    expect(pathProgress(ids, new Set())).toEqual({ done: 0, total: 3 })
    expect(pathProgress(ids, new Set(['b', 'zz']))).toEqual({ done: 1, total: 3 })
    expect(nextStep(ids, new Set(['a']))).toBe('b')
    expect(nextStep(ids, new Set(['a', 'c']))).toBe('b')
    expect(nextStep(ids, new Set(ids))).toBeUndefined()
  })
  it('stepIds lista los nodos en orden', () => {
    expect(stepIds(p('x', ['a', 'b']))).toEqual(['a', 'b'])
  })
})

describe('pathsContaining y orderPathsForAudience', () => {
  const tech = p('tech', ['a', 'b'])
  const biz = p('biz', ['b'], { audience: ['business'] })
  const both = p('both', ['c'], { audience: ['technical', 'business'] })
  it('encuentra las rutas que contienen un nodo', () => {
    expect(pathsContaining([tech, biz, both], 'b').map((x) => x.id)).toEqual(['tech', 'biz'])
  })
  it('pone primero las rutas de la audiencia elegida, sin perder el orden', () => {
    expect(orderPathsForAudience([tech, biz, both], 'all').map((x) => x.id)).toEqual(['tech', 'biz', 'both'])
    expect(orderPathsForAudience([tech, biz, both], 'business').map((x) => x.id)).toEqual(['biz', 'both', 'tech'])
  })
})

describe('pickContinue', () => {
  const x = p('x', ['a', 'b', 'c', 'd'])
  const y = p('y', ['a', 'b'])
  it('elige la ruta empezada con mayor progreso y su siguiente paso', () => {
    expect(pickContinue([x, y], new Set(['a']))).toEqual({ path: y, next: 'b', done: 1, total: 2 })
  })
  it('ignora rutas sin empezar o terminadas', () => {
    expect(pickContinue([x, y], new Set())).toBeUndefined()
    expect(pickContinue([y], new Set(['a', 'b']))).toBeUndefined()
  })
  it('ante empate se queda con la primera', () => {
    const z = p('z', ['c', 'd'])
    expect(pickContinue([y, z], new Set(['a', 'c']))?.path.id).toBe('y')
  })
})

describe('toStepViews', () => {
  it('arma cada paso con el nodo, la nota y los referentes del tema', () => {
    const node = (id: string) => ({ id, title: id.toUpperCase(), level: 'fundamentals', summary: 's', sections: {} }) as unknown as CatalogNode
    const byId = new Map([['a', node('a')], ['b', node('b')]])
    const people = [{ id: 'p', topics: ['b'] }, { id: 'q', topics: ['a', 'b'] }] as unknown as Person[]
    const views = toStepViews([{ node: 'a', note: 'ojo' }, { node: 'b' }], byId, people)
    expect(views.map((v) => [v.node.id, v.node.title, v.note, v.voices.map((x) => x.id)])).toEqual([
      ['a', 'A', 'ojo', ['q']],
      ['b', 'B', undefined, ['p', 'q']],
    ])
    expect(views[0].node).not.toHaveProperty('sections')
  })
})
