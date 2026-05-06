import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { roles } = body as { roles: UserRole[] }

    if (!Array.isArray(roles)) {
      return NextResponse.json(
        { success: false, error: '역할(roles) 값이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { roles },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('사용자 역할 수정 오류:', error)
    return NextResponse.json(
      { success: false, error: '사용자 역할 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}
