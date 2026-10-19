import { describe, expect, it } from 'vitest'
import { messageFor } from '@/lib/messages'

const table = { conocido: 'Mensaje' }
describe('messageFor', () => {
  it('devuelve el mensaje de una clave propia', () => expect(messageFor(table, 'conocido', 'x')).toBe('Mensaje'))
  it.each(['__proto__', 'constructor', 'toString', 'desconocido'])('usa el texto por defecto con %s', (k) => {
    expect(messageFor(table, k, 'x')).toBe('x')
  })
})
