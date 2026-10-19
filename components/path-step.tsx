'use client'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LABELS } from '@/lib/content/enums'
import { getVoicesForTopic } from '@/lib/people'
import { nextStep, type StepView } from '@/lib/paths'
import { useAudience } from './audience-provider'
import { useLearned } from './learned-provider'
import { LearnedToggle } from './learned-toggle'
import { ReviewQuestions } from './review-questions'

export function PathSteps({ steps }: { steps: StepView[] }) {
  const { learned, ready } = useLearned()
  const { audience } = useAudience()
  const next = ready ? nextStep(steps.map((s) => s.node.id), learned) : undefined
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => {
        const isNext = s.node.id === next
        const voices = getVoicesForTopic(s.voices, s.node.id, audience).slice(0, 2)
        return (
          <li
            key={s.node.id}
            data-testid="path-step"
            data-node={s.node.id}
            data-next={isNext || undefined}
            className={cn('space-y-3 rounded-lg border p-4', isNext && 'border-foreground')}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground">
                  Paso {i + 1} · {LABELS[s.node.level]}{isNext ? ' · Siguiente' : ''}
                </p>
                <h2 className="text-lg font-semibold">
                  <Link href={`/node/${s.node.id}`} className="hover:underline">{s.node.title}</Link>
                </h2>
                <p className="text-sm text-muted-foreground">{s.node.summary}</p>
              </div>
              <LearnedToggle nodeId={s.node.id} title={s.node.title} />
            </div>
            {s.note && <p className="rounded-md bg-muted px-3 py-2 text-sm">{s.note}</p>}
            <ReviewQuestions review={s.node.review} />
            {voices.length > 0 && (
              <p className="text-xs text-muted-foreground">
                A quién seguir:{' '}
                {voices.map((p, j) => (
                  <span key={p.id}>{j > 0 && ', '}<Link href={`/people/${p.id}`} className="underline underline-offset-4">{p.name}</Link></span>
                ))}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
