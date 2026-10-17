import { LABELS, PLATFORMS, type Platform } from '@/lib/content/enums'

export function PlatformLinks({ platforms }: { platforms: Partial<Record<Platform, string>> }) {
  const entries = PLATFORMS.filter((p) => platforms[p]).map((p) => [p, platforms[p]!] as const)
  return (
    <ul className="flex flex-wrap gap-2 text-sm">
      {entries.map(([p, url]) => (
        <li key={p}>
          <a href={url} target="_blank" rel="noreferrer" className="inline-block rounded-md border px-2 py-0.5 hover:border-foreground/40">
            {LABELS[p]}
          </a>
        </li>
      ))}
    </ul>
  )
}
