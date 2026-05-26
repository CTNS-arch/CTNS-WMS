import NextAuth from "next-auth"
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { listActiveOrgUsers, isOrgUserActive } from "@/lib/ms-graph"
import bcrypt from "bcryptjs"

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
    Credentials({
      id: 'external',
      name: '외부 거래처',
      credentials: {
        username: { label: '아이디', type: 'text' },
        password: { label: '비밀번호', type: 'password' },
      },
      async authorize(credentials) {
        const username = credentials?.username as string | undefined
        const password = credentials?.password as string | undefined
        if (!username || !password) return null
        const extUser = await prisma.externalUser.findUnique({ where: { username } })
        if (!extUser || !extUser.isActive) return null
        const valid = await bcrypt.compare(password, extUser.passwordHash)
        if (!valid) return null
        return { id: `ext:${extUser.id}`, name: extUser.name, email: null } as any
      },
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
    async signIn({ user, account }) {
      // 외부 거래처 계정은 authorize에서 이미 검증 완료
      if (account?.provider === 'external') return true
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
      // 일반 로그인 계정 (ExternalUser)
      if (account?.provider === 'external' && user?.id?.startsWith('ext:')) {
        const extId = user.id.replace('ext:', '')
        const extUser = await prisma.externalUser.findUnique({
          where: { id: extId },
          select: { roles: true },
        }).catch(() => null)
        const extRoles = extUser?.roles ?? []
        token.extRoles = extRoles as string[]
        token.isExternal = extRoles.includes('VENDOR')
        token.externalName = user.name ?? ''
        token.id = user.id
        return token
      }

      if (user?.id) token.id = user.id
      if (account?.providerAccountId) token.msOid = account.providerAccountId

      // 일반 로그인 계정은 MS 검증 skip (extRoles가 있으면 external 계정)
      if (token.extRoles !== undefined) return token

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
      // 일반 로그인 계정 세션 (VENDOR 여부와 무관하게 extRoles가 있으면 external 계정)
      if (token.extRoles !== undefined) {
        session.user.id = token.id as string
        session.user.name = token.externalName as string
        session.user.roles = (token.extRoles as any[]) ?? []
        session.user.isExternal = token.isExternal ?? false
        return session
      }

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
