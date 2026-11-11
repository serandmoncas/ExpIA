# Cuentas y grupos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que guías invitados por el administrador creen grupos, inviten alumnos, les asignen rutas y vean su avance, con el avance de cada alumno guardado en el servidor.

**Architecture:** Las páginas actuales siguen estáticas. Se agregan páginas dinámicas (`/entrar`, `/unirse/[token]`, `/cuenta`, `/guia`, `/guia/[grupo]`, `/admin`) y APIs (`/api/auth/*`, `/api/learned`). La lógica vive en módulos de `lib/` que reciben la base de datos (`Db`) y la persona que actúa (`Actor`) como parámetros; las páginas y acciones solo cargan, llaman y responden. Los permisos son funciones puras en `lib/access.ts`.

**Tech Stack:** Next.js 15.5, React 19, TypeScript, Drizzle ORM 0.45.4, Neon (`@neondatabase/serverless` 1.2.0, driver `neon-serverless` con transacciones), PGlite 0.5.10 (pruebas y E2E), Better Auth 1.7.11 (Google + enlace mágico), Resend 6.34.1, Zod 3, Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-cuentas-grupos-design.md`

## Global Constraints

- Toda la interfaz va en español.
- Secretos (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`) solo en variables de entorno de Vercel o `.env.local`. Nunca en el repo, en un test ni en el chat.
- Valores fijados por la spec: vencimiento por defecto 14 días, elegible de 1 a 90; hasta 50 correos por lista; 5 enlaces mágicos por correo por hora; 100 invitaciones por guía por día; nombre de grupo de 1 a 80 caracteres en texto plano; token de 32 bytes aleatorios guardado como hash SHA-256.
- Pedir un grupo ajeno o inexistente responde 404 en ambos casos.
- Los correos se guardan y comparan siempre en minúsculas.
- Las páginas que hoy son estáticas siguen siéndolo: `next build` debe seguir listándolas como `○` o `●`.
- Las 236 pruebas unitarias y las 30 E2E actuales siguen pasando.
- Versiones exactas en `package.json` (sin `^`) para las dependencias nuevas.
- Los commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Desvíos de la spec decididos al planificar

- **Login de prueba:** la spec dice "solo con `NODE_ENV=test`", pero `next start` fuerza `NODE_ENV=production`. Se activa con `EXPIA_E2E=1` y se apaga siempre que exista `VERCEL` (cualquier despliegue en Vercel). Un test verifica el 404 en ambos casos.
- **Tabla `email_log`:** no está en la spec; hace falta para contar envíos y aplicar los límites de 5 por hora y 100 por día.
- **Variable `EMAIL_FROM`:** remitente de Resend (no es un secreto).
- **El enlace de invitación se ve una sola vez:** como solo se guarda el hash, el guía ve la URL completa al crearla; después solo ve vencimiento, usos y si está revocado.

## Review Focus

1. Un parámetro `next` (o `callbackURL`) que apunte a otro dominio (`//evil.com`, `https://evil.com`) → se ignora y se va a `/cuenta`. Test: `safeNext` en la Task 2.
2. Correos con mayúsculas (`Ana@Gmail.com` autorizado como guía, Google devuelve `ana@gmail.com`) → se reconocen como el mismo correo. Tests en las Tasks 4, 5 y 7.
3. Con sesión iniciada, falla la red o el servidor al marcar "Lo aprendí" → la marca vuelve atrás y aparece "No se pudo guardar". Test E2E en la Task 13.
4. Sesión vencida o rol de guía retirado mientras la persona tiene `/guia` abierto → la siguiente visita redirige a `/entrar` o responde 404, nunca un error 500. Tests en las Tasks 4 y 13.
5. Importar el avance local con ids desconocidos, repetidos o una lista enorme → se filtran a nodos del catálogo y se rechazan más de 500. Test en la Task 8.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/db/schema.ts` | Tablas (Better Auth + propias) |
| `lib/db/client.ts` | `Db`, `getDb()` (Neon o PGlite), `openPglite()` |
| `drizzle.config.ts`, `drizzle/` | Migraciones generadas por `drizzle-kit` |
| `scripts/migrate.ts` | Aplica migraciones en el build si hay `DATABASE_URL` |
| `lib/access.ts` | Reglas puras: `Actor`, errores, `isAdmin`, `canViewGroup`, `canManageGroup`, `inviteProblem`, `mayRegister`, `safeNext`, `maskEmail`, `normalizeEmail` |
| `lib/path-refs.ts` | `resolvePathRef`: de `curated:x` / `generated:y` a título, ids y enlace |
| `lib/groups.ts` | Grupos, miembros, asignaciones, guías |
| `lib/invites.ts` | Tokens, crear, listar, revocar, buscar y canjear invitaciones |
| `lib/progress.ts` | `learned` por persona, importación, tabla del guía, grupos del alumno |
| `lib/email.ts` | `Mailer`, límites de envío, plantillas, Resend |
| `lib/registration.ts` | ¿Puede registrarse este correo? (admin, invitación de guía, cookie de invitación) |
| `lib/auth-config.ts` | `createAuth(deps)` |
| `lib/auth.ts` | `getAuth()` de producción |
| `lib/session.ts` | `getActor()` desde la sesión |
| `lib/api/learned.ts` | Lógica de `/api/learned` |
| `lib/test-login.ts` | Login de prueba para E2E |
| `lib/join.ts` | Lógica de `/unirse/[token]/entrar` y `/canjear` |
| `lib/learned-sync.ts` | Funciones puras del cliente: unir, revertir, ofrecer importar |
| `lib/auth-client.ts` | Cliente de Better Auth para React |
| `components/learned-provider.tsx` | Fuente local o servidor según la sesión (misma interfaz) |
| `components/import-offer.tsx` | "Traer tu avance de este navegador" |
| `components/account-link.tsx` | "Entrar" o el nombre en el encabezado |
| `components/sign-in-form.tsx` | Google + enlace mágico |
| `app/api/...`, `app/entrar`, `app/unirse`, `app/cuenta`, `app/guia`, `app/admin` | Rutas y páginas delgadas |

---

### Task 1: Base de datos: esquema, cliente y migraciones

**Files:**
- Modify: `package.json`, `.gitignore`, `next.config.ts`
- Create: `lib/db/schema.ts`, `lib/db/client.ts`, `drizzle.config.ts`, `drizzle/` (generado), `tests/helpers/db.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Produces: `type Db`, `getDb(): Promise<Db>`, `openPglite(dir?: string): Promise<Db>`; tablas `user`, `session`, `account`, `verification`, `learned`, `groups`, `memberships`, `invites`, `assignments`, `guideInvites`, `emailLog`; helpers de prueba `testDb()`, `resetDb(db)`, `seedUser(db, over?)`.

- [ ] **Step 1: Instalar dependencias**

```bash
npm i --save-exact better-auth@1.7.11 drizzle-orm@0.45.4 @neondatabase/serverless@1.2.0 @electric-sql/pglite@0.5.10 resend@6.34.1
npm i --save-exact -D drizzle-kit@0.31.11
```

Expected: `package.json` muestra las seis versiones sin `^`.

- [ ] **Step 2: Escribir el test que falla**

`tests/helpers/db.ts`:

```ts
import { sql } from 'drizzle-orm'
import { openPglite, type Db } from '@/lib/db/client'
import { user } from '@/lib/db/schema'

export const testDb = (): Promise<Db> => openPglite()

// Borra todo: las tablas que cuelgan de user caen por CASCADE
export async function resetDb(db: Db): Promise<void> {
  await db.execute(sql`TRUNCATE "user", "verification", "guide_invites", "email_log" RESTART IDENTITY CASCADE`)
}

let seq = 0
export async function seedUser(db: Db, over: { email?: string; name?: string; isGuide?: boolean } = {}) {
  seq++
  const [u] = await db
    .insert(user)
    .values({
      id: `u${seq}`,
      name: over.name ?? `Persona ${seq}`,
      email: over.email ?? `p${seq}@test.com`,
      emailVerified: true,
      isGuide: over.isGuide ?? false,
    })
    .returning()
  return u
}
```

`tests/db.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/lib/db/client'
import { groups, learned, memberships, user } from '@/lib/db/schema'
import { resetDb, seedUser, testDb } from './helpers/db'

let db: Db
beforeAll(async () => { db = await testDb() })
beforeEach(() => resetDb(db))

describe('base de datos', () => {
  it('aplica las migraciones y guarda lo aprendido una vez por nodo', async () => {
    const u = await seedUser(db)
    await db.insert(learned).values({ userId: u.id, nodeId: 'llm' })
    await db.insert(learned).values({ userId: u.id, nodeId: 'llm' }).onConflictDoNothing()
    expect(await db.select().from(learned)).toHaveLength(1)
  })

  it('al borrar una persona se borran su avance y sus membresías', async () => {
    const guide = await seedUser(db, { isGuide: true })
    const student = await seedUser(db)
    const [g] = await db.insert(groups).values({ name: 'A', guideId: guide.id }).returning()
    await db.insert(memberships).values({ groupId: g.id, userId: student.id })
    await db.insert(learned).values({ userId: student.id, nodeId: 'llm' })
    await db.delete(user).where(eq(user.id, student.id))
    expect(await db.select().from(memberships)).toHaveLength(0)
    expect(await db.select().from(learned)).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Correr el test y ver que falla**

Run: `npx vitest run tests/db.test.ts`
Expected: FAIL, no se puede resolver `@/lib/db/client`.

- [ ] **Step 4: Escribir el esquema, el cliente y la configuración**

`lib/db/schema.ts`:

```ts
import { boolean, date, integer, pgTable, primaryKey, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID())
const at = (name: string) => timestamp(name, { withTimezone: true })

// Tablas de Better Auth (nombres y columnas que espera su adaptador de Drizzle)
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  isGuide: boolean('is_guide').notNull().default(false),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: at('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: at('access_token_expires_at'),
  refreshTokenExpiresAt: at('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: at('expires_at').notNull(),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
})

// Tablas propias
export const learned = pgTable(
  'learned',
  {
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    nodeId: text('node_id').notNull(),
    learnedAt: at('learned_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.nodeId] })],
)

export const groups = pgTable('groups', {
  id: id(),
  name: text('name').notNull(),
  guideId: text('guide_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: at('created_at').notNull().defaultNow(),
  archivedAt: at('archived_at'),
})

export const memberships = pgTable(
  'memberships',
  {
    groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    joinedAt: at('joined_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
)

export const invites = pgTable('invites', {
  id: id(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['link', 'email'] }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  email: text('email'),
  expiresAt: at('expires_at').notNull(),
  maxUses: integer('max_uses'),
  uses: integer('uses').notNull().default(0),
  revokedAt: at('revoked_at'),
  createdBy: text('created_by').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: at('created_at').notNull().defaultNow(),
})

export const assignments = pgTable(
  'assignments',
  {
    id: id(),
    groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    pathRef: text('path_ref').notNull(),
    dueDate: date('due_date', { mode: 'string' }),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [unique().on(t.groupId, t.pathRef)],
)

export const guideInvites = pgTable('guide_invites', {
  email: text('email').primaryKey(),
  createdAt: at('created_at').notNull().defaultNow(),
  usedAt: at('used_at'),
})

// Para aplicar los límites de envío de correo
export const emailLog = pgTable('email_log', {
  id: serial('id').primaryKey(),
  kind: text('kind', { enum: ['magic-link', 'invite'] }).notNull(),
  email: text('email').notNull(),
  actorId: text('actor_id'),
  sentAt: at('sent_at').notNull().defaultNow(),
})
```

`lib/db/client.ts`:

```ts
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
```

`drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({ dialect: 'postgresql', schema: './lib/db/schema.ts', out: './drizzle' })
```

`next.config.ts`:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // PGlite trae archivos .wasm que no deben empaquetarse
  serverExternalPackages: ['@electric-sql/pglite'],
  // Las páginas dinámicas leen content/ en cada visita: hay que incluirlo en las funciones
  outputFileTracingIncludes: { '/**': ['./content/**/*'] },
}

export default nextConfig
```

Agregar al final de `.gitignore`:

```
# base de datos local de E2E
/.pglite-e2e
```

- [ ] **Step 5: Generar la migración**

Run: `npx drizzle-kit generate`
Expected: `[✓] Your SQL migration file ➜ drizzle/0000_<nombre>.sql` con 11 tablas.

- [ ] **Step 6: Correr el test y ver que pasa**

Run: `npx vitest run tests/db.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 7: Correr la suite y el typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: 238 tests pasan; `tsc` sin errores.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore next.config.ts drizzle.config.ts drizzle lib/db tests/helpers/db.ts tests/db.test.ts
git commit -m "feat: base de datos con Drizzle, Neon en producción y PGlite en pruebas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Reglas de acceso puras

**Files:**
- Create: `lib/access.ts`
- Test: `tests/access.test.ts`

**Interfaces:**
- Produces:
  - `type Actor = { id: string; email: string; name: string; isGuide: boolean; isAdmin: boolean }`
  - `class NotFoundError extends Error`, `class InputError extends Error` (con `code: string`)
  - `normalizeEmail(s: string): string`, `parseAdminEmails(raw: string | undefined): Set<string>`, `isAdmin(email: string, admins: ReadonlySet<string>): boolean`
  - `actorFromSession(u: { id: string; email: string; name: string; isGuide?: unknown }, admins: ReadonlySet<string>): Actor`
  - `canViewGroup(actor: Actor, g: { guideId: string }): boolean`, `canManageGroup(actor: Actor, g: { guideId: string; archivedAt: Date | null }): boolean`
  - `requireGuide(actor: Actor): void`, `requireAdmin(actor: Actor): void` (lanzan `NotFoundError`)
  - `type InviteProblem = 'not-found' | 'revoked' | 'archived' | 'expired' | 'exhausted' | 'wrong-email'`
  - `type InviteState = { kind: 'link' | 'email'; email: string | null; expiresAt: Date; maxUses: number | null; uses: number; revokedAt: Date | null }`
  - `inviteProblem(inv: InviteState | undefined, groupArchived: boolean, email: string | null, now: Date): InviteProblem | null`
  - `mayRegister(i: { isAdmin: boolean; hasGuideInvite: boolean; inviteProblem: InviteProblem | null | undefined }): boolean`
  - `safeNext(next: string | null | undefined, fallback?: string): string`
  - `maskEmail(email: string): string`

- [ ] **Step 1: Escribir el test que falla**

`tests/access.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  actorFromSession, canManageGroup, canViewGroup, inviteProblem, isAdmin, maskEmail, mayRegister,
  normalizeEmail, parseAdminEmails, requireAdmin, requireGuide, safeNext, NotFoundError, type Actor, type InviteState,
} from '@/lib/access'

const actor = (over: Partial<Actor> = {}): Actor => ({ id: 'g1', email: 'g@x.com', name: 'G', isGuide: true, isAdmin: false, ...over })
const now = new Date('2026-10-19T12:00:00Z')
const inv = (over: Partial<InviteState> = {}): InviteState => ({
  kind: 'link', email: null, expiresAt: new Date('2026-11-01T00:00:00Z'), maxUses: null, uses: 0, revokedAt: null, ...over,
})

describe('correos y administradores', () => {
  it('normaliza correos a minúsculas y sin espacios', () => {
    expect(normalizeEmail('  Ana@Gmail.COM ')).toBe('ana@gmail.com')
  })
  it('lee ADMIN_EMAILS separados por coma, sin importar mayúsculas', () => {
    const admins = parseAdminEmails(' Yo@X.com, otra@y.com ,, ')
    expect([...admins]).toEqual(['yo@x.com', 'otra@y.com'])
    expect(isAdmin('YO@x.com', admins)).toBe(true)
    expect(isAdmin('nadie@x.com', admins)).toBe(false)
    expect(parseAdminEmails(undefined).size).toBe(0)
  })
  it('arma el Actor desde la sesión', () => {
    const a = actorFromSession({ id: 'u', email: 'Yo@X.com', name: 'Yo', isGuide: true }, parseAdminEmails('yo@x.com'))
    expect(a).toEqual({ id: 'u', email: 'yo@x.com', name: 'Yo', isGuide: true, isAdmin: true })
    expect(actorFromSession({ id: 'u', email: 'a@b.c', name: 'A' }, new Set()).isGuide).toBe(false)
  })
  it('enmascara un correo', () => {
    expect(maskEmail('ana@gmail.com')).toBe('a***@gmail.com')
  })
})

describe('permisos sobre grupos', () => {
  const own = { guideId: 'g1', archivedAt: null }
  it('el guía dueño puede ver y administrar su grupo', () => {
    expect(canViewGroup(actor(), own)).toBe(true)
    expect(canManageGroup(actor(), own)).toBe(true)
  })
  it('otro guía no puede ver ni administrar', () => {
    expect(canViewGroup(actor({ id: 'g2' }), own)).toBe(false)
    expect(canManageGroup(actor({ id: 'g2' }), own)).toBe(false)
  })
  it('quien dejó de ser guía no ve sus grupos; el administrador tampoco ve grupos ajenos', () => {
    expect(canViewGroup(actor({ isGuide: false }), own)).toBe(false)
    expect(canViewGroup(actor({ id: 'adm', isAdmin: true }), own)).toBe(false)
  })
  it('un grupo archivado se ve pero no se administra', () => {
    const archived = { guideId: 'g1', archivedAt: now }
    expect(canViewGroup(actor(), archived)).toBe(true)
    expect(canManageGroup(actor(), archived)).toBe(false)
  })
  it('requireGuide y requireAdmin lanzan NotFoundError', () => {
    expect(() => requireGuide(actor({ isGuide: false }))).toThrow(NotFoundError)
    expect(() => requireAdmin(actor())).toThrow(NotFoundError)
    expect(() => requireAdmin(actor({ isAdmin: true }))).not.toThrow()
  })
})

describe('estado de una invitación', () => {
  it('una invitación vigente no tiene problemas', () => {
    expect(inviteProblem(inv(), false, null, now)).toBeNull()
  })
  it.each([
    ['not-found', undefined, false],
    ['revoked', inv({ revokedAt: now }), false],
    ['archived', inv(), true],
    ['expired', inv({ expiresAt: new Date('2026-10-19T11:59:59Z') }), false],
    ['exhausted', inv({ maxUses: 3, uses: 3 }), false],
  ] as const)('detecta %s', (problem, i, archived) => {
    expect(inviteProblem(i, archived, null, now)).toBe(problem)
  })
  it('una invitación por correo exige el mismo correo, sin importar mayúsculas', () => {
    const byEmail = inv({ kind: 'email', email: 'ana@gmail.com', maxUses: 1 })
    expect(inviteProblem(byEmail, false, 'Ana@Gmail.com', now)).toBeNull()
    expect(inviteProblem(byEmail, false, 'otra@gmail.com', now)).toBe('wrong-email')
    expect(inviteProblem(byEmail, false, null, now)).toBeNull()
  })
})

describe('registro', () => {
  it('solo con administrador, invitación de guía o invitación válida', () => {
    expect(mayRegister({ isAdmin: true, hasGuideInvite: false, inviteProblem: undefined })).toBe(true)
    expect(mayRegister({ isAdmin: false, hasGuideInvite: true, inviteProblem: undefined })).toBe(true)
    expect(mayRegister({ isAdmin: false, hasGuideInvite: false, inviteProblem: null })).toBe(true)
    expect(mayRegister({ isAdmin: false, hasGuideInvite: false, inviteProblem: 'expired' })).toBe(false)
    expect(mayRegister({ isAdmin: false, hasGuideInvite: false, inviteProblem: undefined })).toBe(false)
  })
})

describe('safeNext', () => {
  it('acepta rutas internas', () => {
    expect(safeNext('/guia/abc?x=1')).toBe('/guia/abc?x=1')
  })
  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '', null, undefined])('rechaza %s', (n) => {
    expect(safeNext(n)).toBe('/cuenta')
  })
})
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run tests/access.test.ts`
Expected: FAIL, no se puede resolver `@/lib/access`.

- [ ] **Step 3: Escribir la implementación**

`lib/access.ts`:

```ts
export type Actor = { id: string; email: string; name: string; isGuide: boolean; isAdmin: boolean }

// 404 a propósito: no revelar si un grupo ajeno existe
export class NotFoundError extends Error {
  constructor() {
    super('No encontrado')
    this.name = 'NotFoundError'
  }
}

export class InputError extends Error {
  constructor(public code: string) {
    super(code)
    this.name = 'InputError'
  }
}

export const normalizeEmail = (s: string): string => s.trim().toLowerCase()

export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set((raw ?? '').split(',').map(normalizeEmail).filter(Boolean))
}

export const isAdmin = (email: string, admins: ReadonlySet<string>): boolean => admins.has(normalizeEmail(email))

export function actorFromSession(
  u: { id: string; email: string; name: string; isGuide?: unknown },
  admins: ReadonlySet<string>,
): Actor {
  const email = normalizeEmail(u.email)
  return { id: u.id, email, name: u.name, isGuide: u.isGuide === true, isAdmin: isAdmin(email, admins) }
}

export const canViewGroup = (actor: Actor, g: { guideId: string }): boolean => actor.isGuide && g.guideId === actor.id

export const canManageGroup = (actor: Actor, g: { guideId: string; archivedAt: Date | null }): boolean =>
  canViewGroup(actor, g) && g.archivedAt === null

export function requireGuide(actor: Actor): void {
  if (!actor.isGuide) throw new NotFoundError()
}

export function requireAdmin(actor: Actor): void {
  if (!actor.isAdmin) throw new NotFoundError()
}

export type InviteProblem = 'not-found' | 'revoked' | 'archived' | 'expired' | 'exhausted' | 'wrong-email'

export type InviteState = {
  kind: 'link' | 'email'
  email: string | null
  expiresAt: Date
  maxUses: number | null
  uses: number
  revokedAt: Date | null
}

// `email` es el de la sesión; null cuando todavía no se sabe (antes de iniciar sesión)
export function inviteProblem(
  inv: InviteState | undefined,
  groupArchived: boolean,
  email: string | null,
  now: Date,
): InviteProblem | null {
  if (!inv) return 'not-found'
  if (inv.revokedAt) return 'revoked'
  if (groupArchived) return 'archived'
  if (inv.expiresAt.getTime() <= now.getTime()) return 'expired'
  if (inv.maxUses !== null && inv.uses >= inv.maxUses) return 'exhausted'
  if (inv.kind === 'email' && email !== null && normalizeEmail(email) !== inv.email) return 'wrong-email'
  return null
}

// inviteProblem: undefined si no hay invitación, null si hay una válida
export const mayRegister = (i: { isAdmin: boolean; hasGuideInvite: boolean; inviteProblem: InviteProblem | null | undefined }): boolean =>
  i.isAdmin || i.hasGuideInvite || i.inviteProblem === null

// Solo rutas internas: evita redirigir a otro sitio después de iniciar sesión
export function safeNext(next: string | null | undefined, fallback = '/cuenta'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run tests/access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/access.ts tests/access.test.ts
git commit -m "feat: reglas de acceso puras para grupos, invitaciones y registro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Referencias a rutas

**Files:**
- Create: `lib/path-refs.ts`
- Test: `tests/path-refs.test.ts`

**Interfaces:**
- Consumes: `Catalog` (`lib/content/types.ts`), `getLearningPath(nodes, targetId): string[]` (`lib/graph.ts`), `stepIds(p)` (`lib/paths.ts`)
- Produces: `type ResolvedPath = { ref: string; title: string; ids: string[]; href: string }`; `resolvePathRef(ref: string, catalog: Catalog): ResolvedPath | null`; `curatedRef(id: string): string`; `generatedRef(nodeId: string): string`

- [ ] **Step 1: Escribir el test que falla**

`tests/path-refs.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getCatalog } from '@/lib/content/load'
import { curatedRef, generatedRef, resolvePathRef } from '@/lib/path-refs'

const catalog = getCatalog()

describe('resolvePathRef', () => {
  it('resuelve una ruta curada', () => {
    const r = resolvePathRef(curatedRef('fundamentos'), catalog)!
    expect(r.title).toBe(catalog.paths.find((p) => p.id === 'fundamentos')!.title)
    expect(r.ids[0]).toBe('machine-learning')
    expect(r.ids.at(-1)).toBe('llm')
    expect(r.href).toBe('/paths/fundamentos')
  })
  it('resuelve una ruta generada que termina en su nodo', () => {
    const r = resolvePathRef(generatedRef('llm'), catalog)!
    expect(r.ids.at(-1)).toBe('llm')
    expect(r.title).toBe(`Hasta ${catalog.byId.get('llm')!.title}`)
    expect(r.href).toBe('/learn/llm')
  })
  it.each(['curated:no-existe', 'generated:no-existe', 'guide:abc', 'fundamentos', ''])('devuelve null para %s', (ref) => {
    expect(resolvePathRef(ref, catalog)).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run tests/path-refs.test.ts`
Expected: FAIL, no se puede resolver `@/lib/path-refs`.

- [ ] **Step 3: Escribir la implementación**

`lib/path-refs.ts`:

```ts
import type { Catalog } from '@/lib/content/types'
import { getLearningPath } from '@/lib/graph'
import { stepIds } from '@/lib/paths'

export type ResolvedPath = { ref: string; title: string; ids: string[]; href: string }

export const curatedRef = (id: string): string => `curated:${id}`
export const generatedRef = (nodeId: string): string => `generated:${nodeId}`

// La spec 2 agregará `guide:<id>`; hasta entonces devuelve null
export function resolvePathRef(ref: string, catalog: Catalog): ResolvedPath | null {
  const sep = ref.indexOf(':')
  if (sep < 0) return null
  const kind = ref.slice(0, sep)
  const id = ref.slice(sep + 1)
  if (kind === 'curated') {
    const p = catalog.paths.find((x) => x.id === id)
    return p ? { ref, title: p.title, ids: stepIds(p), href: `/paths/${p.id}` } : null
  }
  if (kind === 'generated') {
    const node = catalog.byId.get(id)
    return node ? { ref, title: `Hasta ${node.title}`, ids: getLearningPath(catalog.nodes, id), href: `/learn/${id}` } : null
  }
  return null
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run tests/path-refs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/path-refs.ts tests/path-refs.test.ts
git commit -m "feat: referencias a rutas curadas y generadas para asignarlas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Grupos, asignaciones y guías

**Files:**
- Create: `lib/groups.ts`
- Test: `tests/groups.test.ts`

**Interfaces:**
- Consumes: `Db`, tablas de Task 1; `Actor`, `NotFoundError`, `InputError`, `canViewGroup`, `canManageGroup`, `requireGuide`, `requireAdmin`, `normalizeEmail` (Task 2); `resolvePathRef` (Task 3)
- Produces:
  - `type GroupRow = typeof groups.$inferSelect`
  - `createGroup(db: Db, actor: Actor, name: string): Promise<GroupRow>`
  - `listGuideGroups(db: Db, actor: Actor): Promise<(GroupRow & { members: number })[]>`
  - `getGroupForGuide(db: Db, actor: Actor, groupId: string): Promise<GroupRow>` (ver)
  - `loadManagedGroup(db: Db, actor: Actor, groupId: string): Promise<GroupRow>` (administrar)
  - `renameGroup(db, actor, groupId, name): Promise<void>`, `archiveGroup(db, actor, groupId): Promise<void>`
  - `listMembers(db, actor, groupId): Promise<{ userId: string; name: string; email: string; joinedAt: Date }[]>`
  - `removeMember(db, actor, groupId, userId): Promise<void>`, `leaveGroup(db, userId, groupId): Promise<void>`
  - `assignPath(db, actor, groupId, ref: string, dueDate: string | null, catalog: Catalog): Promise<void>`
  - `unassignPath(db, actor, groupId, ref): Promise<void>`
  - `listAssignments(db: Db, groupId: string): Promise<{ pathRef: string; dueDate: string | null }[]>`
  - `grantGuide(db, actor, email): Promise<void>`, `revokeGuide(db, actor, userId): Promise<void>`
  - `listGuides(db, actor): Promise<{ active: { id: string; name: string; email: string }[]; pending: string[] }>`
  - `claimGuideInvite(db: Db, u: { id: string; email: string }): Promise<void>`
  - `hasGuideInvite(db: Db, email: string): Promise<boolean>`

- [ ] **Step 1: Escribir el test que falla**

`tests/groups.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/lib/db/client'
import { groups, memberships, user } from '@/lib/db/schema'
import { getCatalog } from '@/lib/content/load'
import { InputError, NotFoundError, type Actor } from '@/lib/access'
import {
  archiveGroup, assignPath, claimGuideInvite, createGroup, getGroupForGuide, grantGuide, hasGuideInvite, leaveGroup,
  listAssignments, listGuideGroups, listGuides, listMembers, loadManagedGroup, removeMember, renameGroup, revokeGuide, unassignPath,
} from '@/lib/groups'
import { resetDb, seedUser, testDb } from './helpers/db'

const catalog = getCatalog()
let db: Db
beforeAll(async () => { db = await testDb() })
beforeEach(() => resetDb(db))

const asActor = (u: { id: string; email: string; name: string; isGuide: boolean }, isAdmin = false): Actor => ({ ...u, isAdmin })

async function guideWithGroup() {
  const g = asActor(await seedUser(db, { isGuide: true }))
  const group = await createGroup(db, g, 'Taller de IA')
  return { g, group }
}

describe('grupos', () => {
  it('un guía crea un grupo con nombre limpio', async () => {
    const g = asActor(await seedUser(db, { isGuide: true }))
    const group = await createGroup(db, g, '  Taller de IA  ')
    expect(group.name).toBe('Taller de IA')
    expect((await listGuideGroups(db, g)).map((x) => [x.name, x.members])).toEqual([['Taller de IA', 0]])
  })
  it('rechaza nombres vacíos o de más de 80 caracteres', async () => {
    const g = asActor(await seedUser(db, { isGuide: true }))
    await expect(createGroup(db, g, '   ')).rejects.toBeInstanceOf(InputError)
    await expect(createGroup(db, g, 'x'.repeat(81))).rejects.toBeInstanceOf(InputError)
  })
  it('quien no es guía no puede crear grupos', async () => {
    const s = asActor(await seedUser(db))
    await expect(createGroup(db, s, 'A')).rejects.toBeInstanceOf(NotFoundError)
  })
  it('otro guía no puede ver, renombrar, archivar ni listar miembros de un grupo ajeno', async () => {
    const { group } = await guideWithGroup()
    const other = asActor(await seedUser(db, { isGuide: true }))
    await expect(getGroupForGuide(db, other, group.id)).rejects.toBeInstanceOf(NotFoundError)
    await expect(renameGroup(db, other, group.id, 'B')).rejects.toBeInstanceOf(NotFoundError)
    await expect(archiveGroup(db, other, group.id)).rejects.toBeInstanceOf(NotFoundError)
    await expect(listMembers(db, other, group.id)).rejects.toBeInstanceOf(NotFoundError)
    await expect(getGroupForGuide(db, other, 'no-existe')).rejects.toBeInstanceOf(NotFoundError)
  })
  it('un grupo archivado se ve pero ya no se administra', async () => {
    const { g, group } = await guideWithGroup()
    await archiveGroup(db, g, group.id)
    expect((await getGroupForGuide(db, g, group.id)).archivedAt).not.toBeNull()
    await expect(loadManagedGroup(db, g, group.id)).rejects.toBeInstanceOf(NotFoundError)
  })
  it('el guía quita a un alumno y el alumno puede salir solo', async () => {
    const { g, group } = await guideWithGroup()
    const a = await seedUser(db)
    const b = await seedUser(db)
    await db.insert(memberships).values([{ groupId: group.id, userId: a.id }, { groupId: group.id, userId: b.id }])
    await removeMember(db, g, group.id, a.id)
    await leaveGroup(db, b.id, group.id)
    expect(await listMembers(db, g, group.id)).toEqual([])
  })
})

describe('asignaciones', () => {
  it('asigna una ruta curada y una generada, con fecha opcional', async () => {
    const { g, group } = await guideWithGroup()
    await assignPath(db, g, group.id, 'curated:fundamentos', '2026-11-30', catalog)
    await assignPath(db, g, group.id, 'generated:llm', null, catalog)
    expect(await listAssignments(db, group.id)).toEqual([
      { pathRef: 'curated:fundamentos', dueDate: '2026-11-30' },
      { pathRef: 'generated:llm', dueDate: null },
    ])
  })
  it('asignar de nuevo la misma ruta actualiza la fecha', async () => {
    const { g, group } = await guideWithGroup()
    await assignPath(db, g, group.id, 'curated:fundamentos', null, catalog)
    await assignPath(db, g, group.id, 'curated:fundamentos', '2026-12-01', catalog)
    expect(await listAssignments(db, group.id)).toEqual([{ pathRef: 'curated:fundamentos', dueDate: '2026-12-01' }])
  })
  it('rechaza una ruta que no existe o una fecha mal escrita', async () => {
    const { g, group } = await guideWithGroup()
    await expect(assignPath(db, g, group.id, 'curated:no-existe', null, catalog)).rejects.toBeInstanceOf(InputError)
    await expect(assignPath(db, g, group.id, 'curated:fundamentos', '30/11/2026', catalog)).rejects.toBeInstanceOf(InputError)
  })
  it('otro guía no puede asignar ni quitar rutas', async () => {
    const { g, group } = await guideWithGroup()
    await assignPath(db, g, group.id, 'curated:fundamentos', null, catalog)
    const other = asActor(await seedUser(db, { isGuide: true }))
    await expect(assignPath(db, other, group.id, 'generated:llm', null, catalog)).rejects.toBeInstanceOf(NotFoundError)
    await expect(unassignPath(db, other, group.id, 'curated:fundamentos')).rejects.toBeInstanceOf(NotFoundError)
    await unassignPath(db, g, group.id, 'curated:fundamentos')
    expect(await listAssignments(db, group.id)).toEqual([])
  })
})

describe('guías', () => {
  it('el administrador autoriza un correo que todavía no tiene cuenta', async () => {
    const admin = asActor(await seedUser(db), true)
    await grantGuide(db, admin, ' Nueva@Guia.com ')
    expect(await hasGuideInvite(db, 'nueva@guia.com')).toBe(true)
    expect((await listGuides(db, admin)).pending).toEqual(['nueva@guia.com'])
  })
  it('al registrarse con ese correo queda como guía', async () => {
    const admin = asActor(await seedUser(db), true)
    await grantGuide(db, admin, 'nueva@guia.com')
    const u = await seedUser(db, { email: 'nueva@guia.com' })
    await claimGuideInvite(db, u)
    const [row] = await db.select().from(user).where(eq(user.id, u.id))
    expect(row.isGuide).toBe(true)
    expect(await hasGuideInvite(db, 'nueva@guia.com')).toBe(false)
  })
  it('autorizar a alguien que ya tiene cuenta lo vuelve guía al instante', async () => {
    const admin = asActor(await seedUser(db), true)
    const u = await seedUser(db, { email: 'ya@existe.com' })
    await grantGuide(db, admin, 'YA@existe.com')
    expect((await listGuides(db, admin)).active.map((x) => x.id)).toEqual([u.id])
  })
  it('quitar el rol archiva sus grupos y le impide administrarlos', async () => {
    const admin = asActor(await seedUser(db), true)
    const { g, group } = await guideWithGroup()
    await revokeGuide(db, admin, g.id)
    const [row] = await db.select().from(groups).where(eq(groups.id, group.id))
    expect(row.archivedAt).not.toBeNull()
    await expect(createGroup(db, { ...g, isGuide: false }, 'Otro')).rejects.toBeInstanceOf(NotFoundError)
  })
  it('solo el administrador autoriza o quita guías', async () => {
    const g = asActor(await seedUser(db, { isGuide: true }))
    await expect(grantGuide(db, g, 'x@y.com')).rejects.toBeInstanceOf(NotFoundError)
    await expect(revokeGuide(db, g, g.id)).rejects.toBeInstanceOf(NotFoundError)
    await expect(listGuides(db, g)).rejects.toBeInstanceOf(NotFoundError)
  })
})
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run tests/groups.test.ts`
Expected: FAIL, no se puede resolver `@/lib/groups`.

- [ ] **Step 3: Escribir la implementación**

`lib/groups.ts`:

```ts
import { and, asc, count, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '@/lib/db/client'
import { assignments, groups, guideInvites, memberships, user } from '@/lib/db/schema'
import type { Catalog } from '@/lib/content/types'
import {
  canManageGroup, canViewGroup, InputError, normalizeEmail, NotFoundError, requireAdmin, requireGuide, type Actor,
} from '@/lib/access'
import { resolvePathRef } from '@/lib/path-refs'

export type GroupRow = typeof groups.$inferSelect

const nameSchema = z.string().trim().min(1).max(80)
const dueSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()
const emailSchema = z.string().email()

function parseName(name: string): string {
  const r = nameSchema.safeParse(name)
  if (!r.success) throw new InputError('nombre-invalido')
  return r.data
}

async function findGroup(db: Db, groupId: string): Promise<GroupRow | undefined> {
  const [g] = await db.select().from(groups).where(eq(groups.id, groupId))
  return g
}

export async function getGroupForGuide(db: Db, actor: Actor, groupId: string): Promise<GroupRow> {
  const g = await findGroup(db, groupId)
  if (!g || !canViewGroup(actor, g)) throw new NotFoundError()
  return g
}

export async function loadManagedGroup(db: Db, actor: Actor, groupId: string): Promise<GroupRow> {
  const g = await findGroup(db, groupId)
  if (!g || !canManageGroup(actor, g)) throw new NotFoundError()
  return g
}

export async function createGroup(db: Db, actor: Actor, name: string): Promise<GroupRow> {
  requireGuide(actor)
  const [g] = await db.insert(groups).values({ name: parseName(name), guideId: actor.id }).returning()
  return g
}

export async function listGuideGroups(db: Db, actor: Actor): Promise<(GroupRow & { members: number })[]> {
  requireGuide(actor)
  const rows = await db
    .select({ g: groups, members: count(memberships.userId) })
    .from(groups)
    .leftJoin(memberships, eq(memberships.groupId, groups.id))
    .where(eq(groups.guideId, actor.id))
    .groupBy(groups.id)
    .orderBy(asc(groups.createdAt))
  return rows.map((r) => ({ ...r.g, members: Number(r.members) }))
}

export async function renameGroup(db: Db, actor: Actor, groupId: string, name: string): Promise<void> {
  await loadManagedGroup(db, actor, groupId)
  await db.update(groups).set({ name: parseName(name) }).where(eq(groups.id, groupId))
}

export async function archiveGroup(db: Db, actor: Actor, groupId: string): Promise<void> {
  await loadManagedGroup(db, actor, groupId)
  await db.update(groups).set({ archivedAt: new Date() }).where(eq(groups.id, groupId))
}

export async function listMembers(db: Db, actor: Actor, groupId: string) {
  await getGroupForGuide(db, actor, groupId)
  return db
    .select({ userId: user.id, name: user.name, email: user.email, joinedAt: memberships.joinedAt })
    .from(memberships)
    .innerJoin(user, eq(user.id, memberships.userId))
    .where(eq(memberships.groupId, groupId))
    .orderBy(asc(user.name))
}

export async function removeMember(db: Db, actor: Actor, groupId: string, userId: string): Promise<void> {
  await loadManagedGroup(db, actor, groupId)
  await db.delete(memberships).where(and(eq(memberships.groupId, groupId), eq(memberships.userId, userId)))
}

export async function leaveGroup(db: Db, userId: string, groupId: string): Promise<void> {
  await db.delete(memberships).where(and(eq(memberships.groupId, groupId), eq(memberships.userId, userId)))
}

export async function assignPath(
  db: Db, actor: Actor, groupId: string, ref: string, dueDate: string | null, catalog: Catalog,
): Promise<void> {
  await loadManagedGroup(db, actor, groupId)
  if (!resolvePathRef(ref, catalog)) throw new InputError('ruta-inexistente')
  const due = dueSchema.safeParse(dueDate)
  if (!due.success) throw new InputError('fecha-invalida')
  await db
    .insert(assignments)
    .values({ groupId, pathRef: ref, dueDate: due.data })
    .onConflictDoUpdate({ target: [assignments.groupId, assignments.pathRef], set: { dueDate: due.data } })
}

export async function unassignPath(db: Db, actor: Actor, groupId: string, ref: string): Promise<void> {
  await loadManagedGroup(db, actor, groupId)
  await db.delete(assignments).where(and(eq(assignments.groupId, groupId), eq(assignments.pathRef, ref)))
}

export async function listAssignments(db: Db, groupId: string): Promise<{ pathRef: string; dueDate: string | null }[]> {
  return db
    .select({ pathRef: assignments.pathRef, dueDate: assignments.dueDate })
    .from(assignments)
    .where(eq(assignments.groupId, groupId))
    .orderBy(asc(assignments.createdAt), asc(assignments.pathRef))
}

export async function hasGuideInvite(db: Db, email: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(guideInvites)
    .where(and(eq(guideInvites.email, normalizeEmail(email)), isNull(guideInvites.usedAt)))
  return Boolean(row)
}

export async function claimGuideInvite(db: Db, u: { id: string; email: string }): Promise<void> {
  const email = normalizeEmail(u.email)
  if (!(await hasGuideInvite(db, email))) return
  await db.update(user).set({ isGuide: true }).where(eq(user.id, u.id))
  await db.update(guideInvites).set({ usedAt: new Date() }).where(eq(guideInvites.email, email))
}

export async function grantGuide(db: Db, actor: Actor, rawEmail: string): Promise<void> {
  requireAdmin(actor)
  const parsed = emailSchema.safeParse(normalizeEmail(rawEmail))
  if (!parsed.success) throw new InputError('correo-invalido')
  const email = parsed.data
  await db.insert(guideInvites).values({ email }).onConflictDoUpdate({ target: guideInvites.email, set: { usedAt: null } })
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email))
  if (existing) await claimGuideInvite(db, { id: existing.id, email })
}

export async function revokeGuide(db: Db, actor: Actor, userId: string): Promise<void> {
  requireAdmin(actor)
  const [u] = await db.update(user).set({ isGuide: false }).where(eq(user.id, userId)).returning({ email: user.email })
  if (!u) return
  await db.update(groups).set({ archivedAt: new Date() }).where(and(eq(groups.guideId, userId), isNull(groups.archivedAt)))
  await db.delete(guideInvites).where(eq(guideInvites.email, normalizeEmail(u.email)))
}

export async function listGuides(db: Db, actor: Actor) {
  requireAdmin(actor)
  const active = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.isGuide, true))
    .orderBy(asc(user.email))
  const pending = await db
    .select({ email: guideInvites.email })
    .from(guideInvites)
    .where(isNull(guideInvites.usedAt))
    .orderBy(asc(guideInvites.email))
  return { active, pending: pending.map((p) => p.email) }
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run tests/groups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/groups.ts tests/groups.test.ts
git commit -m "feat: grupos, asignación de rutas y administración de guías

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Invitaciones

**Files:**
- Create: `lib/invites.ts`
- Test: `tests/invites.test.ts`

**Interfaces:**
- Consumes: `Db`; `invites`, `groups`, `memberships`, `user`; `Actor`, `InputError`, `NotFoundError`, `inviteProblem`, `normalizeEmail`, `InviteProblem` (Task 2); `loadManagedGroup`, `getGroupForGuide` (Task 4)
- Produces:
  - `INVITE_COOKIE = 'expia_invite'`, `DEFAULT_DAYS = 14`, `MAX_DAYS = 90`, `MAX_EMAILS = 50`
  - `newToken(): string`, `hashToken(token: string): string`
  - `createLinkInvite(db, actor, groupId, opts: { days?: number; maxUses?: number | null }, now?: Date): Promise<{ token: string; id: string }>`
  - `createEmailInvites(db, actor, groupId, rawEmails: string, now?: Date): Promise<{ email: string; token: string }[]>`
  - `listInvites(db, actor, groupId): Promise<InviteListItem[]>` con `InviteListItem = { id: string; kind: 'link' | 'email'; email: string | null; expiresAt: Date; maxUses: number | null; uses: number; revokedAt: Date | null }`
  - `revokeInvite(db, actor, groupId, inviteId): Promise<void>`
  - `findInvite(db, token): Promise<FoundInvite | undefined>` con `FoundInvite = { invite: typeof invites.$inferSelect; group: { id: string; name: string; archivedAt: Date | null }; guideName: string }`
  - `redeemInvite(db, input: { token: string; userId: string; email: string }, now?: Date): Promise<RedeemResult>` con `RedeemResult = { ok: true; groupId: string } | { ok: false; reason: InviteProblem }`

- [ ] **Step 1: Escribir el test que falla**

`tests/invites.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db/client'
import { invites, memberships } from '@/lib/db/schema'
import { InputError, NotFoundError, type Actor } from '@/lib/access'
import { archiveGroup, createGroup } from '@/lib/groups'
import {
  createEmailInvites, createLinkInvite, findInvite, hashToken, listInvites, newToken, redeemInvite, revokeInvite,
} from '@/lib/invites'
import { resetDb, seedUser, testDb } from './helpers/db'

let db: Db
beforeAll(async () => { db = await testDb() })
beforeEach(() => resetDb(db))

const now = new Date('2026-10-19T12:00:00Z')
const day = 24 * 60 * 60 * 1000
const asActor = (u: { id: string; email: string; name: string; isGuide: boolean }): Actor => ({ ...u, isAdmin: false })

async function setup() {
  const g = asActor(await seedUser(db, { isGuide: true, name: 'Profe' }))
  const group = await createGroup(db, g, 'Taller')
  return { g, group }
}

describe('tokens', () => {
  it('son de 32 bytes en base64url y solo se guarda su hash', async () => {
    const t = newToken()
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/)
    const { g, group } = await setup()
    const { token } = await createLinkInvite(db, g, group.id, {}, now)
    const rows = await db.select().from(invites)
    expect(rows[0].tokenHash).toBe(hashToken(token))
    expect(JSON.stringify(rows)).not.toContain(token)
  })
})

describe('crear invitaciones', () => {
  it('un enlace vence por defecto a los 14 días', async () => {
    const { g, group } = await setup()
    await createLinkInvite(db, g, group.id, {}, now)
    const [row] = await listInvites(db, g, group.id)
    expect(row.expiresAt.getTime() - now.getTime()).toBe(14 * day)
    expect(row.maxUses).toBeNull()
  })
  it('acepta de 1 a 90 días y un máximo de usos positivo', async () => {
    const { g, group } = await setup()
    await expect(createLinkInvite(db, g, group.id, { days: 0 }, now)).rejects.toBeInstanceOf(InputError)
    await expect(createLinkInvite(db, g, group.id, { days: 91 }, now)).rejects.toBeInstanceOf(InputError)
    await expect(createLinkInvite(db, g, group.id, { maxUses: 0 }, now)).rejects.toBeInstanceOf(InputError)
    await createLinkInvite(db, g, group.id, { days: 90, maxUses: 30 }, now)
  })
  it('por correo: una invitación de un solo uso por correo, sin repetidos y en minúsculas', async () => {
    const { g, group } = await setup()
    const out = await createEmailInvites(db, g, group.id, 'Ana@Gmail.com, beto@x.com\nana@gmail.com ; ', now)
    expect(out.map((o) => o.email)).toEqual(['ana@gmail.com', 'beto@x.com'])
    const rows = await listInvites(db, g, group.id)
    expect(rows.every((r) => r.kind === 'email' && r.maxUses === 1)).toBe(true)
  })
  it('rechaza correos mal escritos o más de 50', async () => {
    const { g, group } = await setup()
    await expect(createEmailInvites(db, g, group.id, 'ana@gmail.com, no-es-correo', now)).rejects.toBeInstanceOf(InputError)
    const many = Array.from({ length: 51 }, (_, i) => `a${i}@x.com`).join(',')
    await expect(createEmailInvites(db, g, group.id, many, now)).rejects.toBeInstanceOf(InputError)
  })
  it('otro guía no puede crear, listar ni revocar invitaciones del grupo', async () => {
    const { g, group } = await setup()
    const { id } = await createLinkInvite(db, g, group.id, {}, now)
    const other = asActor(await seedUser(db, { isGuide: true }))
    await expect(createLinkInvite(db, other, group.id, {}, now)).rejects.toBeInstanceOf(NotFoundError)
    await expect(listInvites(db, other, group.id)).rejects.toBeInstanceOf(NotFoundError)
    await expect(revokeInvite(db, other, group.id, id)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('canjear', () => {
  it('un enlace válido suma al alumno y cuenta un uso', async () => {
    const { g, group } = await setup()
    const { token } = await createLinkInvite(db, g, group.id, { maxUses: 2 }, now)
    const s = await seedUser(db)
    expect(await redeemInvite(db, { token, userId: s.id, email: s.email }, now)).toEqual({ ok: true, groupId: group.id })
    expect(await db.select().from(memberships)).toHaveLength(1)
    expect((await listInvites(db, g, group.id))[0].uses).toBe(1)
  })
  it('quien ya era miembro no gasta otro uso', async () => {
    const { g, group } = await setup()
    const { token } = await createLinkInvite(db, g, group.id, { maxUses: 1 }, now)
    const s = await seedUser(db)
    await redeemInvite(db, { token, userId: s.id, email: s.email }, now)
    expect(await redeemInvite(db, { token, userId: s.id, email: s.email }, now)).toEqual({ ok: true, groupId: group.id })
    expect((await listInvites(db, g, group.id))[0].uses).toBe(1)
  })
  it('rechaza un enlace vencido, revocado, agotado, de un grupo archivado o desconocido', async () => {
    const { g, group } = await setup()
    const s = await seedUser(db)
    const later = new Date(now.getTime() + 15 * day)
    const expired = await createLinkInvite(db, g, group.id, {}, now)
    expect(await redeemInvite(db, { token: expired.token, userId: s.id, email: s.email }, later)).toEqual({ ok: false, reason: 'expired' })

    const revoked = await createLinkInvite(db, g, group.id, {}, now)
    await revokeInvite(db, g, group.id, revoked.id)
    expect(await redeemInvite(db, { token: revoked.token, userId: s.id, email: s.email }, now)).toEqual({ ok: false, reason: 'revoked' })

    const one = await createLinkInvite(db, g, group.id, { maxUses: 1 }, now)
    await redeemInvite(db, { token: one.token, userId: (await seedUser(db)).id, email: 'x@x.com' }, now)
    expect(await redeemInvite(db, { token: one.token, userId: s.id, email: s.email }, now)).toEqual({ ok: false, reason: 'exhausted' })

    expect(await redeemInvite(db, { token: newToken(), userId: s.id, email: s.email }, now)).toEqual({ ok: false, reason: 'not-found' })

    const live = await createLinkInvite(db, g, group.id, {}, now)
    await archiveGroup(db, g, group.id)
    expect(await redeemInvite(db, { token: live.token, userId: s.id, email: s.email }, now)).toEqual({ ok: false, reason: 'archived' })
  })
  it('una invitación por correo solo sirve con ese correo', async () => {
    const { g, group } = await setup()
    const [inv] = await createEmailInvites(db, g, group.id, 'ana@gmail.com', now)
    const other = await seedUser(db, { email: 'otra@gmail.com' })
    expect(await redeemInvite(db, { token: inv.token, userId: other.id, email: other.email }, now)).toEqual({ ok: false, reason: 'wrong-email' })
    const ana = await seedUser(db, { email: 'ana@gmail.com' })
    expect(await redeemInvite(db, { token: inv.token, userId: ana.id, email: 'Ana@Gmail.com' }, now)).toEqual({ ok: true, groupId: group.id })
  })
  it('de dos canjes en paralelo por el último uso, solo uno entra', async () => {
    const { g, group } = await setup()
    const { token } = await createLinkInvite(db, g, group.id, { maxUses: 1 }, now)
    const a = await seedUser(db)
    const b = await seedUser(db)
    const results = await Promise.all([
      redeemInvite(db, { token, userId: a.id, email: a.email }, now),
      redeemInvite(db, { token, userId: b.id, email: b.email }, now),
    ])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(await db.select().from(memberships)).toHaveLength(1)
  })
  it('findInvite devuelve el grupo y el nombre del guía', async () => {
    const { g, group } = await setup()
    const { token } = await createLinkInvite(db, g, group.id, {}, now)
    const found = await findInvite(db, token)
    expect(found?.group.name).toBe('Taller')
    expect(found?.guideName).toBe('Profe')
    expect(await findInvite(db, 'inventado')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run tests/invites.test.ts`
Expected: FAIL, no se puede resolver `@/lib/invites`.

- [ ] **Step 3: Escribir la implementación**

`lib/invites.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '@/lib/db/client'
import { groups, invites, memberships, user } from '@/lib/db/schema'
import { InputError, inviteProblem, normalizeEmail, type Actor, type InviteProblem } from '@/lib/access'
import { getGroupForGuide, loadManagedGroup } from '@/lib/groups'

export const INVITE_COOKIE = 'expia_invite'
export const DEFAULT_DAYS = 14
export const MAX_DAYS = 90
export const MAX_EMAILS = 50
const DAY = 24 * 60 * 60 * 1000

export const newToken = (): string => randomBytes(32).toString('base64url')
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')

const daysSchema = z.number().int().min(1).max(MAX_DAYS)
const maxUsesSchema = z.number().int().min(1).nullable()
const emailSchema = z.string().email()

export async function createLinkInvite(
  db: Db, actor: Actor, groupId: string, opts: { days?: number; maxUses?: number | null }, now = new Date(),
): Promise<{ token: string; id: string }> {
  await loadManagedGroup(db, actor, groupId)
  const days = daysSchema.safeParse(opts.days ?? DEFAULT_DAYS)
  const maxUses = maxUsesSchema.safeParse(opts.maxUses ?? null)
  if (!days.success) throw new InputError('dias-invalidos')
  if (!maxUses.success) throw new InputError('usos-invalidos')
  const token = newToken()
  const [row] = await db
    .insert(invites)
    .values({
      groupId, kind: 'link', tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + days.data * DAY),
      maxUses: maxUses.data, createdBy: actor.id,
    })
    .returning({ id: invites.id })
  return { token, id: row.id }
}

// Acepta correos separados por comas, punto y coma, espacios o saltos de línea
export async function createEmailInvites(
  db: Db, actor: Actor, groupId: string, rawEmails: string, now = new Date(),
): Promise<{ email: string; token: string }[]> {
  await loadManagedGroup(db, actor, groupId)
  const emails = [...new Set(rawEmails.split(/[\s,;]+/).map(normalizeEmail).filter(Boolean))]
  if (emails.length === 0 || emails.length > MAX_EMAILS) throw new InputError('cantidad-de-correos')
  if (emails.some((e) => !emailSchema.safeParse(e).success)) throw new InputError('correo-invalido')
  const out = emails.map((email) => ({ email, token: newToken() }))
  await db.insert(invites).values(
    out.map(({ email, token }) => ({
      groupId, kind: 'email' as const, tokenHash: hashToken(token), email,
      expiresAt: new Date(now.getTime() + DEFAULT_DAYS * DAY), maxUses: 1, createdBy: actor.id,
    })),
  )
  return out
}

export type InviteListItem = {
  id: string; kind: 'link' | 'email'; email: string | null; expiresAt: Date; maxUses: number | null; uses: number; revokedAt: Date | null
}

export async function listInvites(db: Db, actor: Actor, groupId: string): Promise<InviteListItem[]> {
  await getGroupForGuide(db, actor, groupId)
  return db
    .select({
      id: invites.id, kind: invites.kind, email: invites.email, expiresAt: invites.expiresAt,
      maxUses: invites.maxUses, uses: invites.uses, revokedAt: invites.revokedAt,
    })
    .from(invites)
    .where(eq(invites.groupId, groupId))
    .orderBy(desc(invites.createdAt), invites.email)
}

export async function revokeInvite(db: Db, actor: Actor, groupId: string, inviteId: string): Promise<void> {
  await loadManagedGroup(db, actor, groupId)
  await db.update(invites).set({ revokedAt: new Date() }).where(and(eq(invites.id, inviteId), eq(invites.groupId, groupId)))
}

export type FoundInvite = {
  invite: typeof invites.$inferSelect
  group: { id: string; name: string; archivedAt: Date | null }
  guideName: string
}

export async function findInvite(db: Db, token: string): Promise<FoundInvite | undefined> {
  const [row] = await db
    .select({ invite: invites, group: { id: groups.id, name: groups.name, archivedAt: groups.archivedAt }, guideName: user.name })
    .from(invites)
    .innerJoin(groups, eq(groups.id, invites.groupId))
    .innerJoin(user, eq(user.id, groups.guideId))
    .where(eq(invites.tokenHash, hashToken(token)))
  return row
}

export type RedeemResult = { ok: true; groupId: string } | { ok: false; reason: InviteProblem }

export async function redeemInvite(
  db: Db, input: { token: string; userId: string; email: string }, now = new Date(),
): Promise<RedeemResult> {
  const found = await findInvite(db, input.token)
  const problem = inviteProblem(found?.invite, Boolean(found?.group.archivedAt), input.email, now)
  if (!found || problem) return { ok: false, reason: problem ?? 'not-found' }
  const { invite } = found

  return db.transaction(async (tx) => {
    const [member] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.groupId, invite.groupId), eq(memberships.userId, input.userId)))
    if (member) return { ok: true as const, groupId: invite.groupId }

    // Validar y descontar en una sola sentencia: dos canjes simultáneos no pasan los dos
    const taken = await tx
      .update(invites)
      .set({ uses: sql`${invites.uses} + 1` })
      .where(
        and(
          eq(invites.id, invite.id), isNull(invites.revokedAt), gt(invites.expiresAt, now),
          or(isNull(invites.maxUses), lt(invites.uses, invites.maxUses)),
        ),
      )
      .returning({ id: invites.id })
    if (taken.length === 0) return { ok: false as const, reason: 'exhausted' as const }

    await tx.insert(memberships).values({ groupId: invite.groupId, userId: input.userId }).onConflictDoNothing()
    return { ok: true as const, groupId: invite.groupId }
  })
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run tests/invites.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/invites.ts tests/invites.test.ts
git commit -m "feat: invitaciones por enlace y por correo con canje atómico

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Avance en el servidor

**Files:**
- Create: `lib/progress.ts`
- Test: `tests/progress.test.ts`

**Interfaces:**
- Consumes: `Db`; `learned`, `memberships`, `groups`, `user`; `Actor` (Task 2); `getGroupForGuide`, `listAssignments` (Task 4); `resolvePathRef` (Task 3); `pathProgress(ids, learned): { done; total }` (`lib/paths.ts`)
- Produces:
  - `MAX_IMPORT = 500`
  - `getLearned(db, userId): Promise<string[]>`
  - `setLearned(db, userId, nodeId, on: boolean): Promise<void>`
  - `importLearned(db, userId, ids: readonly string[]): Promise<string[]>` (devuelve la unión)
  - `type ProgressColumn = { ref: string; title: string | null; total: number; dueDate: string | null }`
  - `type ProgressTable = { columns: ProgressColumn[]; rows: { userId: string; name: string; email: string; cells: ({ done: number; total: number } | null)[] }[] }`
  - `groupProgress(db, actor, groupId, catalog): Promise<ProgressTable>`
  - `type StudentGroup = { groupId: string; name: string; guideName: string; paths: { ref: string; title: string | null; href: string | null; dueDate: string | null; done: number; total: number }[] }`
  - `studentGroups(db, userId, catalog): Promise<StudentGroup[]>`

- [ ] **Step 1: Escribir el test que falla**

`tests/progress.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db/client'
import { assignments, memberships } from '@/lib/db/schema'
import { getCatalog } from '@/lib/content/load'
import { NotFoundError, type Actor } from '@/lib/access'
import { archiveGroup, assignPath, createGroup } from '@/lib/groups'
import { getLearned, groupProgress, importLearned, setLearned, studentGroups } from '@/lib/progress'
import { resetDb, seedUser, testDb } from './helpers/db'

const catalog = getCatalog()
let db: Db
beforeAll(async () => { db = await testDb() })
beforeEach(() => resetDb(db))

const asActor = (u: { id: string; email: string; name: string; isGuide: boolean }): Actor => ({ ...u, isAdmin: false })

describe('lo aprendido', () => {
  it('marca, desmarca y no duplica', async () => {
    const u = await seedUser(db)
    await setLearned(db, u.id, 'llm', true)
    await setLearned(db, u.id, 'llm', true)
    await setLearned(db, u.id, 'transformer', true)
    await setLearned(db, u.id, 'transformer', false)
    expect(await getLearned(db, u.id)).toEqual(['llm'])
  })
  it('importar une con lo que ya hay y no borra nada', async () => {
    const u = await seedUser(db)
    await setLearned(db, u.id, 'llm', true)
    expect((await importLearned(db, u.id, ['transformer', 'llm'])).sort()).toEqual(['llm', 'transformer'])
  })
  it('conserva un nodo que ya no está en el catálogo', async () => {
    const u = await seedUser(db)
    await setLearned(db, u.id, 'nodo-retirado', true)
    expect(await getLearned(db, u.id)).toEqual(['nodo-retirado'])
  })
})

describe('tabla del guía', () => {
  async function setup() {
    const g = asActor(await seedUser(db, { isGuide: true, name: 'Profe' }))
    const group = await createGroup(db, g, 'Taller')
    const ana = await seedUser(db, { name: 'Ana' })
    const beto = await seedUser(db, { name: 'Beto' })
    await db.insert(memberships).values([{ groupId: group.id, userId: ana.id }, { groupId: group.id, userId: beto.id }])
    await assignPath(db, g, group.id, 'curated:fundamentos', '2026-11-30', catalog)
    return { g, group, ana, beto }
  }

  it('muestra N de M por alumno y por ruta asignada', async () => {
    const { g, group, ana } = await setup()
    await setLearned(db, ana.id, 'machine-learning', true)
    await setLearned(db, ana.id, 'neural-network', true)
    const t = await groupProgress(db, g, group.id, catalog)
    const title = catalog.paths.find((p) => p.id === 'fundamentos')!.title
    expect(t.columns).toEqual([{ ref: 'curated:fundamentos', title, total: 10, dueDate: '2026-11-30' }])
    expect(t.rows.map((r) => [r.name, r.cells])).toEqual([
      ['Ana', [{ done: 2, total: 10 }]],
      ['Beto', [{ done: 0, total: 10 }]],
    ])
  })
  it('lo marcado fuera de las rutas asignadas no se cuenta', async () => {
    const { g, group, ana } = await setup()
    await setLearned(db, ana.id, 'mcp', true)
    const t = await groupProgress(db, g, group.id, catalog)
    expect(t.rows[0].cells[0]).toEqual({ done: 0, total: 10 })
  })
  it('una ruta que desaparece del catálogo queda como columna no disponible', async () => {
    const { g, group } = await setup()
    await db.insert(assignments).values({ groupId: group.id, pathRef: 'curated:retirada' })
    const t = await groupProgress(db, g, group.id, catalog)
    expect(t.columns[1]).toEqual({ ref: 'curated:retirada', title: null, total: 0, dueDate: null })
    expect(t.rows[0].cells[1]).toBeNull()
  })
  it('otro guía no ve la tabla', async () => {
    const { group } = await setup()
    const other = asActor(await seedUser(db, { isGuide: true }))
    await expect(groupProgress(db, other, group.id, catalog)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('grupos del alumno', () => {
  it('lista sus grupos activos con el avance en cada ruta asignada', async () => {
    const g = asActor(await seedUser(db, { isGuide: true, name: 'Profe' }))
    const active = await createGroup(db, g, 'Activo')
    const old = await createGroup(db, g, 'Viejo')
    const s = await seedUser(db)
    await db.insert(memberships).values([{ groupId: active.id, userId: s.id }, { groupId: old.id, userId: s.id }])
    await assignPath(db, g, active.id, 'generated:llm', null, catalog)
    await archiveGroup(db, g, old.id)
    await setLearned(db, s.id, 'llm', true)
    const out = await studentGroups(db, s.id, catalog)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ name: 'Activo', guideName: 'Profe' })
    expect(out[0].paths[0]).toMatchObject({ ref: 'generated:llm', href: '/learn/llm', done: 1 })
  })
})
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run tests/progress.test.ts`
Expected: FAIL, no se puede resolver `@/lib/progress`.

- [ ] **Step 3: Escribir la implementación**

`lib/progress.ts`:

```ts
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '@/lib/db/client'
import { groups, learned, memberships, user } from '@/lib/db/schema'
import type { Catalog } from '@/lib/content/types'
import type { Actor } from '@/lib/access'
import { getGroupForGuide, listAssignments } from '@/lib/groups'
import { resolvePathRef } from '@/lib/path-refs'
import { pathProgress } from '@/lib/paths'

export const MAX_IMPORT = 500

export async function getLearned(db: Db, userId: string): Promise<string[]> {
  const rows = await db.select({ nodeId: learned.nodeId }).from(learned).where(eq(learned.userId, userId)).orderBy(asc(learned.learnedAt))
  return rows.map((r) => r.nodeId)
}

export async function setLearned(db: Db, userId: string, nodeId: string, on: boolean): Promise<void> {
  if (on) await db.insert(learned).values({ userId, nodeId }).onConflictDoNothing()
  else await db.delete(learned).where(and(eq(learned.userId, userId), eq(learned.nodeId, nodeId)))
}

export async function importLearned(db: Db, userId: string, ids: readonly string[]): Promise<string[]> {
  const unique = [...new Set(ids)]
  if (unique.length) await db.insert(learned).values(unique.map((nodeId) => ({ userId, nodeId }))).onConflictDoNothing()
  return getLearned(db, userId)
}

export type ProgressColumn = { ref: string; title: string | null; total: number; dueDate: string | null }
export type ProgressTable = {
  columns: ProgressColumn[]
  rows: { userId: string; name: string; email: string; cells: ({ done: number; total: number } | null)[] }[]
}

// Solo se leen los nodos de las rutas asignadas: el guía nunca recibe el resto de lo que marcó el alumno
async function learnedByUser(db: Db, userIds: string[], nodeIds: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map(userIds.map((id) => [id, new Set<string>()]))
  if (!userIds.length || !nodeIds.length) return out
  const rows = await db
    .select({ userId: learned.userId, nodeId: learned.nodeId })
    .from(learned)
    .where(and(inArray(learned.userId, userIds), inArray(learned.nodeId, nodeIds)))
  for (const r of rows) out.get(r.userId)!.add(r.nodeId)
  return out
}

export async function groupProgress(db: Db, actor: Actor, groupId: string, catalog: Catalog): Promise<ProgressTable> {
  await getGroupForGuide(db, actor, groupId)
  const assigned = await listAssignments(db, groupId)
  const resolved = assigned.map((a) => ({ a, path: resolvePathRef(a.pathRef, catalog) }))
  const members = await db
    .select({ userId: user.id, name: user.name, email: user.email })
    .from(memberships)
    .innerJoin(user, eq(user.id, memberships.userId))
    .where(eq(memberships.groupId, groupId))
    .orderBy(asc(user.name))
  const nodeIds = [...new Set(resolved.flatMap((r) => r.path?.ids ?? []))]
  const byUser = await learnedByUser(db, members.map((m) => m.userId), nodeIds)
  return {
    columns: resolved.map(({ a, path }) => ({ ref: a.pathRef, title: path?.title ?? null, total: path?.ids.length ?? 0, dueDate: a.dueDate })),
    rows: members.map((m) => ({
      ...m,
      cells: resolved.map(({ path }) => (path ? pathProgress(path.ids, byUser.get(m.userId)!) : null)),
    })),
  }
}

export type StudentGroup = {
  groupId: string
  name: string
  guideName: string
  paths: { ref: string; title: string | null; href: string | null; dueDate: string | null; done: number; total: number }[]
}

export async function studentGroups(db: Db, userId: string, catalog: Catalog): Promise<StudentGroup[]> {
  const rows = await db
    .select({ groupId: groups.id, name: groups.name, guideName: user.name })
    .from(memberships)
    .innerJoin(groups, eq(groups.id, memberships.groupId))
    .innerJoin(user, eq(user.id, groups.guideId))
    .where(and(eq(memberships.userId, userId), isNull(groups.archivedAt)))
    .orderBy(asc(groups.name))
  const mine = new Set(await getLearned(db, userId))
  const out: StudentGroup[] = []
  for (const r of rows) {
    const assigned = await listAssignments(db, r.groupId)
    out.push({
      ...r,
      paths: assigned.map((a) => {
        const path = resolvePathRef(a.pathRef, catalog)
        const p = path ? pathProgress(path.ids, mine) : { done: 0, total: 0 }
        return { ref: a.pathRef, title: path?.title ?? null, href: path?.href ?? null, dueDate: a.dueDate, ...p }
      }),
    })
  }
  return out
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run tests/progress.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/progress.ts tests/progress.test.ts
git commit -m "feat: avance en el servidor, importación y tabla de avance del guía

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Correo, registro e inicio de sesión

**Files:**
- Create: `lib/email.ts`, `lib/registration.ts`, `lib/auth-config.ts`, `lib/auth.ts`, `lib/session.ts`, `app/api/auth/[...all]/route.ts`
- Test: `tests/email.test.ts`, `tests/auth.test.ts`

**Interfaces:**
- Consumes: `Db`, `emailLog`, `user`; `isAdmin`, `mayRegister`, `inviteProblem`, `normalizeEmail`, `actorFromSession`, `parseAdminEmails`, `Actor` (Task 2); `hasGuideInvite`, `claimGuideInvite` (Task 4); `findInvite`, `INVITE_COOKIE` (Task 5)
- Produces:
  - `lib/email.ts`: `type Mail = { to: string; subject: string; text: string; html: string }`, `type Mailer = (m: Mail) => Promise<void>`, `LIMITS = { magicLinkPerHour: 5, invitesPerDay: 100 }`, `sendLimited(db, mailer, who: { kind: 'magic-link' | 'invite'; to: string; actorId?: string }, mail: Omit<Mail, 'to'>, now?: Date): Promise<boolean>`, `magicLinkMail(url): Omit<Mail, 'to'>`, `inviteMail(i: { groupName: string; guideName: string; url: string }): Omit<Mail, 'to'>`, `getMailer(): Mailer`
  - `lib/registration.ts`: `readCookie(header: string | null, name: string): string | null`, `registrationAllowed(db, admins: ReadonlySet<string>, email: string, cookieHeader: string | null, now?: Date): Promise<boolean>`
  - `lib/auth-config.ts`: `type AuthDeps = { db: Db; mailer: Mailer; admins: ReadonlySet<string>; baseURL?: string; secret?: string; google?: { clientId: string; clientSecret: string } }`, `createAuth(deps: AuthDeps, extraPlugins?: BetterAuthPlugin[])`, `type Auth = ReturnType<typeof createAuth>`
  - `lib/auth.ts`: `getAuth(): Promise<Auth>`
  - `lib/session.ts`: `getActor(h?: Headers): Promise<Actor | null>`

- [ ] **Step 1: Escribir los tests que fallan**

`tests/email.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db/client'
import { LIMITS, magicLinkMail, sendLimited, type Mail } from '@/lib/email'
import { resetDb, testDb } from './helpers/db'

let db: Db
let sent: Mail[]
const mailer = async (m: Mail) => { sent.push(m) }
beforeAll(async () => { db = await testDb() })
beforeEach(async () => { await resetDb(db); sent = [] })

const now = new Date('2026-10-19T12:00:00Z')

describe('límites de envío', () => {
  it('envía como máximo 5 enlaces mágicos por correo por hora', async () => {
    for (let i = 0; i < 6; i++) await sendLimited(db, mailer, { kind: 'magic-link', to: 'Ana@x.com' }, magicLinkMail('http://u'), now)
    expect(sent).toHaveLength(LIMITS.magicLinkPerHour)
    const later = new Date(now.getTime() + 61 * 60 * 1000)
    expect(await sendLimited(db, mailer, { kind: 'magic-link', to: 'ana@x.com' }, magicLinkMail('http://u'), later)).toBe(true)
  })
  it('envía como máximo 100 invitaciones por guía por día', async () => {
    for (let i = 0; i < 101; i++) await sendLimited(db, mailer, { kind: 'invite', to: `a${i}@x.com`, actorId: 'g1' }, magicLinkMail('http://u'), now)
    expect(sent).toHaveLength(LIMITS.invitesPerDay)
    expect(await sendLimited(db, mailer, { kind: 'invite', to: 'z@x.com', actorId: 'g2' }, magicLinkMail('http://u'), now)).toBe(true)
  })
})
```

`tests/auth.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/lib/db/client'
import { user } from '@/lib/db/schema'
import type { Mail } from '@/lib/email'
import { createAuth } from '@/lib/auth-config'
import { parseAdminEmails, type Actor } from '@/lib/access'
import { createGroup, grantGuide } from '@/lib/groups'
import { createLinkInvite, INVITE_COOKIE } from '@/lib/invites'
import { readCookie } from '@/lib/registration'
import { resetDb, seedUser, testDb } from './helpers/db'

let db: Db
let sent: Mail[]
let auth: ReturnType<typeof createAuth>
const BASE = 'http://localhost:3000'

beforeAll(async () => {
  db = await testDb()
  auth = createAuth({
    db, mailer: async (m) => { sent.push(m) }, admins: parseAdminEmails('admin@x.com'), baseURL: BASE, secret: 'a'.repeat(40),
  })
})
beforeEach(async () => { await resetDb(db); sent = [] })

// Pide el enlace mágico y lo abre, como haría el navegador
async function signIn(email: string, cookie = '') {
  await auth.handler(new Request(`${BASE}/api/auth/sign-in/magic-link`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie, origin: BASE }, body: JSON.stringify({ email, callbackURL: '/cuenta' }),
  }))
  const mail = sent.at(-1)
  if (!mail) return { mailed: false, location: null as string | null }
  const url = mail.text.match(/https?:\/\/\S+/)![0]
  const res = await auth.handler(new Request(url, { headers: { cookie } }))
  return { mailed: true, location: res.headers.get('location') }
}

const users = () => db.select().from(user)

describe('registro solo por invitación', () => {
  it('a un correo sin invitación no se le envía el enlace ni se crea la cuenta', async () => {
    expect(await signIn('extrano@x.com')).toEqual({ mailed: false, location: null })
    expect(await users()).toHaveLength(0)
  })
  it('un administrador entra sin invitación, aunque escriba con mayúsculas', async () => {
    const r = await signIn('Admin@X.com')
    expect(r.location).toBe('/cuenta')
    expect((await users()).map((u) => u.email)).toEqual(['admin@x.com'])
  })
  it('un correo autorizado como guía entra y queda como guía', async () => {
    const admin: Actor = { ...(await seedUser(db, { email: 'admin@x.com' })), isAdmin: true }
    await grantGuide(db, admin, 'Guia@X.com')
    const r = await signIn('guia@x.com')
    expect(r.location).toBe('/cuenta')
    const [g] = await db.select().from(user).where(eq(user.email, 'guia@x.com'))
    expect(g.isGuide).toBe(true)
  })
  it('con la cookie de una invitación válida se crea la cuenta', async () => {
    const g: Actor = { ...(await seedUser(db, { isGuide: true })), isAdmin: false }
    const group = await createGroup(db, g, 'Taller')
    const { token } = await createLinkInvite(db, g, group.id, {})
    const r = await signIn('alumno@x.com', `${INVITE_COOKIE}=${token}`)
    expect(r.location).toBe('/cuenta')
    expect((await users()).some((u) => u.email === 'alumno@x.com')).toBe(true)
  })
  it('con la cookie de una invitación inválida no se envía nada', async () => {
    expect(await signIn('alumno@x.com', `${INVITE_COOKIE}=inventado`)).toEqual({ mailed: false, location: null })
  })
  it('quien ya tiene cuenta siempre puede pedir su enlace', async () => {
    await seedUser(db, { email: 'ya@x.com' })
    expect((await signIn('ya@x.com')).location).toBe('/cuenta')
  })
})

describe('readCookie', () => {
  it('lee una cookie por nombre', () => {
    expect(readCookie('a=1; expia_invite=abc; b=2', 'expia_invite')).toBe('abc')
    expect(readCookie(null, 'expia_invite')).toBeNull()
    expect(readCookie('a=1', 'expia_invite')).toBeNull()
  })
})
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `npx vitest run tests/email.test.ts tests/auth.test.ts`
Expected: FAIL, no se pueden resolver `@/lib/email` y `@/lib/auth-config`.

- [ ] **Step 3: Escribir `lib/email.ts`**

```ts
import { and, count, eq, gt } from 'drizzle-orm'
import { Resend } from 'resend'
import type { Db } from '@/lib/db/client'
import { emailLog } from '@/lib/db/schema'
import { normalizeEmail } from '@/lib/access'

export type Mail = { to: string; subject: string; text: string; html: string }
export type Mailer = (m: Mail) => Promise<void>

export const LIMITS = { magicLinkPerHour: 5, invitesPerDay: 100 }
const HOUR = 60 * 60 * 1000

// Devuelve false (sin enviar) si se pasó el límite. Solo cuenta lo que realmente se envió
export async function sendLimited(
  db: Db, mailer: Mailer, who: { kind: 'magic-link' | 'invite'; to: string; actorId?: string }, mail: Omit<Mail, 'to'>, now = new Date(),
): Promise<boolean> {
  const to = normalizeEmail(who.to)
  const [{ n }] =
    who.kind === 'magic-link'
      ? await db.select({ n: count() }).from(emailLog).where(and(eq(emailLog.kind, 'magic-link'), eq(emailLog.email, to), gt(emailLog.sentAt, new Date(now.getTime() - HOUR))))
      : await db.select({ n: count() }).from(emailLog).where(and(eq(emailLog.kind, 'invite'), eq(emailLog.actorId, who.actorId ?? ''), gt(emailLog.sentAt, new Date(now.getTime() - 24 * HOUR))))
  const limit = who.kind === 'magic-link' ? LIMITS.magicLinkPerHour : LIMITS.invitesPerDay
  if (Number(n) >= limit) return false
  await mailer({ ...mail, to })
  await db.insert(emailLog).values({ kind: who.kind, email: to, actorId: who.actorId ?? null, sentAt: now })
  return true
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function magicLinkMail(url: string): Omit<Mail, 'to'> {
  return {
    subject: 'Tu enlace para entrar a ExpIA',
    text: `Abre este enlace para entrar a ExpIA. Vence en 10 minutos.\n\n${url}\n\nSi no lo pediste, ignora este correo.`,
    html: `<p>Abre este enlace para entrar a ExpIA. Vence en 10 minutos.</p><p><a href="${escapeHtml(url)}">Entrar a ExpIA</a></p><p>Si no lo pediste, ignora este correo.</p>`,
  }
}

export function inviteMail(i: { groupName: string; guideName: string; url: string }): Omit<Mail, 'to'> {
  const who = `${i.guideName} te invitó al grupo «${i.groupName}» en ExpIA.`
  return {
    subject: `Invitación al grupo ${i.groupName}`,
    text: `${who}\n\nÁbrelo aquí (vence en 14 días):\n\n${i.url}`,
    html: `<p>${escapeHtml(who)}</p><p><a href="${escapeHtml(i.url)}">Unirme al grupo</a></p><p>La invitación vence en 14 días.</p>`,
  }
}

export function getMailer(): Mailer {
  const key = process.env.RESEND_API_KEY
  if (key) {
    const resend = new Resend(key)
    const from = process.env.EMAIL_FROM ?? 'ExpIA <onboarding@resend.dev>'
    return async (m) => {
      const { error } = await resend.emails.send({ from, to: m.to, subject: m.subject, text: m.text, html: m.html })
      if (error) throw new Error(`No se pudo enviar el correo: ${error.message}`)
    }
  }
  // E2E: no se envía nada; el enlace queda en el log del servidor
  if (process.env.EXPIA_E2E === '1') return async (m) => { console.log(`[correo] ${m.to}: ${m.subject}`) }
  return async () => { throw new Error('Falta RESEND_API_KEY') }
}
```

- [ ] **Step 4: Escribir `lib/registration.ts`**

```ts
import type { Db } from '@/lib/db/client'
import { inviteProblem, isAdmin, mayRegister } from '@/lib/access'
import { hasGuideInvite } from '@/lib/groups'
import { findInvite, INVITE_COOKIE } from '@/lib/invites'

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

export async function registrationAllowed(
  db: Db, admins: ReadonlySet<string>, email: string, cookieHeader: string | null, now = new Date(),
): Promise<boolean> {
  const token = readCookie(cookieHeader, INVITE_COOKIE)
  let problem: ReturnType<typeof inviteProblem> | undefined
  if (token) {
    const found = await findInvite(db, token)
    problem = inviteProblem(found?.invite, Boolean(found?.group.archivedAt), email, now)
  }
  return mayRegister({ isAdmin: isAdmin(email, admins), hasGuideInvite: await hasGuideInvite(db, email), inviteProblem: problem })
}
```

- [ ] **Step 5: Escribir `lib/auth-config.ts`, `lib/auth.ts`, `lib/session.ts` y la ruta**

`lib/auth-config.ts`:

```ts
import { betterAuth, type BetterAuthPlugin } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import { eq } from 'drizzle-orm'
import type { Db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { normalizeEmail } from '@/lib/access'
import { claimGuideInvite } from '@/lib/groups'
import { magicLinkMail, sendLimited, type Mailer } from '@/lib/email'
import { registrationAllowed } from '@/lib/registration'

export type AuthDeps = {
  db: Db
  mailer: Mailer
  admins: ReadonlySet<string>
  baseURL?: string
  secret?: string
  google?: { clientId: string; clientSecret: string }
}

export function createAuth(deps: AuthDeps, extraPlugins: BetterAuthPlugin[] = []) {
  const { db, mailer, admins } = deps
  return betterAuth({
    baseURL: deps.baseURL,
    secret: deps.secret,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    user: {
      additionalFields: { isGuide: { type: 'boolean', defaultValue: false, input: false } },
      // Nadie se registra solo: cada cuenta nueva necesita una invitación (o ser administrador)
      validateUserInfo: async ({ user, source }, ctx) => {
        if (source.action !== 'create-user') return
        const ok = await registrationAllowed(db, admins, String(user.email ?? ''), ctx?.headers?.get('cookie') ?? null)
        if (!ok) return { error: 'not_invited', errorDescription: 'Necesitas una invitación para entrar.' }
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (u) => ({ data: { ...u, email: normalizeEmail(u.email) } }),
          after: async (u) => { await claimGuideInvite(db, u) },
        },
      },
    },
    socialProviders: deps.google ? { google: deps.google } : {},
    plugins: [
      magicLink({
        expiresIn: 600,
        sendMagicLink: async ({ email, url }, ctx) => {
          const to = normalizeEmail(email)
          const [existing] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, to))
          // A un correo sin cuenta ni invitación no se le envía nada (y no se avisa, para no revelar quién está)
          if (!existing && !(await registrationAllowed(db, admins, to, ctx?.headers?.get('cookie') ?? null))) return
          await sendLimited(db, mailer, { kind: 'magic-link', to }, magicLinkMail(url))
        },
      }),
      ...extraPlugins,
      nextCookies(),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
```

`lib/auth.ts`:

```ts
import { getDb } from '@/lib/db/client'
import { getMailer } from '@/lib/email'
import { parseAdminEmails } from '@/lib/access'
import { createAuth, type Auth } from '@/lib/auth-config'

let instance: Promise<Auth> | undefined

// BETTER_AUTH_URL y BETTER_AUTH_SECRET los lee Better Auth del entorno
export function getAuth(): Promise<Auth> {
  return (instance ??= (async () => {
    const id = process.env.GOOGLE_CLIENT_ID
    const secret = process.env.GOOGLE_CLIENT_SECRET
    return createAuth({
      db: await getDb(),
      mailer: getMailer(),
      admins: parseAdminEmails(process.env.ADMIN_EMAILS),
      google: id && secret ? { clientId: id, clientSecret: secret } : undefined,
    })
  })())
}
```

`lib/session.ts`:

```ts
import { headers } from 'next/headers'
import { actorFromSession, parseAdminEmails, type Actor } from '@/lib/access'
import { getAuth } from '@/lib/auth'

// Se lee en cada petición: si a alguien le quitan el rol de guía, lo nota en su próxima visita
export async function getActor(h?: Headers): Promise<Actor | null> {
  const auth = await getAuth()
  const s = await auth.api.getSession({ headers: h ?? (await headers()) })
  return s ? actorFromSession(s.user, parseAdminEmails(process.env.ADMIN_EMAILS)) : null
}
```

`app/api/auth/[...all]/route.ts`:

```ts
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const handle = async (req: Request) => (await getAuth()).handler(req)

export { handle as GET, handle as POST }
```

- [ ] **Step 6: Correr los tests y ver que pasan**

Run: `npx vitest run tests/email.test.ts tests/auth.test.ts`
Expected: PASS. Si `signIn` no encuentra la URL en el correo, revisar que `magicLinkMail` ponga la URL en `text`.

- [ ] **Step 7: Correr la suite y el typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: todo pasa.

- [ ] **Step 8: Commit**

```bash
git add lib/email.ts lib/registration.ts lib/auth-config.ts lib/auth.ts lib/session.ts app/api/auth tests/email.test.ts tests/auth.test.ts
git commit -m "feat: inicio de sesión con Google y enlace mágico, solo por invitación

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: API de lo aprendido y login de prueba

**Files:**
- Create: `lib/api/learned.ts`, `app/api/learned/route.ts`, `app/api/learned/import/route.ts`, `lib/test-login.ts`, `app/api/test/login/route.ts`
- Test: `tests/learned-api.test.ts`, `tests/test-login.test.ts`

**Interfaces:**
- Consumes: `getLearned`, `setLearned`, `importLearned`, `MAX_IMPORT` (Task 6); `createAuth`, `Auth` (Task 7); `claimGuideInvite` (Task 4); `safeNext`, `normalizeEmail` (Task 2)
- Produces:
  - `learnedApi(deps: { db: Db; userId: (req: Request) => Promise<string | null>; known: ReadonlySet<string> }): { list(req: Request): Promise<Response>; toggle(req: Request): Promise<Response>; importIds(req: Request): Promise<Response> }`
  - `e2eEnabled(env: Record<string, string | undefined>): boolean`
  - `testLogin(req: Request, deps: { env: Record<string, string | undefined>; db: () => Promise<Db>; auth: () => Promise<Auth> }): Promise<Response>`
  - API: `GET /api/learned` → `{ ids: string[] }`; `POST /api/learned` con `{ nodeId: string; learned: boolean }` → `{ ok: true }`; `POST /api/learned/import` con `{ ids: string[] }` → `{ ids: string[] }`; todas responden 401 sin sesión
  - `GET /api/test/login?email=&name=&next=` (solo con `EXPIA_E2E=1` y sin `VERCEL`)

- [ ] **Step 1: Escribir los tests que fallan**

`tests/learned-api.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db/client'
import { learnedApi } from '@/lib/api/learned'
import { getLearned } from '@/lib/progress'
import { resetDb, seedUser, testDb } from './helpers/db'

let db: Db
let current: string | null
beforeAll(async () => { db = await testDb() })
beforeEach(async () => { await resetDb(db); current = null })

const api = () => learnedApi({ db, userId: async () => current, known: new Set(['llm', 'transformer']) })
const post = (body: unknown) => new Request('http://x/api/learned', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

describe('/api/learned', () => {
  it('sin sesión responde 401', async () => {
    expect((await api().list(new Request('http://x'))).status).toBe(401)
    expect((await api().toggle(post({ nodeId: 'llm', learned: true }))).status).toBe(401)
    expect((await api().importIds(post({ ids: [] }))).status).toBe(401)
  })
  it('marca, lista y desmarca', async () => {
    current = (await seedUser(db)).id
    expect((await api().toggle(post({ nodeId: 'llm', learned: true }))).status).toBe(200)
    expect(await (await api().list(new Request('http://x'))).json()).toEqual({ ids: ['llm'] })
    await api().toggle(post({ nodeId: 'llm', learned: false }))
    expect(await getLearned(db, current)).toEqual([])
  })
  it('rechaza un nodo que no existe o un cuerpo mal formado', async () => {
    current = (await seedUser(db)).id
    expect((await api().toggle(post({ nodeId: 'inventado', learned: true }))).status).toBe(400)
    expect((await api().toggle(post({ nodeId: 'llm' }))).status).toBe(400)
    expect((await api().toggle(new Request('http://x', { method: 'POST', body: 'no es json' }))).status).toBe(400)
  })
  it('importar filtra ids desconocidos y repetidos, y une con lo existente', async () => {
    current = (await seedUser(db)).id
    await api().toggle(post({ nodeId: 'transformer', learned: true }))
    const res = await api().importIds(post({ ids: ['llm', 'llm', 'inventado', 42] }))
    expect((await res.json()).ids.sort()).toEqual(['llm', 'transformer'])
  })
  it('rechaza importar más de 500 ids', async () => {
    current = (await seedUser(db)).id
    expect((await api().importIds(post({ ids: Array.from({ length: 501 }, () => 'llm') }))).status).toBe(400)
  })
})
```

`tests/test-login.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db/client'
import { createAuth } from '@/lib/auth-config'
import { e2eEnabled, testLogin, testPlugins } from '@/lib/test-login'
import { testDb } from './helpers/db'

let db: Db
beforeAll(async () => { db = await testDb() })

const deps = (env: Record<string, string | undefined>) => ({
  env,
  db: async () => db,
  auth: async () =>
    createAuth({ db, mailer: async () => {}, admins: new Set(), baseURL: 'http://localhost:3100', secret: 'b'.repeat(40) }, testPlugins()),
})
const req = (q: string) => new Request(`http://localhost:3100/api/test/login?${q}`)

describe('login de prueba', () => {
  it('no existe sin EXPIA_E2E', async () => {
    expect(e2eEnabled({})).toBe(false)
    expect((await testLogin(req('email=a@x.com'), deps({}))).status).toBe(404)
  })
  it('no existe en ningún despliegue de Vercel, aunque tenga EXPIA_E2E', async () => {
    expect(e2eEnabled({ EXPIA_E2E: '1', VERCEL: '1' })).toBe(false)
    expect((await testLogin(req('email=a@x.com'), deps({ EXPIA_E2E: '1', VERCEL: '1' }))).status).toBe(404)
  })
  it('con EXPIA_E2E crea la persona, deja la cookie de sesión y redirige a una ruta interna', async () => {
    const res = await testLogin(req('email=Nuevo@X.com&next=/guia'), deps({ EXPIA_E2E: '1' }))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3100/guia')
    expect(res.headers.get('set-cookie')).toContain('session_token')
  })
  it('ignora un next a otro dominio', async () => {
    const res = await testLogin(req('email=a@x.com&next=//evil.com'), deps({ EXPIA_E2E: '1' }))
    expect(res.headers.get('location')).toBe('http://localhost:3100/cuenta')
  })
})
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `npx vitest run tests/learned-api.test.ts tests/test-login.test.ts`
Expected: FAIL, no se pueden resolver `@/lib/api/learned` y `@/lib/test-login`.

- [ ] **Step 3: Escribir `lib/api/learned.ts` y sus rutas**

`lib/api/learned.ts`:

```ts
import { z } from 'zod'
import type { Db } from '@/lib/db/client'
import { getLearned, importLearned, MAX_IMPORT, setLearned } from '@/lib/progress'

const toggleSchema = z.object({ nodeId: z.string(), learned: z.boolean() })
const importSchema = z.object({ ids: z.array(z.unknown()).max(MAX_IMPORT) })

const json = (body: unknown, status = 200) => Response.json(body, { status })

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return undefined
  }
}

export function learnedApi(deps: { db: Db; userId: (req: Request) => Promise<string | null>; known: ReadonlySet<string> }) {
  const { db, known } = deps
  return {
    async list(req: Request) {
      const userId = await deps.userId(req)
      if (!userId) return json({ error: 'sin-sesion' }, 401)
      return json({ ids: await getLearned(db, userId) })
    },
    async toggle(req: Request) {
      const userId = await deps.userId(req)
      if (!userId) return json({ error: 'sin-sesion' }, 401)
      const body = toggleSchema.safeParse(await readJson(req))
      if (!body.success || !known.has(body.data.nodeId)) return json({ error: 'cuerpo-invalido' }, 400)
      await setLearned(db, userId, body.data.nodeId, body.data.learned)
      return json({ ok: true })
    },
    async importIds(req: Request) {
      const userId = await deps.userId(req)
      if (!userId) return json({ error: 'sin-sesion' }, 401)
      const body = importSchema.safeParse(await readJson(req))
      if (!body.success) return json({ error: 'cuerpo-invalido' }, 400)
      const ids = body.data.ids.filter((x): x is string => typeof x === 'string' && known.has(x))
      return json({ ids: await importLearned(db, userId, ids) })
    },
  }
}
```

`app/api/learned/route.ts`:

```ts
import { getDb } from '@/lib/db/client'
import { getCatalog } from '@/lib/content/load'
import { getActor } from '@/lib/session'
import { learnedApi } from '@/lib/api/learned'

export const dynamic = 'force-dynamic'

const api = async () =>
  learnedApi({
    db: await getDb(),
    userId: async (req) => (await getActor(req.headers))?.id ?? null,
    known: new Set(getCatalog().nodes.map((n) => n.id)),
  })

export async function GET(req: Request) {
  return (await api()).list(req)
}

export async function POST(req: Request) {
  return (await api()).toggle(req)
}
```

`app/api/learned/import/route.ts`:

```ts
import { getDb } from '@/lib/db/client'
import { getCatalog } from '@/lib/content/load'
import { getActor } from '@/lib/session'
import { learnedApi } from '@/lib/api/learned'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const api = learnedApi({
    db: await getDb(),
    userId: async (r) => (await getActor(r.headers))?.id ?? null,
    known: new Set(getCatalog().nodes.map((n) => n.id)),
  })
  return api.importIds(req)
}
```

- [ ] **Step 4: Escribir el login de prueba**

`lib/test-login.ts`:

```ts
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { testUtils } from 'better-auth/plugins'
import type { Db } from '@/lib/db/client'
import { user } from '@/lib/db/schema'
import { normalizeEmail, safeNext } from '@/lib/access'
import { claimGuideInvite } from '@/lib/groups'
import type { Auth } from '@/lib/auth-config'

type Env = Record<string, string | undefined>
type TestCtx = { test: { login(o: { userId: string }): Promise<{ cookies: { name: string; value: string }[] }> } }

// Nunca en Vercel: ni en producción ni en las vistas previas
export const e2eEnabled = (env: Env): boolean => env.EXPIA_E2E === '1' && !env.VERCEL

export const testPlugins = () => [testUtils()]

export async function testLogin(req: Request, deps: { env: Env; db: () => Promise<Db>; auth: () => Promise<Auth> }): Promise<Response> {
  if (!e2eEnabled(deps.env)) return new Response('No encontrado', { status: 404 })
  const url = new URL(req.url)
  const email = normalizeEmail(url.searchParams.get('email') ?? '')
  if (!email) return new Response('Falta email', { status: 400 })
  const db = await deps.db()
  let [u] = await db.select().from(user).where(eq(user.email, email))
  if (!u) {
    ;[u] = await db
      .insert(user)
      .values({ id: crypto.randomUUID(), email, name: url.searchParams.get('name') ?? email.split('@')[0], emailVerified: true })
      .returning()
    await claimGuideInvite(db, u)
  }
  const ctx = (await (await deps.auth()).$context) as unknown as TestCtx
  const { cookies } = await ctx.test.login({ userId: u.id })
  const res = NextResponse.redirect(new URL(safeNext(url.searchParams.get('next')), url))
  for (const c of cookies) res.cookies.set(c.name, c.value, { path: '/', httpOnly: true, sameSite: 'lax' })
  return res
}
```

`app/api/test/login/route.ts`:

```ts
import { getDb } from '@/lib/db/client'
import { getMailer } from '@/lib/email'
import { parseAdminEmails } from '@/lib/access'
import { createAuth, type Auth } from '@/lib/auth-config'
import { testLogin, testPlugins } from '@/lib/test-login'

export const dynamic = 'force-dynamic'

let testAuth: Promise<Auth> | undefined

export async function GET(req: Request) {
  return testLogin(req, {
    env: process.env,
    db: getDb,
    // Instancia aparte con el plugin de pruebas; misma base y mismo secreto que la real
    auth: () =>
      (testAuth ??= (async () =>
        createAuth({ db: await getDb(), mailer: getMailer(), admins: parseAdminEmails(process.env.ADMIN_EMAILS) }, testPlugins()))()),
  })
}
```

- [ ] **Step 5: Correr los tests y ver que pasan**

Run: `npx vitest run tests/learned-api.test.ts tests/test-login.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/api app/api/learned lib/test-login.ts app/api/test tests/learned-api.test.ts tests/test-login.test.ts
git commit -m "feat: API del avance con sesión y login de prueba solo para E2E

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: El avance en el cliente con o sin sesión

**Files:**
- Create: `lib/learned-sync.ts`, `lib/auth-client.ts`, `components/import-offer.tsx`, `components/account-link.tsx`
- Modify: `components/learned-provider.tsx`, `components/site-header.tsx`, `app/layout.tsx`
- Test: `tests/learned-sync.test.ts`

**Interfaces:**
- Consumes: `toggleLearned`, `readLearned`, `toggleStored`, `LEARNED_KEY` (`lib/learned.ts`); API de la Task 8
- Produces:
  - `lib/learned-sync.ts`: `IMPORT_DONE_KEY = 'expia.importOffered'`, `mergeLearned(a: readonly string[], b: readonly string[]): string[]`, `revertToggle(current: readonly string[], id: string, wanted: boolean): string[]`, `pendingImport(local: readonly string[], server: readonly string[], done: boolean): string[]`
  - `lib/auth-client.ts`: `authClient` (con `useSession`, `signIn.social`, `signIn.magicLink`, `signOut`)
  - `useLearned()` agrega `signedIn: boolean`, `error: string | null`, `serverIds: readonly string[] | null`, `setFromServer(ids: string[]): void`; conserva `learned`, `ready`, `toggle`
  - `<ImportOffer />`, `<AccountLink />`

- [ ] **Step 1: Escribir el test que falla**

`tests/learned-sync.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mergeLearned, pendingImport, revertToggle } from '@/lib/learned-sync'

describe('sincronizar lo aprendido', () => {
  it('une sin repetir y conserva el orden', () => {
    expect(mergeLearned(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
  })
  it('revertir deshace solo si el estado sigue siendo el que se pidió', () => {
    expect(revertToggle(['a', 'b'], 'b', true)).toEqual(['a'])
    expect(revertToggle(['a'], 'b', false)).toEqual(['a', 'b'])
    // Si otra acción ya lo cambió, no se toca
    expect(revertToggle(['a'], 'b', true)).toEqual(['a'])
  })
  it('ofrece importar solo lo local que falta en el servidor, una vez', () => {
    expect(pendingImport(['a', 'b'], ['a'], false)).toEqual(['b'])
    expect(pendingImport(['a'], ['a'], false)).toEqual([])
    expect(pendingImport(['a', 'b'], [], true)).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run tests/learned-sync.test.ts`
Expected: FAIL, no se puede resolver `@/lib/learned-sync`.

- [ ] **Step 3: Escribir `lib/learned-sync.ts` y `lib/auth-client.ts`**

`lib/learned-sync.ts`:

```ts
import { toggleLearned } from '@/lib/learned'

export const IMPORT_DONE_KEY = 'expia.importOffered'

export const mergeLearned = (a: readonly string[], b: readonly string[]): string[] => [...new Set([...a, ...b])]

// Si el servidor falla, se deshace el cambio, pero solo si nadie lo cambió de nuevo mientras tanto
export function revertToggle(current: readonly string[], id: string, wanted: boolean): string[] {
  return current.includes(id) === wanted ? toggleLearned(current, id) : [...current]
}

export const pendingImport = (local: readonly string[], server: readonly string[], done: boolean): string[] =>
  done ? [] : local.filter((id) => !server.includes(id))
```

`lib/auth-client.ts`:

```ts
'use client'
import { createAuthClient } from 'better-auth/react'
import { magicLinkClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({ plugins: [magicLinkClient()] })
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run tests/learned-sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Cambiar el provider para que use el servidor con sesión**

`components/learned-provider.tsx` (reemplazo completo):

```tsx
'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LEARNED_KEY, readLearned, toggleLearned, toggleStored } from '@/lib/learned'
import { revertToggle } from '@/lib/learned-sync'
import { safeLocalStorage } from '@/lib/audience'
import { authClient } from '@/lib/auth-client'

type LearnedState = {
  learned: ReadonlySet<string>
  ready: boolean
  toggle: (id: string) => void
  signedIn: boolean
  error: string | null
  serverIds: readonly string[] | null
  setFromServer: (ids: string[]) => void
}

const LearnedContext = createContext<LearnedState>({
  learned: new Set(), ready: false, toggle: () => {}, signedIn: false, error: null, serverIds: null, setFromServer: () => {},
})

export function LearnedProvider({ knownIds, children }: { knownIds: string[]; children: ReactNode }) {
  const known = useMemo(() => new Set(knownIds), [knownIds])
  const { data: session, isPending } = authClient.useSession()
  const signedIn = Boolean(session)
  const [ids, setIds] = useState<string[]>([])
  const [serverIds, setServerIds] = useState<string[] | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setFromServer = useCallback((all: string[]) => {
    const visible = all.filter((id) => known.has(id))
    setServerIds(visible)
    setIds(visible)
  }, [known])

  // Sin sesión: localStorage, igual que en 5a. Con sesión: la API
  useEffect(() => {
    if (isPending) return
    setReady(false)
    if (!signedIn) {
      setServerIds(null)
      setIds(readLearned(safeLocalStorage(), known))
      setReady(true)
      const onStorage = (e: StorageEvent) => {
        if (e.key === LEARNED_KEY || e.key === null) setIds(readLearned(safeLocalStorage(), known))
      }
      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    }
    let alive = true
    fetch('/api/learned')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { ids: string[] }) => { if (alive) { setFromServer(body.ids); setReady(true) } })
      .catch(() => { if (alive) setError('No se pudo cargar tu avance.') })
    return () => { alive = false }
  }, [isPending, signedIn, known, setFromServer])

  const toggle = useCallback(
    (id: string) => {
      if (!ready) return
      if (!signedIn) {
        setIds(toggleStored(safeLocalStorage(), known, ids, id))
        return
      }
      const wanted = !ids.includes(id)
      setError(null)
      setIds(toggleLearned(ids, id))
      fetch('/api/learned', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nodeId: id, learned: wanted }) })
        .then((r) => { if (!r.ok) throw new Error(String(r.status)) })
        .catch(() => {
          // El updater solo calcula; el aviso va aparte
          setIds((cur) => revertToggle(cur, id, wanted))
          setError('No se pudo guardar. Inténtalo de nuevo.')
        })
    },
    [ready, signedIn, known, ids],
  )

  const learned = useMemo(() => new Set(ids), [ids])
  return (
    <LearnedContext.Provider value={{ learned, ready, toggle, signedIn, error, serverIds, setFromServer }}>
      {children}
      {error && (
        <p role="alert" data-testid="learned-error" className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-destructive px-4 py-2 text-sm text-white shadow">
          {error}
        </p>
      )}
    </LearnedContext.Provider>
  )
}

export const useLearned = () => useContext(LearnedContext)
```

- [ ] **Step 6: Escribir la oferta de importar y el enlace de cuenta**

`components/import-offer.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useLearned } from './learned-provider'
import { Button } from './ui/button'
import { readLearned } from '@/lib/learned'
import { IMPORT_DONE_KEY, pendingImport } from '@/lib/learned-sync'
import { safeLocalStorage } from '@/lib/audience'

export function ImportOffer({ knownIds }: { knownIds: string[] }) {
  const { signedIn, serverIds, setFromServer } = useLearned()
  const [pending, setPending] = useState<string[]>([])

  useEffect(() => {
    if (!signedIn || !serverIds) return setPending([])
    const storage = safeLocalStorage()
    let done = false
    try { done = storage?.getItem(IMPORT_DONE_KEY) === '1' } catch {}
    setPending(pendingImport(readLearned(storage, new Set(knownIds)), serverIds, done))
  }, [signedIn, serverIds, knownIds])

  const finish = () => {
    try { safeLocalStorage()?.setItem(IMPORT_DONE_KEY, '1') } catch {}
    setPending([])
  }
  const bring = async () => {
    const res = await fetch('/api/learned/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: pending }) })
    if (res.ok) setFromServer(((await res.json()) as { ids: string[] }).ids)
    finish()
  }

  if (!pending.length) return null
  return (
    <div data-testid="import-offer" className="mx-auto mt-4 flex max-w-6xl flex-wrap items-center gap-3 rounded-md border px-4 py-3 text-sm">
      <span>Tienes avance guardado en este navegador.</span>
      <Button size="sm" onClick={bring}>Traer tu avance de este navegador ({pending.length} {pending.length === 1 ? 'nodo' : 'nodos'})</Button>
      <Button size="sm" variant="ghost" onClick={finish}>Descartar</Button>
    </div>
  )
}
```

`components/account-link.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

export function AccountLink() {
  const { data, isPending } = authClient.useSession()
  if (isPending) return <span className="w-16" />
  return data ? (
    <Link href="/cuenta" data-testid="account-link" className="text-sm font-medium">{data.user.name}</Link>
  ) : (
    <Link href="/entrar" data-testid="account-link" className="text-sm text-muted-foreground hover:text-foreground">Entrar</Link>
  )
}
```

En `components/site-header.tsx`, importar `AccountLink` y reemplazar `<AudienceToggle />` por:

```tsx
        <div className="flex items-center gap-4">
          <AudienceToggle />
          <AccountLink />
        </div>
```

En `app/layout.tsx`, importar `ImportOffer` y renderizarlo justo después de `<SiteHeader />`:

```tsx
            <SiteHeader />
            <ImportOffer knownIds={knownIds} />
```

- [ ] **Step 7: Verificar que las páginas siguen estáticas y que las E2E actuales pasan**

Run: `npm test && npx tsc --noEmit && npx next build 2>&1 | tee /tmp/build.log | tail -40`
Expected: `/`, `/paths/[id]`, `/node/[id]`, `/learn/[id]` siguen marcadas `○` o `●`; `/api/auth/[...all]` y `/api/learned` como `ƒ`.

Run: `EXPIA_E2E=1 npx playwright test`
Expected: 30 passed. Sin sesión, `/api/auth/get-session` responde sin usuario y el avance sigue en `localStorage`.

- [ ] **Step 8: Commit**

```bash
git add lib/learned-sync.ts lib/auth-client.ts components app/layout.tsx tests/learned-sync.test.ts
git commit -m "feat: el avance se guarda en la cuenta al iniciar sesión, con oferta de importar el local

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Entrar, unirse y la cuenta del alumno

**Files:**
- Create: `lib/join.ts`, `app/unirse/[token]/entrar/route.ts`, `app/unirse/[token]/canjear/route.ts`, `app/unirse/[token]/page.tsx`, `app/entrar/page.tsx`, `components/sign-in-form.tsx`, `app/cuenta/page.tsx`, `app/cuenta/actions.ts`, `components/sign-out-button.tsx`
- Test: `tests/join.test.ts`

**Interfaces:**
- Consumes: `findInvite`, `redeemInvite`, `INVITE_COOKIE` (Task 5); `inviteProblem`, `safeNext`, `maskEmail`, `Actor` (Task 2); `studentGroups` (Task 6); `leaveGroup` (Task 4); `getActor` (Task 7); `authClient` (Task 9)
- Produces:
  - `INVITE_MESSAGES: Record<InviteProblem, string>`
  - `joinStart(req: Request, token: string): Response` (cookie de 1 hora + redirección a `/entrar?next=/unirse/<token>/canjear`)
  - `joinRedeem(req: Request, token: string, deps: { db: Db; actor: Actor | null; now?: Date }): Promise<Response>`

- [ ] **Step 1: Escribir el test que falla**

`tests/join.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db/client'
import { memberships } from '@/lib/db/schema'
import type { Actor } from '@/lib/access'
import { createGroup } from '@/lib/groups'
import { createLinkInvite, INVITE_COOKIE } from '@/lib/invites'
import { INVITE_MESSAGES, joinRedeem, joinStart } from '@/lib/join'
import { resetDb, seedUser, testDb } from './helpers/db'

let db: Db
beforeAll(async () => { db = await testDb() })
beforeEach(() => resetDb(db))

const BASE = 'http://localhost:3100'
const asActor = (u: { id: string; email: string; name: string; isGuide: boolean }): Actor => ({ ...u, isAdmin: false })

async function invite(maxUses: number | null = null) {
  const g = asActor(await seedUser(db, { isGuide: true }))
  const group = await createGroup(db, g, 'Taller')
  return { group, ...(await createLinkInvite(db, g, group.id, { maxUses })) }
}

describe('unirse a un grupo', () => {
  it('entrar guarda el token en una cookie httpOnly y manda a iniciar sesión', () => {
    const res = joinStart(new Request(`${BASE}/unirse/abc/entrar`), 'abc')
    expect(res.headers.get('location')).toBe(`${BASE}/entrar?next=%2Funirse%2Fabc%2Fcanjear`)
    const cookie = res.headers.get('set-cookie')!
    expect(cookie).toContain(`${INVITE_COOKIE}=abc`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Max-Age=3600')
  })
  it('canjear sin sesión vuelve a la página de la invitación', async () => {
    const res = await joinRedeem(new Request(`${BASE}/unirse/t/canjear`), 't', { db, actor: null })
    expect(res.headers.get('location')).toBe(`${BASE}/unirse/t`)
  })
  it('canjear con sesión suma al grupo, borra la cookie y lleva a la cuenta', async () => {
    const { token, group } = await invite()
    const s = asActor(await seedUser(db))
    const res = await joinRedeem(new Request(`${BASE}/unirse/${token}/canjear`), token, { db, actor: s })
    expect(res.headers.get('location')).toBe(`${BASE}/cuenta?unido=${group.id}`)
    expect(res.headers.get('set-cookie')).toContain(`${INVITE_COOKIE}=;`)
    expect(await db.select().from(memberships)).toHaveLength(1)
  })
  it('un enlace agotado devuelve a la invitación con el motivo', async () => {
    const { token } = await invite(1)
    await joinRedeem(new Request(`${BASE}/x`), token, { db, actor: asActor(await seedUser(db)) })
    const res = await joinRedeem(new Request(`${BASE}/x`), token, { db, actor: asActor(await seedUser(db)) })
    expect(res.headers.get('location')).toBe(`${BASE}/unirse/${token}?error=exhausted`)
  })
  it('hay un mensaje en español para cada problema', () => {
    expect(INVITE_MESSAGES.expired).toBe('Este enlace ya no es válido. Pídele uno nuevo a tu guía.')
    expect(Object.keys(INVITE_MESSAGES).sort()).toEqual(['archived', 'exhausted', 'expired', 'not-found', 'revoked', 'wrong-email'])
  })
})
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run tests/join.test.ts`
Expected: FAIL, no se puede resolver `@/lib/join`.

- [ ] **Step 3: Escribir `lib/join.ts` y sus dos rutas**

`lib/join.ts`:

```ts
import { NextResponse } from 'next/server'
import type { Db } from '@/lib/db/client'
import type { Actor, InviteProblem } from '@/lib/access'
import { INVITE_COOKIE, redeemInvite } from '@/lib/invites'

const INVALID = 'Este enlace ya no es válido. Pídele uno nuevo a tu guía.'

export const INVITE_MESSAGES: Record<InviteProblem, string> = {
  'not-found': INVALID,
  revoked: INVALID,
  archived: INVALID,
  expired: INVALID,
  exhausted: INVALID,
  'wrong-email': 'Esta invitación es para otro correo.',
}

// La cookie le permite al registro saber que esta persona viene invitada
export function joinStart(req: Request, token: string): Response {
  const next = `/unirse/${token}/canjear`
  const res = NextResponse.redirect(new URL(`/entrar?next=${encodeURIComponent(next)}`, req.url))
  res.cookies.set(INVITE_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 3600, secure: req.url.startsWith('https:') })
  return res
}

export async function joinRedeem(req: Request, token: string, deps: { db: Db; actor: Actor | null; now?: Date }): Promise<Response> {
  if (!deps.actor) return NextResponse.redirect(new URL(`/unirse/${token}`, req.url))
  const r = await redeemInvite(deps.db, { token, userId: deps.actor.id, email: deps.actor.email }, deps.now)
  const res = NextResponse.redirect(new URL(r.ok ? `/cuenta?unido=${r.groupId}` : `/unirse/${token}?error=${r.reason}`, req.url))
  if (r.ok) res.cookies.set(INVITE_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
```

`app/unirse/[token]/entrar/route.ts`:

```ts
import { joinStart } from '@/lib/join'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return joinStart(req, (await params).token)
}
```

`app/unirse/[token]/canjear/route.ts`:

```ts
import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { joinRedeem } from '@/lib/join'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return joinRedeem(req, (await params).token, { db: await getDb(), actor: await getActor(req.headers) })
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run tests/join.test.ts`
Expected: PASS.

- [ ] **Step 5: Escribir las páginas**

`components/sign-in-form.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from './ui/button'
import { Input } from './ui/input'

export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  if (sent) return <p data-testid="magic-sent">Revisa tu correo: te enviamos un enlace para entrar. Vence en 10 minutos.</p>

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <Button onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: next, errorCallbackURL: '/entrar' })}>
        Entrar con Google
      </Button>
      <form
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          await authClient.signIn.magicLink({ email, callbackURL: next, errorCallbackURL: '/entrar' })
          setBusy(false)
          setSent(true)
        }}
      >
        <label htmlFor="email" className="text-sm">O recibe un enlace en tu correo</label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" variant="outline" disabled={busy}>Enviarme el enlace</Button>
      </form>
    </div>
  )
}
```

`app/entrar/page.tsx`:

```tsx
import { SignInForm } from '@/components/sign-in-form'
import { safeNext } from '@/lib/access'

export const metadata = { title: 'Entrar' }

const ERRORS: Record<string, string> = {
  not_invited: 'Necesitas una invitación para entrar. Pídesela a tu guía.',
}

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Entrar a ExpIA</h1>
      <p className="text-muted-foreground">ExpIA funciona por invitación. Si un guía te invitó, entra con el mismo correo.</p>
      {error && <p role="alert" className="text-destructive">{ERRORS[error] ?? 'No se pudo iniciar sesión. Inténtalo de nuevo.'}</p>}
      <SignInForm next={safeNext(next)} />
    </div>
  )
}
```

`app/unirse/[token]/page.tsx`:

```tsx
import Link from 'next/link'
import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { findInvite } from '@/lib/invites'
import { inviteProblem, maskEmail, type InviteProblem } from '@/lib/access'
import { INVITE_MESSAGES } from '@/lib/join'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Invitación' }

export default async function UnirsePage({
  params, searchParams,
}: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params
  const { error } = await searchParams
  const db = await getDb()
  const found = await findInvite(db, token)
  const actor = await getActor()
  const problem = (error as InviteProblem | undefined) ?? inviteProblem(found?.invite, Boolean(found?.group.archivedAt), actor?.email ?? null, new Date())

  if (!found || problem) {
    const msg = problem === 'wrong-email' && found?.invite.email
      ? `Esta invitación es para ${maskEmail(found.invite.email)}. Entra con ese correo.`
      : INVITE_MESSAGES[problem ?? 'not-found'] ?? INVITE_MESSAGES['not-found']
    return <p role="alert" data-testid="invite-invalid">{msg}</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Te invitaron a «{found.group.name}»</h1>
      <p className="text-muted-foreground">Guía: {found.guideName}</p>
      {actor ? (
        <Button asChild><Link href={`/unirse/${token}/canjear`}>Unirme al grupo</Link></Button>
      ) : (
        <Button asChild><Link href={`/unirse/${token}/entrar`}>Entrar para unirme</Link></Button>
      )}
    </div>
  )
}
```

Si `components/ui/button.tsx` no acepta `asChild` (es de `@base-ui/react`), usar `<Link className={buttonVariants()} …>` con `buttonVariants` exportado desde ese mismo archivo; revisar el archivo antes de escribir y usar lo que exporte.

`app/cuenta/actions.ts`:

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { leaveGroup } from '@/lib/groups'

export async function leaveGroupAction(groupId: string) {
  const actor = await getActor()
  if (!actor) redirect('/entrar?next=/cuenta')
  await leaveGroup(await getDb(), actor.id, groupId)
  revalidatePath('/cuenta')
}
```

`components/sign-out-button.tsx`:

```tsx
'use client'
import { authClient } from '@/lib/auth-client'
import { Button } from './ui/button'

export function SignOutButton() {
  return (
    <Button variant="outline" size="sm" onClick={async () => { await authClient.signOut(); window.location.href = '/' }}>
      Cerrar sesión
    </Button>
  )
}
```

`app/cuenta/page.tsx`:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db/client'
import { getCatalog } from '@/lib/content/load'
import { getActor } from '@/lib/session'
import { studentGroups } from '@/lib/progress'
import { leaveGroupAction } from './actions'
import { SignOutButton } from '@/components/sign-out-button'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tu cuenta' }

export default async function CuentaPage() {
  const actor = await getActor()
  if (!actor) redirect('/entrar?next=/cuenta')
  const mine = await studentGroups(await getDb(), actor.id, getCatalog())
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Hola, {actor.name}</h1>
        <div className="flex gap-3">
          {actor.isGuide && <Link href="/guia" className="text-sm underline">Tus grupos como guía</Link>}
          {actor.isAdmin && <Link href="/admin" className="text-sm underline">Administrar</Link>}
          <SignOutButton />
        </div>
      </div>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Tus grupos</h2>
        {mine.length === 0 && <p className="text-muted-foreground">Todavía no estás en ningún grupo.</p>}
        <ul className="flex flex-col gap-6">
          {mine.map((g) => (
            <li key={g.groupId} data-testid="student-group" className="rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{g.name} <span className="text-sm text-muted-foreground">· {g.guideName}</span></p>
                <form action={leaveGroupAction.bind(null, g.groupId)}>
                  <Button type="submit" variant="ghost" size="sm">Salir del grupo</Button>
                </form>
              </div>
              {g.paths.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Tu guía todavía no asignó rutas.</p>}
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {g.paths.map((p) => (
                  <li key={p.ref}>
                    {p.href ? <Link href={p.href} className="underline">{p.title}</Link> : <span>Ruta no disponible</span>}
                    {' '}— {p.done} de {p.total}{p.dueDate && <> · para el {p.dueDate}</>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 6: Typecheck y build**

Run: `npm test && npx tsc --noEmit && npx next build 2>&1 | tail -40`
Expected: todo pasa; `/entrar`, `/cuenta` y `/unirse/[token]` como `ƒ`.

- [ ] **Step 7: Commit**

```bash
git add lib/join.ts app/unirse app/entrar app/cuenta components/sign-in-form.tsx components/sign-out-button.tsx tests/join.test.ts
git commit -m "feat: entrar, unirse a un grupo por enlace y página de cuenta del alumno

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Panel del guía y del administrador

**Files:**
- Create: `lib/invite-mail.ts`, `lib/site-url.ts`, `app/guia/page.tsx`, `app/guia/actions.ts`, `app/guia/[grupo]/page.tsx`, `app/guia/[grupo]/actions.ts`, `app/admin/page.tsx`, `app/admin/actions.ts`
- Test: `tests/invite-mail.test.ts`

**Interfaces:**
- Consumes: todo `lib/groups.ts`, `lib/invites.ts`, `lib/progress.ts`; `sendLimited`, `inviteMail`, `Mailer`, `getMailer` (Task 7); `getActor` (Task 7); `NotFoundError`, `InputError` (Task 2)
- Produces:
  - `sendEmailInvites(db, mailer, actor, groupId, rawEmails: string, origin: string, now?: Date): Promise<{ sent: number; skipped: number }>`
  - `siteUrl(h: Headers): string`
  - `ERROR_MESSAGES: Record<string, string>` (en `app/guia/[grupo]/page.tsx`)

- [ ] **Step 1: Escribir el test que falla**

`tests/invite-mail.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db/client'
import type { Mail } from '@/lib/email'
import type { Actor } from '@/lib/access'
import { createGroup } from '@/lib/groups'
import { sendEmailInvites } from '@/lib/invite-mail'
import { resetDb, seedUser, testDb } from './helpers/db'

let db: Db
let sent: Mail[]
beforeAll(async () => { db = await testDb() })
beforeEach(async () => { await resetDb(db); sent = [] })

describe('invitar por correo', () => {
  it('envía un correo por persona con su propio enlace y el nombre del grupo', async () => {
    const g: Actor = { ...(await seedUser(db, { isGuide: true, name: 'Profe' })), isAdmin: false }
    const group = await createGroup(db, g, 'Taller')
    const r = await sendEmailInvites(db, async (m) => { sent.push(m) }, g, group.id, 'ana@x.com, beto@x.com', 'https://expia.dev')
    expect(r).toEqual({ sent: 2, skipped: 0 })
    expect(sent.map((m) => m.to)).toEqual(['ana@x.com', 'beto@x.com'])
    expect(sent[0].text).toContain('Profe te invitó al grupo «Taller»')
    const urls = sent.map((m) => m.text.match(/https:\/\/expia\.dev\/unirse\/\S+/)![0])
    expect(new Set(urls).size).toBe(2)
  })
})
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run tests/invite-mail.test.ts`
Expected: FAIL, no se puede resolver `@/lib/invite-mail`.

- [ ] **Step 3: Escribir `lib/invite-mail.ts` y `lib/site-url.ts`**

`lib/invite-mail.ts`:

```ts
import type { Db } from '@/lib/db/client'
import type { Actor } from '@/lib/access'
import { createEmailInvites } from '@/lib/invites'
import { loadManagedGroup } from '@/lib/groups'
import { inviteMail, sendLimited, type Mailer } from '@/lib/email'

export async function sendEmailInvites(
  db: Db, mailer: Mailer, actor: Actor, groupId: string, rawEmails: string, origin: string, now = new Date(),
): Promise<{ sent: number; skipped: number }> {
  const group = await loadManagedGroup(db, actor, groupId)
  const created = await createEmailInvites(db, actor, groupId, rawEmails, now)
  let sent = 0
  for (const { email, token } of created) {
    const ok = await sendLimited(
      db, mailer, { kind: 'invite', to: email, actorId: actor.id },
      inviteMail({ groupName: group.name, guideName: actor.name, url: `${origin}/unirse/${token}` }), now,
    )
    if (ok) sent++
  }
  return { sent, skipped: created.length - sent }
}
```

`lib/site-url.ts`:

```ts
// Origen público del sitio para armar enlaces en correos
export function siteUrl(h: Headers): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/$/, '')
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run tests/invite-mail.test.ts`
Expected: PASS.

- [ ] **Step 5: Escribir las acciones y páginas del guía**

`app/guia/actions.ts`:

```ts
'use server'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { createGroup } from '@/lib/groups'
import { InputError, NotFoundError } from '@/lib/access'

export async function createGroupAction(form: FormData) {
  const actor = await getActor()
  if (!actor) redirect('/entrar?next=/guia')
  let id: string
  try {
    id = (await createGroup(await getDb(), actor, String(form.get('name') ?? ''))).id
  } catch (e) {
    if (e instanceof InputError) redirect(`/guia?error=${e.code}`)
    if (e instanceof NotFoundError) redirect('/cuenta')
    throw e
  }
  redirect(`/guia/${id}`)
}
```

`app/guia/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { listGuideGroups } from '@/lib/groups'
import { createGroupAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tus grupos' }

export default async function GuiaPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await getActor()
  if (!actor) redirect('/entrar?next=/guia')
  if (!actor.isGuide) notFound()
  const { error } = await searchParams
  const groups = await listGuideGroups(await getDb(), actor)
  const active = groups.filter((g) => !g.archivedAt)
  const archived = groups.filter((g) => g.archivedAt)
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Tus grupos</h1>
      <form action={createGroupAction} className="flex max-w-md gap-2">
        <label htmlFor="name" className="sr-only">Nombre del grupo</label>
        <Input id="name" name="name" placeholder="Nombre del grupo" maxLength={80} required />
        <Button type="submit">Crear grupo</Button>
      </form>
      {error === 'nombre-invalido' && <p role="alert" className="text-destructive">El nombre debe tener entre 1 y 80 caracteres.</p>}
      <ul className="flex flex-col gap-2">
        {active.map((g) => (
          <li key={g.id}><Link href={`/guia/${g.id}`} className="underline">{g.name}</Link> · {g.members} {g.members === 1 ? 'alumno' : 'alumnos'}</li>
        ))}
        {active.length === 0 && <li className="text-muted-foreground">Todavía no tienes grupos.</li>}
      </ul>
      {archived.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Archivados</h2>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            {archived.map((g) => <li key={g.id}><Link href={`/guia/${g.id}`} className="underline">{g.name}</Link></li>)}
          </ul>
        </section>
      )}
    </div>
  )
}
```

`app/guia/[grupo]/actions.ts`:

```ts
'use server'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db/client'
import { getCatalog } from '@/lib/content/load'
import { getActor } from '@/lib/session'
import { getMailer } from '@/lib/email'
import { siteUrl } from '@/lib/site-url'
import { InputError, NotFoundError, type Actor } from '@/lib/access'
import { archiveGroup, assignPath, removeMember, renameGroup, unassignPath } from '@/lib/groups'
import { createLinkInvite, revokeInvite } from '@/lib/invites'
import { sendEmailInvites } from '@/lib/invite-mail'
import { curatedRef, generatedRef } from '@/lib/path-refs'

// Carga la sesión y traduce los errores del dominio: NotFound → 404, InputError → mensaje en la página
async function run(groupId: string, fn: (actor: Actor) => Promise<string | void>): Promise<never> {
  const actor = await getActor()
  if (!actor) redirect(`/entrar?next=/guia/${groupId}`)
  let query = ''
  try {
    query = (await fn(actor)) ?? ''
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    if (e instanceof InputError) redirect(`/guia/${groupId}?error=${e.code}`)
    throw e
  }
  revalidatePath(`/guia/${groupId}`)
  redirect(`/guia/${groupId}${query}`)
}

const numberOrNull = (v: FormDataEntryValue | null) => (v === null || v === '' ? null : Number(v))

export async function createLinkAction(groupId: string, form: FormData) {
  await run(groupId, async (actor) => {
    const { token } = await createLinkInvite(await getDb(), actor, groupId, {
      days: numberOrNull(form.get('days')) ?? undefined,
      maxUses: numberOrNull(form.get('maxUses')),
    })
    // El enlace se muestra una sola vez: solo se guarda su hash
    return `?nuevo=${encodeURIComponent(`${siteUrl(await headers())}/unirse/${token}`)}`
  })
}

export async function emailInvitesAction(groupId: string, form: FormData) {
  await run(groupId, async (actor) => {
    const r = await sendEmailInvites(await getDb(), getMailer(), actor, groupId, String(form.get('emails') ?? ''), siteUrl(await headers()))
    return `?enviados=${r.sent}&omitidos=${r.skipped}`
  })
}

export async function revokeInviteAction(groupId: string, inviteId: string) {
  await run(groupId, async (actor) => { await revokeInvite(await getDb(), actor, groupId, inviteId) })
}

export async function assignAction(groupId: string, form: FormData) {
  await run(groupId, async (actor) => {
    const curated = String(form.get('curated') ?? '')
    const node = String(form.get('node') ?? '').trim()
    const ref = curated ? curatedRef(curated) : generatedRef(node)
    const due = String(form.get('dueDate') ?? '') || null
    await assignPath(await getDb(), actor, groupId, ref, due, getCatalog())
  })
}

export async function unassignAction(groupId: string, ref: string) {
  await run(groupId, async (actor) => { await unassignPath(await getDb(), actor, groupId, ref) })
}

export async function removeMemberAction(groupId: string, userId: string) {
  await run(groupId, async (actor) => { await removeMember(await getDb(), actor, groupId, userId) })
}

export async function renameAction(groupId: string, form: FormData) {
  await run(groupId, async (actor) => { await renameGroup(await getDb(), actor, groupId, String(form.get('name') ?? '')) })
}

export async function archiveAction(groupId: string) {
  await run(groupId, async (actor) => { await archiveGroup(await getDb(), actor, groupId) })
}
```

`app/guia/[grupo]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db/client'
import { getCatalog } from '@/lib/content/load'
import { getActor } from '@/lib/session'
import { NotFoundError } from '@/lib/access'
import { getGroupForGuide, listMembers } from '@/lib/groups'
import { listInvites, DEFAULT_DAYS, MAX_DAYS } from '@/lib/invites'
import { groupProgress } from '@/lib/progress'
import {
  archiveAction, assignAction, createLinkAction, emailInvitesAction, removeMemberAction, renameAction, revokeInviteAction, unassignAction,
} from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Grupo' }

const ERROR_MESSAGES: Record<string, string> = {
  'nombre-invalido': 'El nombre debe tener entre 1 y 80 caracteres.',
  'ruta-inexistente': 'Esa ruta no existe. Elige una ruta curada o escribe el id de un nodo del catálogo.',
  'fecha-invalida': 'La fecha no es válida.',
  'dias-invalidos': `El vencimiento debe ser de 1 a ${MAX_DAYS} días.`,
  'usos-invalidos': 'El máximo de usos debe ser 1 o más, o quedar vacío.',
  'cantidad-de-correos': 'Pega entre 1 y 50 correos.',
  'correo-invalido': 'Hay un correo mal escrito.',
}

const fmt = (d: Date) => d.toISOString().slice(0, 10)

export default async function GrupoPage({
  params, searchParams,
}: {
  params: Promise<{ grupo: string }>
  searchParams: Promise<{ error?: string; nuevo?: string; enviados?: string; omitidos?: string }>
}) {
  const { grupo } = await params
  const q = await searchParams
  const actor = await getActor()
  if (!actor) redirect(`/entrar?next=/guia/${grupo}`)
  const db = await getDb()
  const catalog = getCatalog()
  let group
  try {
    group = await getGroupForGuide(db, actor, grupo)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }
  const [table, members, invites] = await Promise.all([
    groupProgress(db, actor, grupo, catalog), listMembers(db, actor, grupo), listInvites(db, actor, grupo),
  ])
  const editable = !group.archivedAt
  const now = Date.now()
  const live = invites.filter((i) => !i.revokedAt && i.expiresAt.getTime() > now && (i.maxUses === null || i.uses < i.maxUses))

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{group.name}</h1>
        {!editable && <p className="text-muted-foreground">Grupo archivado: se puede consultar, pero no modificar.</p>}
        {q.error && <p role="alert" className="text-destructive">{ERROR_MESSAGES[q.error] ?? 'No se pudo completar la acción.'}</p>}
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Avance</h2>
        {table.rows.length === 0 ? (
          <p className="text-muted-foreground">Todavía no hay alumnos en el grupo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table data-testid="progress-table" className="text-sm">
              <thead>
                <tr>
                  <th className="pr-6 text-left">Alumno</th>
                  {table.columns.map((c) => (
                    <th key={c.ref} className="pr-6 text-left">{c.title ?? 'Ruta no disponible'}{c.dueDate && <span className="block font-normal text-muted-foreground">para el {c.dueDate}</span>}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r) => (
                  <tr key={r.userId} data-testid="progress-row">
                    <td className="pr-6">{r.name}</td>
                    {r.cells.map((cell, i) => (
                      <td key={table.columns[i].ref} className="pr-6">
                        {cell ? (cell.done === cell.total ? 'Completada' : `${cell.done} de ${cell.total}`) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Rutas asignadas</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {table.columns.map((c) => (
            <li key={c.ref} className="flex items-center gap-2">
              <span>{c.title ?? 'Ruta no disponible'}</span>
              {editable && (
                <form action={unassignAction.bind(null, group.id, c.ref)}><Button type="submit" variant="ghost" size="sm">Quitar</Button></form>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <form action={assignAction.bind(null, group.id)} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-sm">Ruta curada
              <select name="curated" className="h-9 rounded-md border px-2">
                <option value="">— o usa un nodo —</option>
                {catalog.paths.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
            <label className="flex flex-col text-sm">Nodo (ruta generada)
              <Input name="node" list="nodes" placeholder="p. ej. llm" />
              <datalist id="nodes">{catalog.nodes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}</datalist>
            </label>
            <label className="flex flex-col text-sm">Fecha (opcional)<Input type="date" name="dueDate" /></label>
            <Button type="submit">Asignar</Button>
          </form>
        )}
      </section>

      {editable && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Invitar</h2>
          {q.nuevo && (
            <p className="rounded-md border p-3 text-sm">
              Copia este enlace ahora; no se volverá a mostrar:{' '}
              <code data-testid="new-invite" className="break-all">{q.nuevo}</code>
            </p>
          )}
          {q.enviados && <p className="text-sm">Se enviaron {q.enviados} invitaciones{Number(q.omitidos) > 0 && <>; {q.omitidos} quedaron sin enviar por el límite diario</>}.</p>}
          <form action={createLinkAction.bind(null, group.id)} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-sm">Vence en (días)<Input type="number" name="days" min={1} max={MAX_DAYS} defaultValue={DEFAULT_DAYS} /></label>
            <label className="flex flex-col text-sm">Máximo de usos<Input type="number" name="maxUses" min={1} placeholder="Sin límite" /></label>
            <Button type="submit">Crear enlace</Button>
          </form>
          <form action={emailInvitesAction.bind(null, group.id)} className="flex flex-col gap-2">
            <label htmlFor="emails" className="text-sm">O pega hasta 50 correos</label>
            <textarea id="emails" name="emails" rows={3} className="rounded-md border p-2 text-sm" />
            <Button type="submit" variant="outline" className="self-start">Enviar invitaciones</Button>
          </form>
          <ul className="flex flex-col gap-1 text-sm">
            {live.map((i) => (
              <li key={i.id} className="flex items-center gap-2" data-testid="live-invite">
                <span>{i.kind === 'email' ? i.email : 'Enlace'} · vence el {fmt(i.expiresAt)} · {i.uses}{i.maxUses !== null && ` de ${i.maxUses}`} usos</span>
                <form action={revokeInviteAction.bind(null, group.id, i.id)}><Button type="submit" variant="ghost" size="sm">Revocar</Button></form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Alumnos</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2">
              <span>{m.name} · {m.email}</span>
              {editable && <form action={removeMemberAction.bind(null, group.id, m.userId)}><Button type="submit" variant="ghost" size="sm">Quitar</Button></form>}
            </li>
          ))}
        </ul>
      </section>

      {editable && (
        <section className="flex flex-wrap items-end gap-4">
          <form action={renameAction.bind(null, group.id)} className="flex items-end gap-2">
            <label className="flex flex-col text-sm">Nombre del grupo<Input name="name" defaultValue={group.name} maxLength={80} /></label>
            <Button type="submit" variant="outline">Renombrar</Button>
          </form>
          <form action={archiveAction.bind(null, group.id)}><Button type="submit" variant="destructive">Archivar grupo</Button></form>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Escribir el panel del administrador**

`app/admin/actions.ts`:

```ts
'use server'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { grantGuide, revokeGuide } from '@/lib/groups'
import { InputError, NotFoundError } from '@/lib/access'

async function asAdmin(fn: (actor: NonNullable<Awaited<ReturnType<typeof getActor>>>) => Promise<void>) {
  const actor = await getActor()
  if (!actor) redirect('/entrar?next=/admin')
  try {
    await fn(actor)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    if (e instanceof InputError) redirect(`/admin?error=${e.code}`)
    throw e
  }
  revalidatePath('/admin')
  redirect('/admin')
}

export async function grantGuideAction(form: FormData) {
  await asAdmin(async (actor) => grantGuide(await getDb(), actor, String(form.get('email') ?? '')))
}

export async function revokeGuideAction(userId: string) {
  await asAdmin(async (actor) => revokeGuide(await getDb(), actor, userId))
}
```

`app/admin/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { listGuides } from '@/lib/groups'
import { grantGuideAction, revokeGuideAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Administrar' }

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await getActor()
  if (!actor) redirect('/entrar?next=/admin')
  if (!actor.isAdmin) notFound()
  const { error } = await searchParams
  const { active, pending } = await listGuides(await getDb(), actor)
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Guías</h1>
      <form action={grantGuideAction} className="flex max-w-md items-end gap-2">
        <label className="flex flex-1 flex-col text-sm">Correo del guía<Input name="email" type="email" required /></label>
        <Button type="submit">Autorizar</Button>
      </form>
      {error === 'correo-invalido' && <p role="alert" className="text-destructive">Ese correo no es válido.</p>}
      <ul className="flex flex-col gap-1 text-sm">
        {active.map((g) => (
          <li key={g.id} className="flex items-center gap-2" data-testid="guide-row">
            <span>{g.name} · {g.email}</span>
            <form action={revokeGuideAction.bind(null, g.id)}><Button type="submit" variant="ghost" size="sm">Quitar rol</Button></form>
          </li>
        ))}
        {pending.map((email) => <li key={email} data-testid="guide-row" className="text-muted-foreground">{email} · todavía no entra</li>)}
      </ul>
    </div>
  )
}
```

- [ ] **Step 7: Typecheck y build**

Run: `npm test && npx tsc --noEmit && npx next build 2>&1 | tail -40`
Expected: todo pasa; `/guia`, `/guia/[grupo]` y `/admin` como `ƒ`. Si `Button` no admite `variant="destructive"` o `size="sm"`, usar las variantes que exporte `components/ui/button.tsx`.

- [ ] **Step 8: Commit**

```bash
git add lib/invite-mail.ts lib/site-url.ts app/guia app/admin tests/invite-mail.test.ts
git commit -m "feat: panel del guía (invitar, asignar, avance) y panel del administrador

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Migraciones en el build y documentación

**Files:**
- Create: `scripts/migrate.ts`
- Modify: `package.json` (script `build`), `README.md`
- Test: `tests/migrate.test.ts`

**Interfaces:**
- Consumes: `MIGRATIONS_DIR` (Task 1)
- Produces: `runMigrations(env: Record<string, string | undefined>, log?: (s: string) => void): Promise<'skipped' | 'applied'>`

- [ ] **Step 1: Escribir el test que falla**

`tests/migrate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { runMigrations } from '@/scripts/migrate'

describe('migraciones en el build', () => {
  it('sin DATABASE_URL no hace nada (CI, E2E y builds locales)', async () => {
    const lines: string[] = []
    expect(await runMigrations({}, (s) => lines.push(s))).toBe('skipped')
    expect(lines[0]).toContain('sin DATABASE_URL')
  })
})
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run tests/migrate.test.ts`
Expected: FAIL, no se puede resolver `@/scripts/migrate`.

- [ ] **Step 3: Escribir el script**

`scripts/migrate.ts`:

```ts
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
```

En `package.json`, cambiar `"build": "next build"` por `"build": "tsx scripts/migrate.ts && next build"`. `tsx` resuelve el alias `@/` con `tsconfig.json`; si no lo hace, cambiar el import a `../lib/db/client`.

- [ ] **Step 4: Correr el test y el build**

Run: `npx vitest run tests/migrate.test.ts && npm run build 2>&1 | head -5`
Expected: PASS; el build imprime `Migraciones: sin DATABASE_URL, se omiten` y sigue.

- [ ] **Step 5: Documentar en el README**

En `README.md`, en el roadmap, cambiar la línea 5 por:

```
5. **Modo enseñanza**: rutas de aprendizaje con repaso y progreso (este repo). Con cuentas: guías, grupos por invitación y avance en el servidor
```

Y agregar una sección al final:

```markdown
## Cuentas y grupos

ExpIA funciona por invitación. El administrador (correos en `ADMIN_EMAILS`) autoriza guías en `/admin`. Cada guía crea grupos en `/guia`, invita alumnos con un enlace (vence a los 14 días por defecto) o por correo, y les asigna rutas. Sin iniciar sesión, el avance sigue guardándose en el navegador.

Variables de entorno (en Vercel y en `.env.local`, nunca en el repo):

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Postgres en Neon (la crea la integración de Vercel) |
| `BETTER_AUTH_SECRET` | Firma de las sesiones (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | URL pública del sitio |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Entrar con Google |
| `RESEND_API_KEY`, `EMAIL_FROM` | Enlaces mágicos e invitaciones por correo |
| `ADMIN_EMAILS` | Correos administradores, separados por coma |

Las migraciones están en `drizzle/` (`npx drizzle-kit generate` después de cambiar `lib/db/schema.ts`) y se aplican solas en el build cuando hay `DATABASE_URL`. Las pruebas usan PGlite: no necesitan base de datos ni cuentas externas.
```

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate.ts package.json README.md tests/migrate.test.ts
git commit -m "feat: migraciones en el build y documentación de cuentas y grupos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: E2E del flujo completo

**Files:**
- Modify: `playwright.config.ts`
- Create: `e2e/accounts.spec.ts`

**Interfaces:**
- Consumes: `/api/test/login` (Task 8), páginas de las Tasks 10 y 11, `data-testid`: `account-link`, `import-offer`, `learned-toggle`, `learned-error`, `new-invite`, `progress-row`, `student-group`, `guide-row`, `invite-invalid`

- [ ] **Step 1: Configurar el servidor de E2E**

`playwright.config.ts`, reemplazar el bloque `webServer`:

```ts
  webServer: {
    command: 'rm -rf .pglite-e2e && npm run build && npm run start -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      EXPIA_E2E: '1',
      PGLITE_DIR: '.pglite-e2e',
      ADMIN_EMAILS: 'admin@e2e.test',
      BETTER_AUTH_URL: 'http://localhost:3100',
      BETTER_AUTH_SECRET: 'e2e-secreto-solo-para-pruebas-locales-0123456789',
    },
  },
```

El secreto de arriba no es un secreto real: solo firma sesiones de la base PGlite local que se borra en cada corrida.

- [ ] **Step 2: Escribir los tests E2E**

`e2e/accounts.spec.ts`:

```ts
import { expect, test, type Browser, type Page } from '@playwright/test'

const run = Date.now()
const mail = (who: string) => `${who}-${run}@e2e.test`

async function loginAs(browser: Browser, email: string, next: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage()
  await page.goto(`/api/test/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`)
  return page
}

async function authorizeGuide(browser: Browser, email: string) {
  const admin = await loginAs(browser, 'admin@e2e.test', '/admin')
  await admin.getByLabel('Correo del guía').fill(email)
  await admin.getByRole('button', { name: 'Autorizar' }).click()
  await expect(admin.getByTestId('guide-row').filter({ hasText: email })).toBeVisible()
}

test('un guía crea un grupo, un alumno se une con su avance local y el guía lo ve', async ({ browser }) => {
  const guideEmail = mail('guia')
  await authorizeGuide(browser, guideEmail)

  const guide = await loginAs(browser, guideEmail, '/guia')
  await guide.getByLabel('Nombre del grupo').fill('Taller E2E')
  await guide.getByRole('button', { name: 'Crear grupo' }).click()
  await expect(guide.getByRole('heading', { name: 'Taller E2E' })).toBeVisible()
  const groupUrl = guide.url()
  await guide.getByLabel('Ruta curada').selectOption('fundamentos')
  await guide.getByRole('button', { name: 'Asignar' }).click()
  await guide.getByRole('button', { name: 'Crear enlace' }).click()
  const inviteUrl = (await guide.getByTestId('new-invite').textContent())!.trim()
  const invitePath = new URL(inviteUrl).pathname

  // El alumno ya tenía avance en el navegador antes de tener cuenta
  const student = await (await browser.newContext()).newPage()
  await student.goto('/')
  await student.evaluate(() => localStorage.setItem('expia.learned', JSON.stringify(['machine-learning'])))
  await student.goto(`/api/test/login?email=${encodeURIComponent(mail('alumno'))}&next=${encodeURIComponent(invitePath)}`)
  await student.getByRole('link', { name: 'Unirme al grupo' }).click()
  await expect(student.getByTestId('student-group').filter({ hasText: 'Taller E2E' })).toBeVisible()

  await student.getByRole('button', { name: /Traer tu avance de este navegador \(1 nodo\)/ }).click()
  await expect(student.getByTestId('import-offer')).toBeHidden()

  await student.goto('/node/neural-network')
  const toggle = student.getByTestId('learned-toggle').first()
  await expect(toggle).toHaveAttribute('data-ready', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')

  await guide.goto(groupUrl)
  await expect(guide.getByTestId('progress-row')).toContainText('2 de 10')
})

test('otro guía recibe 404 en un grupo ajeno', async ({ browser }) => {
  const owner = mail('dueno')
  const intruder = mail('intruso')
  await authorizeGuide(browser, owner)
  await authorizeGuide(browser, intruder)
  const page = await loginAs(browser, owner, '/guia')
  await page.getByLabel('Nombre del grupo').fill('Privado')
  await page.getByRole('button', { name: 'Crear grupo' }).click()
  await expect(page.getByRole('heading', { name: 'Privado' })).toBeVisible()
  const other = await loginAs(browser, intruder, '/guia')
  const res = await other.goto(page.url())
  expect(res?.status()).toBe(404)
})

test('sin sesión, /guia lleva a entrar', async ({ page }) => {
  await page.goto('/guia')
  await expect(page).toHaveURL(/\/entrar\?next=%2Fguia|\/entrar\?next=\/guia/)
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible()
})

test('si el servidor falla al guardar, la marca vuelve atrás y avisa', async ({ browser }) => {
  const page = await loginAs(browser, mail('offline'), '/cuenta')
  await page.route('**/api/learned', (route) => (route.request().method() === 'POST' ? route.fulfill({ status: 500 }) : route.continue()))
  await page.goto('/node/llm')
  const toggle = page.getByTestId('learned-toggle').first()
  await expect(toggle).toHaveAttribute('data-ready', 'true')
  await toggle.click()
  await expect(page.getByTestId('learned-error')).toHaveText('No se pudo guardar. Inténtalo de nuevo.')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
})

test('un enlace inventado muestra que no es válido', async ({ page }) => {
  await page.goto('/unirse/esto-no-existe')
  await expect(page.getByTestId('invite-invalid')).toHaveText('Este enlace ya no es válido. Pídele uno nuevo a tu guía.')
})
```

`loginAs` crea la persona si no existe. El alumno de prueba se registra sin invitación porque el login de prueba no pasa por el registro; lo que se prueba aquí es el canje y lo que ve cada rol. El registro por invitación ya está cubierto en `tests/auth.test.ts`.

- [ ] **Step 3: Correr los E2E y ver que pasan**

Run: `npx playwright test`
Expected: 35 passed (las 30 anteriores y las 5 nuevas). Si un selector por rol no encuentra el elemento, ajustar el texto del test al de la página (los textos están en la Task 10 y la Task 11), no al revés.

- [ ] **Step 4: Correr todo**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: todo pasa.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/accounts.spec.ts
git commit -m "test: E2E de invitar, unirse, importar el avance, permisos y fallos al guardar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Después del plan: puesta en marcha (requiere al dueño del proyecto)

No es una tarea del plan porque necesita cuentas y decisiones del dueño. Se hace al final, con el PR abierto:

1. Instalar Neon y Resend desde el Marketplace de Vercel (`vercel integration add`), con ramas de Neon por vista previa activadas.
2. El dueño crea el cliente OAuth en Google Cloud con la URL de retorno `https://<dominio>/api/auth/callback/google` y carga `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en Vercel.
3. El dueño carga `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAILS` y `EMAIL_FROM` en Vercel.
4. Verificar el dominio de envío en Resend.
5. Probar en la vista previa del PR: entrar como administrador, autorizar un guía, crear un grupo y unirse con otra cuenta.
