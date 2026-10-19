import type { ReviewItem } from '@/lib/content/schema'

export function ReviewQuestions({ review }: { review?: ReviewItem[] }) {
  if (!review?.length) return <p className="text-sm text-muted-foreground">Sin preguntas de repaso aún.</p>
  return (
    <ol data-testid="review-questions" className="space-y-2 text-sm">
      {review.map((r) => (
        <li key={r.question} className="rounded-md border p-3">
          <p className="font-medium">{r.question}</p>
          <details className="mt-1">
            <summary className="cursor-pointer text-muted-foreground">Ver respuesta</summary>
            <p className="mt-1">{r.answer}</p>
          </details>
        </li>
      ))}
    </ol>
  )
}
