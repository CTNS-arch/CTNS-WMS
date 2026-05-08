import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await params

    const stocks = await prisma.stock.findMany({ where: { itemId } })
    const transactions = await prisma.stockTransaction.findMany({
      where: { itemId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    })

    return NextResponse.json({ success: true, data: { stocks, transactions } })
  } catch (error) {
    console.error('[GET /api/stock/[itemId]]', error)
    return NextResponse.json({ success: false, message: '재고 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await params
    const { department, memo } = await req.json()
    if (!department) return NextResponse.json({ success: false, message: 'department 필수' }, { status: 400 })

    const updated = await prisma.stock.updateMany({
      where: { itemId, department },
      data: { memo: memo ?? null },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[PATCH /api/stock/[itemId]]', error)
    return NextResponse.json({ success: false, message: '메모 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
