import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        bomAsParent: { include: { child: true } },
        bomAsChild: { include: { parent: true } },
      },
    })
    if (!item) return NextResponse.json({ success: false, message: '품목을 찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json({ success: true, data: item })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const item = await prisma.item.update({ where: { id }, data: body })
    return NextResponse.json({ success: true, data: item })
  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ success: false, message: '품목을 찾을 수 없습니다.' }, { status: 404 })
    if (err.code === 'P2002') return NextResponse.json({ success: false, message: '이미 존재하는 품번입니다.' }, { status: 409 })
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const bomCount = await prisma.bOM.count({ where: { OR: [{ parentId: id }, { childId: id }] } })
    if (bomCount > 0)
      return NextResponse.json(
        { success: false, message: 'BOM에 사용 중인 품목입니다. BOM 구성을 먼저 해제해주세요.' },
        { status: 409 }
      )
    await prisma.item.delete({ where: { id } })
    return NextResponse.json({ success: true, message: '삭제되었습니다.' })
  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ success: false, message: '품목을 찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
