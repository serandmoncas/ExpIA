import Link from 'next/link'
import { LABELS } from '@/lib/content/enums'
import type { Proposal } from '@/lib/content/schema'
import { Badge } from '@/components/ui/badge'

export function ProposalList({ proposals, nodeTitles, personNames }: { proposals: Proposal[]; nodeTitles: Record<string, string>; personNames: Record<string, string> }) {
  if (proposals.length === 0) return <p className="text-sm text-muted-foreground">No hubo cambios en el catálogo esta semana.</p>
  return (
    <ul className="space-y-3 text-sm">
      {proposals.map((p, i) => {
        const onNode = p.type === 'status' || p.type === 'new-node'
        const href = onNode ? `/node/${p.target}` : `/people/${p.target}`
        const name = (onNode ? nodeTitles[p.target] : personNames[p.target]) ?? p.target
        return (
          <li key={`${p.type}-${p.target}-${i}`} className="space-y-1">
            <p className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{LABELS[p.type]}</Badge>
              <Link href={href} className="font-medium hover:underline">{name}</Link>
              {p.type === 'status' && p.from && p.to && (
                <span className="text-muted-foreground">{LABELS[p.from]} → {LABELS[p.to]}</span>
              )}
            </p>
            <p className="text-muted-foreground">{p.reason}</p>
            <p className="flex flex-wrap gap-3 text-xs">
              {p.evidence.map((url, j) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="underline underline-offset-4">Evidencia {j + 1}</a>
              ))}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
