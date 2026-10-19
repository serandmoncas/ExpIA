import { joinStart } from '@/lib/join'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return joinStart(req, (await params).token)
}
