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

export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ success: false, message: '권한이 없습니다.' }, { status: 403 })
    }
    const users = await prisma.externalUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, username: true, name: true, roles: true, isActive: true, createdAt: true },
    })
    return NextResponse.json({ success: true, data: users })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ success: false, message: '권한이 없습니다.' }, { status: 403 })
    }
    const { username, password, name, roles } = await req.json()
    if (!username?.trim() || !password?.trim() || !name?.trim()) {
      return NextResponse.json({ success: false, message: '아이디, 비밀번호, 이름은 필수입니다.' }, { status: 400 })
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.externalUser.create({
      data: { username: username.trim(), passwordHash, name: name.trim(), roles: roles ?? [] },
      select: { id: true, username: true, name: true, roles: true, isActive: true, createdAt: true },
    })
    return NextResponse.json({ success: true, data: user }, { status: 201 })
  } catch (err: any) {
    if (err.code === 'P2002') {
      return NextResponse.json({ success: false, message: '이미 사용 중인 아이디입니다.' }, { status: 409 })
    }
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
