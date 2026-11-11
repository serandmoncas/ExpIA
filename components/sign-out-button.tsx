'use client'
import { authClient } from '@/lib/auth-client'
import { Button } from './ui/button'

export function SignOutButton() {
  return (
    <Button variant="outline" size="sm" onClick={async () => { await authClient.signOut(); window.location.href = '/' }}>
      Cerrar sesión
    </Button>
  )
}
