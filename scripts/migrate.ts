import { pathToFileURL } from 'node:url'
import { MIGRATIONS_DIR } from '@/lib/db/client'

export async function runMigrations(env: Record<string, string | undefined>, log: (s: string) => void = console.log): Promise<'skipped' | 'applied'> {
  if (!env.DATABASE_URL) {
    log('Migraciones: sin DATABASE_URL, se omiten')
    return 'skipped'
  }
  const { Pool } = await import('@neondatabase/serverless')
  const { drizzle } = await import('drizzle-orm/neon-serverless')
  const { migrate } = await import('drizzle-orm/neon-serverless/migrator')
  const pool = new Pool({ connectionString: env.DATABASE_URL })
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR })
    log('Migraciones aplicadas')
    return 'applied'
  } finally {
    await pool.end()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runMigrations(process.env).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
