import { describe, it, expect } from 'vitest'
import { layoutTimeline, tickStep, type TimelineInput } from '@/lib/timeline'
import { parseReleased } from '@/lib/dates'

const n = (id: string, released: string, kind: TimelineInput['kind'] = 'concept'): TimelineInput => ({
  id, title: id, kind, category: ['llm'], date: parseReleased(released),
})
const opts = { pxPerYear: 10, maxYear: 2030, labelWidth: 50 }
const color = () => '#000000'

describe('layoutTimeline', () => {
  it('redondea minYear hacia abajo a la década y calcula el ancho', () => {
    const l = layoutTimeline([n('a', '2017'), n('b', '2023-06')], color, opts)
    expect(l.minYear).toBe(2010)
    expect(l.width).toBe(200)
  })
  it('dibuja las fechas de solo año como barra de un año y las precisas como punto', () => {
    const l = layoutTimeline([n('a', '2017'), n('b', '2017-07')], color, opts)
    const a = l.items.find((i) => i.id === 'a')!
    const b = l.items.find((i) => i.id === 'b')!
    expect(a).toMatchObject({ x: 70, width: 10, precision: 'year', dateLabel: '2017' })
    expect(b.width).toBe(0)
    expect(b.x).toBeCloseTo(75)
  })
  it('pone en filas distintas los elementos que se solapan', () => {
    const l = layoutTimeline([n('a', '2017'), n('b', '2018'), n('c', '2025')], color, opts)
    const row = (id: string) => l.items.find((i) => i.id === id)!.row
    expect(row('a')).not.toBe(row('b'))   // a ocupa 70..120 por el ancho de etiqueta; b empieza en 80
    expect(row('c')).toBe(row('a'))       // c empieza en 150, ya libre
  })
  it('agrupa por carril de kind en el orden de KINDS, solo los presentes', () => {
    const l = layoutTimeline([n('t', '2020', 'tool'), n('c', '2020', 'concept')], color, opts)
    expect(l.lanes.map((x) => x.kind)).toEqual(['concept', 'tool'])
    expect(l.lanes[1].startRow).toBe(l.lanes[0].rows)
    expect(l.totalRows).toBe(2)
  })
  it('maneja una lista vacía', () => {
    const l = layoutTimeline([], color, opts)
    expect(l.items).toEqual([])
    expect(l.totalRows).toBe(0)
  })
})

describe('tickStep', () => {
  it('adapta las marcas al zoom', () => {
    expect(tickStep(100)).toBe(1)
    expect(tickStep(40)).toBe(5)
    expect(tickStep(10)).toBe(10)
  })
})
