import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Department, StockTxType } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const department = (searchParams.get('department') ?? 'LAB') as Department
    const search = searchParams.get('search') ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10))
    const skip = (page - 1) * limit

    const where: any = {}
    if (search) {
      where.OR = [
        { itemCode: { contains: search, mode: 'insensitive' } },
        { itemName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        include: { stocks: { where: { department } } },
        orderBy: { itemCode: 'asc' },
        skip,
        take: limit,
      }),
      prisma.item.count({ where }),
    ])

    const data = items.map(item => {
      const stock = item.stocks[0] ?? null
      return {
        itemId: item.id,
        stockId: stock?.id ?? null,
        itemCode: item.itemCode,
        itemName: item.itemName,
        unit: item.unit,
        category: item.category,
        subCategory: item.subCategory,
        department,
        quantity: stock?.quantity ?? 0,
      }
    })

    return NextResponse.json({ success: true, data: { items: data, total, page, limit } })
  } catch (err: any) {
    console.error('[GET /api/stock]', err)
    return NextResponse.json({ success: false, message: err.message ?? '재고 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { itemId, department, type, quantity, memo, userId } = body

    if (!itemId || !department || !type || quantity == null) {
      return NextResponse.json({ success: false, message: 'itemId, department, type, quantity는 필수입니다.' }, { status: 400 })
    }
    const qty = Number(quantity)
    if (qty <= 0) {
      return NextResponse.json({ success: false, message: '수량은 0보다 커야 합니다.' }, { status: 400 })
    }

    const stock = await prisma.$transaction(async tx => {
      if (type === StockTxType.IN) {
        const updated = await tx.stock.upsert({
          where: { itemId_department: { itemId, department } },
          create: { itemId, department, quantity: qty },
          update: { quantity: { increment: qty } },
        })
        await tx.stockTransaction.create({
          data: { itemId, type: StockTxType.IN, toDept: department, quantity: qty, memo: memo ?? null, userId: userId ?? null },
        })
        return updated
      }

      if (type === StockTxType.OUT) {
        const existing = await tx.stock.findUnique({ where: { itemId_department: { itemId, department } } })
        if (!existing || existing.quantity < qty) throw new Error('재고가 부족합니다.')
        const updated = await tx.stock.update({
          where: { itemId_department: { itemId, department } },
          data: { quantity: { decrement: qty } },
        })
        await tx.stockTransaction.create({
          data: { itemId, type: StockTxType.OUT, fromDept: department, quantity: qty, memo: memo ?? null, userId: userId ?? null },
        })
        return updated
      }

      if (type === StockTxType.ADJUST) {
        const updated = await tx.stock.upsert({
          where: { itemId_department: { itemId, department } },
          create: { itemId, department, quantity: qty },
          update: { quantity: qty },
        })
        await tx.stockTransaction.create({
          data: { itemId, type: StockTxType.ADJUST, toDept: department, quantity: qty, memo: memo ?? null, userId: userId ?? null },
        })
        return updated
      }

      throw new Error('지원하지 않는 트랜잭션 유형입니다.')
    })

    return NextResponse.json({ success: true, data: stock })
  } catch (err: any) {
    console.error('[POST /api/stock]', err)
    const msg = err?.message ?? '재고 처리 중 오류가 발생했습니다.'
    return NextResponse.json({ success: false, message: msg }, { status: msg === '재고가 부족합니다.' ? 400 : 500 })
  }
}
