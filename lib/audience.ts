import type { SectionKey } from '@/lib/content/sections'

export type AudiencePref = 'all' | 'technical' | 'business'
export const AUDIENCE_KEY = 'expia.audience'

export function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function readAudience(storage?: Pick<Storage, 'getItem'>): AudiencePref {
  try {
    const v = storage?.getItem(AUDIENCE_KEY)
    return v === 'technical' || v === 'business' ? v : 'all'
  } catch {
    return 'all'
  }
}

export function writeAudience(storage: Pick<Storage, 'setItem'> | undefined, value: AudiencePref): void {
  try {
    storage?.setItem(AUDIENCE_KEY, value)
  } catch {
    // almacenamiento bloqueado: la preferencia vive solo en memoria
  }
}

export function sectionOrder(pref: AudiencePref): SectionKey[] {
  return pref === 'business' ? ['nonTechnical', 'purpose', 'usage'] : ['purpose', 'usage', 'nonTechnical']
}
