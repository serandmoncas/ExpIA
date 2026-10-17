'use client'
import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { resolveTopic, resolveTopicLoose } from '@/lib/people'

export function TopicPicker({ topics, selected, onChange }: { topics: { id: string; title: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const listId = useId()
  const [text, setText] = useState('')
  const [noMatch, setNoMatch] = useState(false)
  const titleOf = new Map(topics.map((t) => [t.id, t.title]))
  const add = (id: string) => {
    if (!selected.includes(id)) onChange([...selected, id])
    setText('')
    setNoMatch(false)
  }
  return (
    <div role="group" aria-label="Tema" className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-20 shrink-0 text-xs font-medium text-muted-foreground">Tema</span>
      <Input
        list={listId}
        placeholder="Agregar tema…"
        aria-label="Agregar tema"
        aria-describedby={noMatch ? `${listId}-nomatch` : undefined}
        className="h-8 w-56"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setNoMatch(false)
          // Solo al elegir una sugerencia del datalist (no al teclear): así "Claude" no se
          // agrega a mitad de escribir "Claude Code"
          const inputType = (e.nativeEvent as InputEvent).inputType
          if (!inputType || inputType === 'insertReplacementText') {
            const id = resolveTopic(topics, e.target.value)
            if (id) add(id)
          }
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          const id = resolveTopicLoose(topics, text)
          if (id) add(id)
          else if (text.trim()) setNoMatch(true)
        }}
      />
      <datalist id={listId}>
        {topics.map((t) => <option key={t.id} value={t.title} />)}
      </datalist>
      {noMatch && (
        <span id={`${listId}-nomatch`} role="status" className="text-xs text-muted-foreground">Sin coincidencias</span>
      )}
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
