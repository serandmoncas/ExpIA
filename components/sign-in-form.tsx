'use client'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from './ui/button'
import { Input } from './ui/input'

export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  if (sent) return <p data-testid="magic-sent">Revisa tu correo: te enviamos un enlace para entrar. Vence en 10 minutos.</p>

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <Button onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: next, errorCallbackURL: '/entrar' })}>
        Entrar con Google
      </Button>
      <form
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          await authClient.signIn.magicLink({ email, callbackURL: next, errorCallbackURL: '/entrar' })
          setBusy(false)
          setSent(true)
        }}
      >
        <label htmlFor="email" className="text-sm">O recibe un enlace en tu correo</label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" variant="outline" disabled={busy}>Enviarme el enlace</Button>
      </form>
    </div>
  )
}
