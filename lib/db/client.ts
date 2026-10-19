import path from 'node:path'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

export const MIGRATIONS_DIR = path.join(process.cwd(), 'drizzle')

declare global {
  // Un solo cliente por proceso, aunque Next cargue el módulo en varios bundles
  // eslint-disable-next-line no-var
  var __expiaDb: Promise<Db> | undefined
}

export function getDb(): Promise<Db> {
  return (globalThis.__expiaDb ??= open())
}

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL
  if (url) {
    const { Pool } = await import('@neondatabase/serverless')
    const { drizzle } = await import('drizzle-orm/neon-serverless')
    return drizzle(new Pool({ connectionString: url }), { schema })
  }
  if (process.env.EXPIA_E2E === '1') return openPglite(process.env.PGLITE_DIR ?? '.pglite-e2e')
  throw new Error('Falta DATABASE_URL')
}

// Postgres en WebAssembly: en memoria sin `dir`, en disco con `dir`. Aplica las migraciones
export async function openPglite(dir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  const db = drizzle(new PGlite(dir), { schema })
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  return db
}
