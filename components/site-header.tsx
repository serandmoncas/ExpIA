import Link from 'next/link'
import { AudienceToggle } from './audience-toggle'

const NAV = [
  { href: '/', label: 'Inicio' },
  { href: '/timeline', label: 'Línea de tiempo' },
  { href: '/explore', label: 'Explorar' },
  { href: '/graph', label: 'Mapa' },
]

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/" className="text-base font-bold">ExpIA</Link>
          {NAV.slice(1).map((n) => (
            <Link key={n.href} href={n.href} className="text-muted-foreground hover:text-foreground">{n.label}</Link>
          ))}
        </nav>
        <AudienceToggle />
      </div>
    </header>
  )
}
