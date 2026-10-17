'use client'
import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { resolveTopic } from '@/lib/people'

export function TopicPicker({ topics, selected, onChange }: { topics: { id: string; title: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const listId = useId()
  const [text, setText] = useState('')
  const titleOf = new Map(topics.map((t) => [t.id, t.title]))
  const tryAdd = (value: string) => {
    const id = resolveTopic(topics, value)
    if (!id) return
    if (!selected.includes(id)) onChange([...selected, id])
    setText('')
  }
  return (
    <div role="group" aria-label="Tema" className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-20 shrink-0 text-xs font-medium text-muted-foreground">Tema</span>
      <Input
        list={listId}
        placeholder="Agregar tema…"
        aria-label="Agregar tema"
        className="h-8 w-56"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          tryAdd(e.target.value)
        }}
        onKeyDown={(e) => e.key === 'Enter' && tryAdd(text)}
      />
      <datalist id={listId}>
        {topics.map((t) => <option key={t.id} value={t.title} />)}
      </datalist>
      {selected.map((id) => (
        <button
          key={id}
          type="button"
          aria-label={`Quitar ${titleOf.get(id) ?? id}`}
          onClick={() => onChange(selected.filter((s) => s !== id))}
          className="inline-flex items-center gap-1 rounded-full border border-foreground bg-foreground px-2.5 py-0.5 text-xs text-background"
        >
          {titleOf.get(id) ?? id} ×
        </button>
      ))}
    </div>
  )
}
