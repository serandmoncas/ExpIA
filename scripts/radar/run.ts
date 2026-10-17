import fs from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { loadCatalog } from '@/lib/content/load'
import { runRadar, collectWeek } from './pipeline'

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const contentDir = path.join(process.cwd(), 'content')
  const now = new Date()
  const githubToken = process.env.GITHUB_TOKEN

  // Sin llave de API: solo muestra lo que se recolectaría (útil para curar fuentes)
  if (args.includes('--collect-only')) {
    const { items, failures, sourcesChecked } = await collectWeek(loadCatalog(contentDir), { now, fetch, githubToken })
    console.log(JSON.stringify({ sourcesChecked, failures, items }, null, 2))
    return
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Falta ANTHROPIC_API_KEY. En GitHub: Settings › Secrets and variables › Actions › New repository secret.')
    process.exit(1)
  }

  const result = await runRadar({ contentDir, now, fetch, client: new Anthropic(), githubToken, write: !dryRun, log: (m) => console.log(m) })
  if (result.failures.length) console.warn(`Fuentes con error:\n- ${result.failures.join('\n- ')}`)
  if (dryRun) {
    console.log(JSON.stringify({ report: result.report, discarded: result.discarded }, null, 2))
    return
  }
  fs.mkdirSync('.radar', { recursive: true })
  fs.writeFileSync(path.join('.radar', 'pr-body.md'), result.prBody)
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_changes=${result.hasChanges}\nweek=${result.week}\n`)
  }
  console.log(result.hasChanges ? `Archivos cambiados:\n- ${result.changed.join('\n- ')}` : 'Sin cambios esta semana.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
