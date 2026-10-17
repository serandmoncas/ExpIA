import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalog } from '@/lib/content/load'
import { LABELS } from '@/lib/content/enums'
import { Badge } from '@/components/ui/badge'
import { Markdown } from '@/components/markdown'
import { PlatformLinks } from '@/components/platform-links'
import { HighlightList } from '@/components/highlight-list'

type Props = { params: Promise<{ id: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return getCatalog().people.map((p) => ({ id: p.id }))
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const person = getCatalog().peopleById.get(id)
  return person ? { title: person.name, description: person.summary } : {}
}

export default async function PersonPage({ params }: Props) {
  const { id } = await params
  const { peopleById, byId } = getCatalog()
  const person = peopleById.get(id)
  if (!person) notFound()
  const topicTitles = Object.fromEntries(person.topics.concat(person.highlights.flatMap((h) => (h.topic ? [h.topic] : []))).map((t) => [t, byId.get(t)!.title]))

  return (
    <article className="max-w-3xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">{person.name}</h1>
        <p className="text-lg text-muted-foreground">{person.summary}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">{LABELS[person.kind]}</Badge>
          <Badge variant="outline">{LABELS[person.level]}</Badge>
          {person.languages.map((l) => <Badge key={l} variant="outline">{LABELS[l]}</Badge>)}
        </div>
        <PlatformLinks platforms={person.platforms} />
        {!person.verified && (
          <p role="note" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            Perfil sin verificar: los enlaces y recursos aún no han sido revisados por una persona.
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Por qué seguirle</h2>
        <Markdown source={person.why} />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Recursos destacados</h2>
        <HighlightList person={person} topicTitles={topicTitles} />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Temas</h2>
        <div className="flex flex-wrap gap-2">
          {person.topics.map((t) => (
            <Link key={t} href={`/node/${t}`} className="rounded-full border px-3 py-1 text-sm hover:border-foreground/40">{topicTitles[t]}</Link>
          ))}
        </div>
      </section>
    </article>
  )
}
