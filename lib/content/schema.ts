import { z } from 'zod'
import { KINDS, AUDIENCES, LEVELS, STATUSES, LICENSES, PRICINGS, LANGUAGES, PERSON_KINDS, HIGHLIGHT_FORMATS } from './enums'
import { parseReleased } from '@/lib/dates'

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'debe ser kebab-case')
// js-yaml con JSON_SCHEMA deja 2020-05-22 como texto, pero `2020` llega como número
const yamlString = z.union([z.string(), z.number()]).transform(String)

const released = yamlString.refine((s) => {
  try {
    parseReleased(s)
    return true
  } catch {
    return false
  }
}, 'debe ser YYYY, YYYY-MM o YYYY-MM-DD válido')

const added = yamlString.refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s), 'debe ser YYYY-MM-DD')

export const nodeFrontmatterSchema = z
  .object({
    id,
    title: z.string().min(1),
    kind: z.enum(KINDS),
    category: z.array(z.string()).min(1),
    released,
    origin: z.string().optional(),
    audience: z.array(z.enum(AUDIENCES)).min(1),
    level: z.enum(LEVELS),
    requires: z.array(id).default([]),
    related: z.array(id).default([]),
    status: z.enum(STATUSES),
    license: z.enum(LICENSES).optional(),
    pricing: z.enum(PRICINGS).optional(),
    links: z
      .object({
        docs: z.string().url().optional(),
        paper: z.string().url().optional(),
        repo: z.string().url().optional(),
        site: z.string().url().optional(),
      })
      .strict()
      .default({}),
    summary: z.string().min(1).max(160),
    verified: z.boolean(),
    added,
  })
  .strict()

export const taxonomySchema = z.object({
  categories: z
    .array(z.object({ id, label: z.string().min(1), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }))
    .min(1),
})

const url = z.string().url()

export const personFrontmatterSchema = z
  .object({
    id,
    name: z.string().min(1),
    kind: z.enum(PERSON_KINDS),
    languages: z.array(z.enum(LANGUAGES)).min(1),
    topics: z.array(id).min(1),
    audience: z.array(z.enum(AUDIENCES)).min(1),
    level: z.enum(LEVELS),
    summary: z.string().min(1).max(160),
    platforms: z
      .object({
        youtube: url.optional(),
        x: url.optional(),
        linkedin: url.optional(),
        github: url.optional(),
        blog: url.optional(),
        podcast: url.optional(),
        newsletter: url.optional(),
        site: url.optional(),
      })
      .strict()
      .refine((p) => Object.values(p).some(Boolean), 'debe tener al menos una plataforma'),
    highlights: z
      .array(
        z
          .object({
            title: z.string().min(1),
            url,
            format: z.enum(HIGHLIGHT_FORMATS),
            topic: id.optional(),
            language: z.enum(LANGUAGES).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(5),
    feeds: z.object({ youtubeChannelId: z.string().optional(), rss: url.optional() }).strict().optional(),
    verified: z.boolean(),
    added,
  })
  .strict()

export type NodeFrontmatter = z.infer<typeof nodeFrontmatterSchema>
export type Category = z.infer<typeof taxonomySchema>['categories'][number]
export type PersonFrontmatter = z.infer<typeof personFrontmatterSchema>
