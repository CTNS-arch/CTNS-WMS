import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        roles: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '사용자 목록을 불러오는 데 실패했습니다.' },
      { status: 500 }
    )
  }
}
