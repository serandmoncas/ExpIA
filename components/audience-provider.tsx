'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { readAudience, writeAudience, safeLocalStorage, type AudiencePref } from '@/lib/audience'

const AudienceContext = createContext<{ audience: AudiencePref; setAudience: (v: AudiencePref) => void }>({
  audience: 'all',
  setAudience: () => {},
})

export function AudienceProvider({ children }: { children: ReactNode }) {
  const [audience, setState] = useState<AudiencePref>('all')
  useEffect(() => setState(readAudience(safeLocalStorage())), [])
  const setAudience = (v: AudiencePref) => {
    setState(v)
    writeAudience(safeLocalStorage(), v)
  }
  return <AudienceContext.Provider value={{ audience, setAudience }}>{children}</AudienceContext.Provider>
}

export const useAudience = () => useContext(AudienceContext)
