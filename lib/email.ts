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
