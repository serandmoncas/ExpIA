'use client'
import type { ReactNode } from 'react'
import { useAudience } from './audience-provider'
import { sectionOrder } from '@/lib/audience'
import { SECTION_HEADINGS, type SectionKey } from '@/lib/content/sections'

export function NodeSectionsView({ rendered }: { rendered: Record<SectionKey, ReactNode> }) {
  const { audience } = useAudience()
  return (
    <div className="space-y-8">
      {sectionOrder(audience).map((key) => (
        <section key={key}>
          <h2 className="mb-3 text-xl font-semibold">{SECTION_HEADINGS[key]}</h2>
          {rendered[key]}
        </section>
      ))}
    </div>
  )
}
