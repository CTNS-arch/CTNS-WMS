import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

async function requireAdmin() {
  const session = await auth()
  const roles: string[] = (session?.user as any)?.roles ?? []
  if (!roles.includes('MASTER_ADMIN')) return null
  return session
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ success: false, message: '권한이 없습니다.' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const data: any = {}

    if (body.name !== undefined) data.name = body.name.trim()
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.roles !== undefined) data.roles = body.roles
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, 12)

    const user = await prisma.externalUser.update({
      where: { id },
      data,
      select: { id: true, username: true, name: true, roles: true, isActive: true, createdAt: true },
    })
    return NextResponse.json({ success: true, data: user })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ success: false, message: '권한이 없습니다.' }, { status: 403 })
    }
    const { id } = await params
    await prisma.externalUser.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
