import { NextRequest, NextResponse } from 'next/server'

export async function proxy(req: NextRequest) {
  // Azure AD 미설정 시 인증 우회 (개발 중)
  if (!process.env.AZURE_AD_CLIENT_ID) {
    return NextResponse.next()
  }

  const { auth } = await import('@/auth')

  // NextAuth v5 미들웨어 콜백 패턴으로 세션 접근
  return (auth as any)((authReq: any) => {
    const session = authReq.auth

    // 외부 거래처 계정: /purchases 및 관련 API만 허용
    if (session?.user?.isExternal) {
      const { pathname } = authReq.nextUrl
      const allowed =
        pathname.startsWith('/purchases') ||
        pathname.startsWith('/api/purchases')
      if (!allowed) {
        return NextResponse.redirect(new URL('/purchases', authReq.url))
      }
      return NextResponse.next()
    }

    // 미로그인 시 로그인 페이지로
    if (!session) {
      return NextResponse.redirect(new URL('/login', authReq.url))
    }

    return NextResponse.next()
  })(req)
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)'],
}
