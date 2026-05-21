import NextAuth from "next-auth"
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { listActiveOrgUsers, isOrgUserActive } from "@/lib/ms-graph"

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers: [
    MicrosoftEntraId({
      clientId: process.env.AZURE_AD_CLIENT_ID ?? '',
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? '',
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false
      // 관리자가 차단한 계정 확인
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email.toLowerCase() },
        select: { roles: true },
      }).catch(() => null)
      if (dbUser?.roles.includes('ACCESS_BLOCKED')) return '/login?error=AccessDenied'
      try {
        const msUsers = await listActiveOrgUsers()
        const emailLower = user.email.toLowerCase()
        const isActive = msUsers.some(
          mu => (mu.mail ?? mu.userPrincipalName).toLowerCase() === emailLower
        )
        if (!isActive) return '/login?error=AccessDenied'
      } catch (err) {
        // Graph API 장애 시 Azure AD 인증 자체에 위임 (fail open)
        console.error('[signIn] MS Graph 검증 실패, 로그인 허용:', err)
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user?.id) token.id = user.id
      if (account?.providerAccountId) token.msOid = account.providerAccountId

      // MS 계정 활성 여부 30분마다 재확인 (이메일/UPN 기준 — OID 불일치 방지)
      const MS_CHECK_INTERVAL = 30 * 60 * 1000
      const lastCheck = (token.lastMsCheck as number) ?? 0
      const checkId = (token.email as string | undefined) ?? (token.msOid as string | undefined)
      if (checkId && Date.now() - lastCheck > MS_CHECK_INTERVAL) {
        try {
          token.msActive = await isOrgUserActive(checkId)
        } catch {
          token.msActive = token.msActive ?? true // Graph API 장애 시 현재 상태 유지
        }
        token.lastMsCheck = Date.now()
      }
      return token
    },
    async session({ session, token }) {
      // MS에서 삭제/비활성화된 계정은 세션 무효화
      if (token.msActive === false) {
        return { ...session, user: undefined } as any
      }
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { roles: true },
        })
        session.user.id = token.id as string
        session.user.roles = dbUser?.roles ?? []
      }
      return session
    },
  },
})
