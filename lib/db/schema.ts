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
