import { describe, it, expect } from 'vitest'
import { parseReleased, compareDates, toFractionalYear, formatReleased } from '@/lib/dates'

describe('parseReleased', () => {
  it('parsea precisión de año', () => {
    expect(parseReleased('2020')).toMatchObject({ raw: '2020', year: 2020, precision: 'year' })
  })
  it('parsea precisión de mes', () => {
    expect(parseReleased('2020-05')).toMatchObject({ year: 2020, month: 5, precision: 'month' })
  })
  it('parsea precisión de día', () => {
    expect(parseReleased('2020-05-22')).toMatchObject({ year: 2020, month: 5, day: 22, precision: 'day' })
  })
  it('acepta 29 de febrero en año bisiesto', () => {
    expect(parseReleased('2024-02-29').day).toBe(29)
  })
  it.each(['20', '2020-13', '2020-02-30', '2023-02-29', '2020/05', '', 'mayo 2020'])('rechaza "%s"', (raw) => {
    expect(() => parseReleased(raw)).toThrow(/^Fecha inválida/)
  })
})

describe('compareDates', () => {
  it('ordena por inicio del periodo, el año antes que el mes del mismo año', () => {
    const sorted = ['2020-05', '2019', '2020', '2020-05-22'].map(parseReleased).sort(compareDates).map((d) => d.raw)
    expect(sorted).toEqual(['2019', '2020', '2020-05', '2020-05-22'])
  })
})

describe('toFractionalYear', () => {
  it('devuelve el inicio del periodo', () => {
    expect(toFractionalYear(parseReleased('2020'))).toBe(2020)
    expect(toFractionalYear(parseReleased('2020-07'))).toBeCloseTo(2020.5)
  })
})

describe('formatReleased', () => {
  it('no inventa precisión', () => {
    expect(formatReleased(parseReleased('2020'))).toBe('2020')
    expect(formatReleased(parseReleased('2020-05'))).toBe('may 2020')
    expect(formatReleased(parseReleased('2020-05-22'))).toBe('22 may 2020')
  })
})
