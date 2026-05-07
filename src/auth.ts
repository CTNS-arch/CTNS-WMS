import NextAuth from "next-auth"
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { writeFileSync } from "fs"
import { join } from "path"

const logFile = join(process.cwd(), "auth-debug.log")

function writeLog(msg: string) {
  try {
    writeFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`, { flag: "a" })
  } catch {}
}

function debugAdapter(adapter: ReturnType<typeof PrismaAdapter>) {
  return Object.fromEntries(
    Object.entries(adapter).map(([key, fn]) => [
      key,
      async (...args: unknown[]) => {
        try {
          return await (fn as (...a: unknown[]) => unknown)(...args)
        } catch (e) {
          writeLog(`ADAPTER_FAIL [${key}]: ${e instanceof Error ? e.stack : JSON.stringify(e)}`)
          throw e
        }
      },
    ])
  ) as ReturnType<typeof PrismaAdapter>
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  adapter: debugAdapter(PrismaAdapter(prisma)),
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
  logger: {
    error(error) {
      writeLog(`ERROR: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object))}`)
    },
    warn(code) {
      writeLog(`WARN: ${code}`)
    },
    debug(code, metadata) {
      writeLog(`DEBUG: ${code} ${JSON.stringify(metadata)}`)
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id
      return token
    },
    async session({ session, token }) {
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
