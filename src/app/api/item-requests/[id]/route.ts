import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 })
    }

    const canWrite = session.user.roles?.includes('ITEM_WRITE') || session.user.roles?.includes('MASTER_ADMIN')
    if (!canWrite) {
      return NextResponse.json({ success: false, message: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params
    const { status, reviewMemo } = await req.json()

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ success: false, message: '잘못된 상태값입니다.' }, { status: 400 })
    }

    const updated = await prisma.itemCreateRequest.update({
      where: { id },
      data: { status, reviewMemo: reviewMemo?.trim() || null },
      include: { requester: { select: { name: true, email: true } } },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ success: false, message: '요청을 찾을 수 없습니다.' }, { status: 404 })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { id } = await params
    const record = await prisma.itemCreateRequest.findUnique({ where: { id } })
    if (!record) {
      return NextResponse.json({ success: false, message: '요청을 찾을 수 없습니다.' }, { status: 404 })
    }

    const canWrite = session.user.roles?.includes('ITEM_WRITE') || session.user.roles?.includes('MASTER_ADMIN')
    const isOwner  = record.requesterId === session.user.id
    if (!canWrite && !isOwner) {
      return NextResponse.json({ success: false, message: '권한이 없습니다.' }, { status: 403 })
    }
    if (!canWrite && record.status !== 'PENDING') {
      return NextResponse.json({ success: false, message: '검토중 상태의 요청만 삭제할 수 있습니다.' }, { status: 400 })
    }

    await prisma.itemCreateRequest.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
