import { describe, expect, it } from 'vitest'
import { runMigrations } from '@/scripts/migrate'

describe('migraciones en el build', () => {
  it('sin DATABASE_URL no hace nada (CI, E2E y builds locales)', async () => {
    const lines: string[] = []
    expect(await runMigrations({}, (s) => lines.push(s))).toBe('skipped')
    expect(lines[0]).toContain('sin DATABASE_URL')
  })
})
