'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FilterBar } from './filter-bar'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { applyFilters } from '@/lib/filters'
import { createSearch } from '@/lib/search'
import { layoutTimeline, tickStep } from '@/lib/timeline'
import { LABELS } from '@/lib/content/enums'
import type { NodeMeta } from '@/lib/content/types'
import type { Category } from '@/lib/content/schema'

const ROW_H = 28
const AXIS_H = 28
const LABEL_W = 170

export function TimelineClient({ nodes, categories }: { nodes: NodeMeta[]; categories: Category[] }) {
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories])
  const [filters, setFilters] = useUrlFilters(categoryIds)
  const [pxPerYear, setPxPerYear] = useState(40)
  const search = useMemo(() => createSearch(nodes), [nodes])
  const visible = useMemo(() => applyFilters(search(filters.q), filters), [search, filters])
  const colorOf = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.color]))
    return (id: string) => m.get(id) ?? '#888888'
  }, [categories])
  const layout = useMemo(
    () => layoutTimeline(visible, colorOf, { pxPerYear, maxYear: new Date().getFullYear() + 1, labelWidth: LABEL_W }),
    [visible, colorOf, pxPerYear],
  )
  // Abrir desplazado al final: lo reciente es lo más consultado
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasItems = layout.items.length > 0
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [hasItems])
  const step = tickStep(pxPerYear)
  const ticks: number[] = []
  for (let y = layout.minYear; y <= layout.maxYear; y += step) ticks.push(y)
  const height = AXIS_H + layout.totalRows * ROW_H + 8

  return (
    <div className="space-y-4">
      <FilterBar categories={categories} filters={filters} onChange={setFilters} />
      <label className="flex items-center gap-3 text-sm text-muted-foreground">
        Zoom
        <input type="range" min={10} max={160} value={pxPerYear} onChange={(e) => setPxPerYear(Number(e.target.value))} className="w-48" />
      </label>
      {layout.items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">Ningún nodo coincide con estos filtros.</p>
      ) : (
        <div className="flex rounded-lg border">
          <div className="relative w-28 shrink-0 border-r text-xs font-medium text-muted-foreground" style={{ height }}>
            {layout.lanes.map((lane) => (
              <div key={lane.kind} className="absolute left-2 border-t pt-1" style={{ top: AXIS_H + lane.startRow * ROW_H, right: 0 }}>
                {LABELS[lane.kind]}
              </div>
            ))}
          </div>
          <div ref={scrollRef} data-testid="timeline-scroll" className="overflow-x-auto">
            <svg width={layout.width + LABEL_W} height={height} className="block text-foreground">
              {ticks.map((y) => {
                const x = (y - layout.minYear) * pxPerYear
                return (
                  <g key={y}>
                    <line x1={x} x2={x} y1={AXIS_H - 6} y2={height} stroke="currentColor" strokeOpacity={0.08} />
                    <text x={x + 3} y={16} fontSize={11} fill="currentColor" fillOpacity={0.6}>{y}</text>
                  </g>
                )
              })}
              {layout.lanes.map((lane) => (
                <line key={lane.kind} x1={0} x2={layout.width + LABEL_W} y1={AXIS_H + lane.startRow * ROW_H} y2={AXIS_H + lane.startRow * ROW_H} stroke="currentColor" strokeOpacity={0.15} />
              ))}
              {layout.items.map((item) => {
                const y = AXIS_H + item.row * ROW_H
                return (
                  <a key={item.id} href={`/node/${item.id}`} aria-label={`${item.title}, ${item.dateLabel}`}>
                    <title>{`${item.title} · ${item.dateLabel}`}</title>
                    {item.width > 0 ? (
                      <rect x={item.x} y={y + 7} width={item.width} height={14} rx={3} fill={item.color} fillOpacity={0.3} stroke={item.color} />
                    ) : (
                      <circle cx={item.x} cy={y + 14} r={6} fill={item.color} />
                    )}
                    <text x={item.x + (item.width > 0 ? 4 : 10)} y={y + 18} fontSize={12} fill="currentColor">{item.title}</text>
                  </a>
                )
              })}
            </svg>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Las barras indican que solo se conoce el año; los puntos, una fecha más precisa.</p>
    </div>
  )
}
