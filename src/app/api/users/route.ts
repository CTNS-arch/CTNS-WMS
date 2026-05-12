import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, roles: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ success: true, data: users })
  } catch {
    return NextResponse.json({ success: false, message: '사용자 목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}
