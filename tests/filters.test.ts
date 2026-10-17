import { describe, it, expect } from 'vitest'
import {
  parseFilters, serializeFilters, applyFilters, toggleValue, EMPTY_FILTERS, type FilterableNode, type Filters,
  parsePeopleFilters, serializePeopleFilters, applyPeopleFilters, EMPTY_PEOPLE_FILTERS, type FilterablePerson, type PeopleFilters,
} from '@/lib/filters'

const CATS = ['llm', 'agents', 'retrieval']
const p = (qs: string) => parseFilters(new URLSearchParams(qs), CATS)

type N = FilterableNode & { id: string }
const node = (id: string, o: Partial<FilterableNode> = {}): N => ({
  id,
  category: ['llm'],
  kind: 'concept',
  audience: ['technical'],
  level: 'fundamentals',
  status: 'mainstream',
  date: { year: 2020 },
  ...o,
})

describe('parseFilters', () => {
  it('parsea listas y rango de años', () => {
    const f = p('cat=llm,agents&kind=tool&from=2017&to=2020')
    expect(f.cat).toEqual(['llm', 'agents'])
    expect(f.kind).toEqual(['tool'])
    expect(f.from).toBe(2017)
    expect(f.to).toBe(2020)
  })
  it('ignora valores inválidos sin romper', () => {
    const f = p('level=foo,advanced&kind=&from=abc&to=99999&cat=nope&aud=business,business')
    expect(f.level).toEqual(['advanced'])
    expect(f.kind).toEqual([])
    expect(f.cat).toEqual([])
    expect(f.aud).toEqual(['business'])
    expect(f.from).toBeUndefined()
    expect(f.to).toBeUndefined()
  })
  it('invierte from/to si llegan al revés', () => {
    const f = p('from=2020&to=2010')
    expect([f.from, f.to]).toEqual([2010, 2020])
  })
  it('conserva q sin partirlo por comas', () => {
    expect(p('q=hola%2C%20mundo').q).toBe('hola, mundo')
  })
  it('sin knownCategories acepta cualquier categoría', () => {
    expect(parseFilters(new URLSearchParams('cat=x')).cat).toEqual(['x'])
  })
})

describe('serializeFilters', () => {
  it('serializa los filtros vacíos como texto vacío', () => {
    expect(serializeFilters(EMPTY_FILTERS)).toBe('')
  })
  it('hace ida y vuelta', () => {
    const f: Filters = { ...EMPTY_FILTERS, q: 'hola, mundo', cat: ['llm', 'agents'], level: ['advanced'], from: 2010, to: 2020 }
    expect(p(serializeFilters(f))).toEqual(f)
  })
  it('genera URLs legibles', () => {
    expect(serializeFilters({ ...EMPTY_FILTERS, cat: ['agents'], level: ['fundamentals'] })).toBe('cat=agents&level=fundamentals')
  })
})

describe('applyFilters', () => {
  const nodes = [
    node('a'),
    node('b', { kind: 'tool', category: ['agents'], license: 'open-source', date: { year: 2023 } }),
    node('c', { kind: 'tool', category: ['retrieval', 'llm'], audience: ['business'], date: { year: 2015 } }),
  ]
  const ids = (f: Partial<Filters>) => applyFilters(nodes, { ...EMPTY_FILTERS, ...f }).map((n) => n.id)

  it('sin filtros devuelve todo', () => expect(ids({})).toEqual(['a', 'b', 'c']))
  it('aplica OR dentro de un grupo', () => expect(ids({ cat: ['agents', 'retrieval'] })).toEqual(['b', 'c']))
  it('aplica AND entre grupos', () => expect(ids({ kind: ['tool'], cat: ['llm'] })).toEqual(['c']))
  it('excluye nodos sin license cuando se filtra por license', () => expect(ids({ license: ['open-source'] })).toEqual(['b']))
  it('el rango de años es inclusivo', () => expect(ids({ from: 2020, to: 2023 })).toEqual(['a', 'b']))
  it('ignora q', () => expect(ids({ q: 'zzz' })).toEqual(['a', 'b', 'c']))
})

describe('toggleValue', () => {
  it('agrega y quita', () => {
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('filtros de personas', () => {
  const TOPICS = ['rag', 'llm']
  const pp = (qs: string) => parsePeopleFilters(new URLSearchParams(qs), TOPICS)
  type P = FilterablePerson & { id: string }
  const person = (id: string, o: Partial<FilterablePerson> = {}): P => ({
    id, topics: ['llm'], languages: ['en'], platforms: { youtube: 'https://y.com' },
    audience: ['technical'], level: 'intermediate', kind: 'person', ...o,
  })
  const people = [
    person('en'),
    person('bi', { languages: ['en', 'es'], topics: ['rag'], platforms: { x: 'https://x.com/a' } }),
    person('es', { languages: ['es'], kind: 'organization', platforms: { youtube: 'https://y.com', x: undefined } }),
  ]
  const ids = (f: Partial<PeopleFilters>) => applyPeopleFilters(people, { ...EMPTY_PEOPLE_FILTERS, ...f }).map((p) => p.id)

  it('ignora valores inválidos en la URL', () => {
    const f = pp('lang=fr,es&topic=nope,rag&platform=tiktok&kind=alien')
    expect(f.lang).toEqual(['es'])
    expect(f.topic).toEqual(['rag'])
    expect(f.platform).toEqual([])
    expect(f.kind).toEqual([])
  })
  it('hace ida y vuelta', () => {
    const f: PeopleFilters = { ...EMPTY_PEOPLE_FILTERS, q: 'ana, b', topic: ['rag'], lang: ['es', 'en'], platform: ['youtube'] }
    expect(pp(serializePeopleFilters(f))).toEqual(f)
    expect(serializePeopleFilters(EMPTY_PEOPLE_FILTERS)).toBe('')
  })
  it('un referente bilingüe aparece con cualquiera de sus idiomas', () => {
    expect(ids({ lang: ['es'] })).toEqual(['bi', 'es'])
    expect(ids({ lang: ['en'] })).toEqual(['en', 'bi'])
  })
  it('filtra por plataforma ignorando claves vacías', () => {
    expect(ids({ platform: ['x'] })).toEqual(['bi'])
  })
  it('combina grupos con AND', () => {
    expect(ids({ lang: ['es'], kind: ['organization'] })).toEqual(['es'])
    expect(ids({ topic: ['rag'], lang: ['en'] })).toEqual(['bi'])
  })
})
