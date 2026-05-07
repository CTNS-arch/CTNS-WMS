import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { pathname } = req.nextUrl

  // 공개 경로 (인증 불필요)
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // API 라우트는 별도 처리하지 않음 (클라이언트에서 세션 확인)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // 미인증 상태면 로그인 페이지로 리다이렉트
  if (!req.auth) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
