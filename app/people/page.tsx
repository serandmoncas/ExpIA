import { Suspense } from 'react'
import { getCatalog } from '@/lib/content/load'
import { PeopleClient } from '@/components/people-client'

export const metadata = { title: 'Referentes' }

export default function PeoplePage() {
  const { people, nodes } = getCatalog()
  const topics = nodes.map((n) => ({ id: n.id, title: n.title })).sort((a, b) => a.title.localeCompare(b.title, 'es'))
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Referentes</h1>
      <p className="max-w-2xl text-muted-foreground">Personas y organizaciones que vale la pena seguir para aprender IA, con sus mejores recursos.</p>
      <Suspense>
        <PeopleClient people={people} topics={topics} />
      </Suspense>
    </div>
  )
}
