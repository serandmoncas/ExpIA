import { SignInForm } from '@/components/sign-in-form'
import { safeNext } from '@/lib/access'
import { messageFor } from '@/lib/messages'
import { accountsConfigured } from '@/lib/accounts-config'

export const metadata = { title: 'Entrar' }

const ERRORS: Record<string, string> = {
  not_invited: 'Necesitas una invitación para entrar. Pídesela a tu guía.',
}

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  if (!accountsConfigured()) return <p role="alert">Las cuentas todavía no están disponibles.</p>
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Entrar a ExpIA</h1>
      <p className="text-muted-foreground">ExpIA funciona por invitación. Si un guía te invitó, entra con el mismo correo.</p>
      {error && <p role="alert" className="text-destructive">{messageFor(ERRORS, error, 'No se pudo iniciar sesión. Inténtalo de nuevo.')}</p>}
      <SignInForm next={safeNext(next)} />
    </div>
  )
}
