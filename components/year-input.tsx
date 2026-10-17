'use client'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'

export function YearInput({ label, value, onCommit }: { label: string; value?: number; onCommit: (v?: number) => void }) {
  const [text, setText] = useState(value?.toString() ?? '')
  useEffect(() => setText(value?.toString() ?? ''), [value])
  const commit = () => {
    if (text === '') return onCommit(undefined)
    if (/^\d{4}$/.test(text)) return onCommit(Number(text))
    setText(value?.toString() ?? '')
  }
  return (
    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {label}
      <Input
        inputMode="numeric"
        className="h-8 w-20"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </label>
  )
}
