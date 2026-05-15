import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { listActiveOrgUsers } from '@/lib/ms-graph'

export async function GET() {
  try {
    const [msUsers, dbUsers] = await Promise.all([
      listActiveOrgUsers(),
      prisma.user.findMany({
        select: { id: true, email: true, roles: true, createdAt: true, image: true },
      }),
    ])

    const dbByEmail = new Map(dbUsers.map(u => [u.email.toLowerCase(), u]))

    const merged = msUsers
      .map(mu => {
        const email = (mu.mail ?? mu.userPrincipalName).toLowerCase()
        const db = dbByEmail.get(email)
        return {
          msId: mu.id,
          dbId: db?.id ?? null,
          email,
          name: mu.displayName,
          image: db?.image ?? null,
          roles: db?.roles ?? [],
          hasLoggedIn: !!db,
          createdAt: db?.createdAt ?? null,
        }
      })
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko'))

    return NextResponse.json({ success: true, data: merged })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
