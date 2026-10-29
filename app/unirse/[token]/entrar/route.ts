import { joinStart } from '@/lib/join'

export const dynamic = 'force-dynamic'

async function handler(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return joinStart(req, (await params).token)
}

// GET no deja cookie: solo redirige a la invitación. El POST viene del botón de la página
export { handler as GET, handler as POST }
