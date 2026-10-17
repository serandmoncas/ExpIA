import Link from 'next/link'
import { getCatalog } from '@/lib/content/load'
import { formatWeek } from '@/lib/radar'

export const metadata = { title: 'Radar' }

export default function RadarPage() {
  const { reports } = getCatalog()
  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Radar</h1>
        <p className="text-muted-foreground">
          Cada semana, un agente revisa fuentes curadas y propone lo que vale la pena conocer. Una persona revisa cada informe antes de publicarlo.
        </p>
      </header>
      {reports.length === 0 ? (
        <p className="text-muted-foreground">Aún no hay informes.</p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.week} data-testid="report-link" className="rounded-lg border p-4">
              <Link href={`/radar/${r.week}`} className="font-semibold hover:underline">Semana del {formatWeek(r.week)}</Link>
              <p className="text-xs text-muted-foreground">{r.items.length} ítems · {r.proposals.length} cambios</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
