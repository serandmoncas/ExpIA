import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { load } from 'js-yaml'

type Step = { name?: string; run?: string; shell?: string }
const workflow = load(fs.readFileSync('.github/workflows/radar.yml', 'utf8')) as { jobs: { radar: { steps: Step[] } } }
const steps = workflow.jobs.radar.steps

describe('workflow del radar', () => {
  it('el paso de pruebas falla cuando npm test falla aunque pase por tee', () => {
    const tests = steps.find((s) => s.name === 'Pruebas')!
    // Sin shell explícito, Actions usa `bash -e` sin pipefail y `| tee` oculta el fallo
    expect(tests.shell === 'bash' || /set -o pipefail/.test(tests.run ?? '')).toBe(true)
  })
})
