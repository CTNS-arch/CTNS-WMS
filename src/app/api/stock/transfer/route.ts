import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { StockTxType } from '@prisma/client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { itemId, fromDept, toDept, quantity, memo, userId } = body

    if (!itemId || !fromDept || !toDept || quantity == null) {
      return NextResponse.json(
        { success: false, message: 'itemId, fromDept, toDept, quantity는 필수입니다.' },
        { status: 400 },
      )
    }
    if (Number(quantity) <= 0) {
      return NextResponse.json({ success: false, message: '수량은 0보다 커야 합니다.' }, { status: 400 })
    }
    if (fromDept === toDept) {
      return NextResponse.json({ success: false, message: '출발 부서와 도착 부서가 같을 수 없습니다.' }, { status: 400 })
    }

    const qty = Number(quantity)

    await prisma.$transaction(async (tx) => {
      const fromStock = await tx.stock.findUnique({
        where: { itemId_department: { itemId, department: fromDept } },
      })

      if (!fromStock || fromStock.quantity < qty) {
        throw new Error('이관 수량이 재고를 초과합니다.')
      }

      await tx.stock.update({
        where: { itemId_department: { itemId, department: fromDept } },
        data: { quantity: { decrement: qty } },
      })

      await tx.stock.upsert({
        where: { itemId_department: { itemId, department: toDept } },
        create: { itemId, department: toDept, quantity: qty, memo: memo ?? null },
        update: { quantity: { increment: qty } },
      })

      await tx.stockTransaction.create({
        data: {
          itemId,
          type: StockTxType.TRANSFER,
          fromDept,
          toDept,
          quantity: qty,
          memo: memo ?? null,
          userId: userId ?? null,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[POST /api/stock/transfer]', error)
    const message = error?.message ?? '이관 처리 중 오류가 발생했습니다.'
    const status = message === '이관 수량이 재고를 초과합니다.' ? 400 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}
