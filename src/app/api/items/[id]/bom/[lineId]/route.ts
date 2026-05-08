import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  try {
    const { lineId } = await params
    const { quantity, unit, memo } = await req.json()

    if (quantity == null || !unit)
      return NextResponse.json({ success: false, message: '수량과 단위를 입력하세요.' }, { status: 400 })

    await prisma.bOM.update({
      where: { id: lineId },
      data: { quantity: parseFloat(quantity), unit, memo: memo || null },
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err.code === 'P2025')
      return NextResponse.json({ success: false, message: 'BOM 항목을 찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  try {
    const { lineId } = await params
    await prisma.bOM.delete({ where: { id: lineId } })
    return NextResponse.json({ success: true, message: '삭제되었습니다.' })
  } catch (err: any) {
    if (err.code === 'P2025')
      return NextResponse.json({ success: false, message: 'BOM 항목을 찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
