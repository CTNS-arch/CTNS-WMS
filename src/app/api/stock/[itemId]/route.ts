import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await params

    const [stocks, transactions] = await Promise.all([
      prisma.stock.findMany({ where: { itemId } }),
      prisma.stockTransaction.findMany({
        where: { itemId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    return NextResponse.json({ success: true, data: { stocks, transactions } })
  } catch (error) {
    console.error('[GET /api/stock/[itemId]]', error)
    return NextResponse.json({ success: false, message: '재고 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
