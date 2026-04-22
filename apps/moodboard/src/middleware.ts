import { NextResponse, type NextRequest } from 'next/server'
import { updateSession, requireAuth } from '@speclyy/auth/middleware'

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const response = await updateSession(request)
  return requireAuth(request, response) ?? response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
