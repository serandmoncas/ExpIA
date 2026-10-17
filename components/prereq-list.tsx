import Link from 'next/link'
import { LABELS } from '@/lib/content/enums'
import type { NodeMeta } from '@/lib/content/types'

export function PrereqList({ nodes }: { nodes: NodeMeta[] }) {
  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">No tiene prerrequisitos: es un buen punto de partida.</p>
  }
  return (
    <ol className="space-y-1.5 text-sm">
      {nodes.map((n, i) => (
        <li key={n.id} className="flex items-baseline gap-2">
          <span className="w-5 shrink-0 text-right text-muted-foreground">{i + 1}.</span>
          <Link href={`/node/${n.id}`} className="hover:underline">{n.title}</Link>
          <span className="text-xs text-muted-foreground">{LABELS[n.level]}</span>
        </li>
      ))}
    </ol>
  )
}
