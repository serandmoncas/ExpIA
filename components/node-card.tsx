import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { LABELS } from '@/lib/content/enums'
import { formatReleased } from '@/lib/dates'
import type { NodeMeta } from '@/lib/content/types'
import type { Category } from '@/lib/content/schema'

export function NodeCard({ node, categories }: { node: NodeMeta; categories: Category[] }) {
  const cats = node.category.map((id) => categories.find((c) => c.id === id)).filter((c): c is Category => !!c)
  return (
    <Link
      href={`/node/${node.id}`}
      data-testid="node-card"
      className="block rounded-lg border p-4 transition hover:border-foreground/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">{node.title}</h3>
        <span className="shrink-0 text-xs text-muted-foreground">{formatReleased(node.date)}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{node.summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{LABELS[node.kind]}</Badge>
        <Badge variant="outline">{LABELS[node.level]}</Badge>
        {(node.status === 'emerging' || node.status === 'rising') && <Badge>{LABELS[node.status]}</Badge>}
        {cats.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
      </div>
    </Link>
  )
}
