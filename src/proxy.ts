import { NextRequest, NextResponse } from 'next/server'

export async function proxy(req: NextRequest) {
  // Azure AD 미설정 시 인증 우회 (개발 중)
  if (!process.env.AZURE_AD_CLIENT_ID) {
    return NextResponse.next()
  }

  const { auth } = await import('@/auth')
  return (auth as any)(req)
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)'],
}
