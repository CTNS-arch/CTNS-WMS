import { UserRole } from "@prisma/client"
import { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      roles: UserRole[]
      isExternal?: boolean  // true = VENDOR role (거래처 제한 접근)
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    isExternal?: boolean
    externalName?: string
    extRoles?: string[]   // ExternalUser 계정의 roles 배열
  }
}
