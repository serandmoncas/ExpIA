import Link from 'next/link'
import { getCatalog } from '@/lib/content/load'
import { PathList } from '@/components/path-list'

export const metadata = { title: 'Rutas de aprendizaje' }

export default function PathsPage() {
  const { paths } = getCatalog()
  return (
    <div className="max-w-4xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Rutas de aprendizaje</h1>
        <p className="text-muted-foreground">
          Cada ruta ordena los conceptos según lo que necesitas saber antes. Marca cada paso con «Lo aprendí»: tu progreso se guarda en este navegador.
        </p>
      </header>
      <PathList paths={paths} />
      <p className="text-sm text-muted-foreground">
        ¿Quieres aprender un tema concreto? Abre cualquier ficha desde{' '}
        <Link href="/explore" className="underline underline-offset-4">Explorar</Link> y usa <em>Aprender desde cero</em>.
      </p>
    </div>
  )
}
