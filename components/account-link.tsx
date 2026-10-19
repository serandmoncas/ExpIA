'use client'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

export function AccountLink() {
  const { data, isPending } = authClient.useSession()
  if (isPending) return <span className="w-16" />
  return data ? (
    <Link href="/cuenta" data-testid="account-link" className="text-sm font-medium">{data.user.name}</Link>
  ) : (
    <Link href="/entrar" data-testid="account-link" className="text-sm text-muted-foreground hover:text-foreground">Entrar</Link>
  )
}
