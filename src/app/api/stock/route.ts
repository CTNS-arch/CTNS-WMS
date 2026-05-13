import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Department, StockTxType } from '@prisma/client'
import { toKRW, fetchLiveRates } from '@/lib/exchange-rates'

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
        memo: stock?.memo ?? null,
      }
    })

    // FIFO 원가 계산 (재고 레이어에서 가중평균 단가 산출)
    const itemIds = data.map(d => d.itemId)
    let costLayers: { itemId: string; unitCost: any; remainQty: number }[] = []
    try {
      if (itemIds.length > 0 && (prisma as any).stockCostLayer) {
        costLayers = await prisma.stockCostLayer.findMany({
          where: { itemId: { in: itemIds }, department, remainQty: { gt: 0 } },
          select: { itemId: true, unitCost: true, remainQty: true },
        })
      }
    } catch {}

    const costMap: Record<string, { totalValue: number; totalQty: number }> = {}
    for (const layer of costLayers) {
      if (!costMap[layer.itemId]) costMap[layer.itemId] = { totalValue: 0, totalQty: 0 }
      costMap[layer.itemId].totalValue += Number(layer.unitCost) * layer.remainQty
      costMap[layer.itemId].totalQty += layer.remainQty
    }

    // ItemCost 폴백: StockCostLayer 데이터 없는 품목에 ItemCost 최근 단가 사용
    const itemsWithNoCost = data.filter(d => !costMap[d.itemId] || costMap[d.itemId].totalQty === 0).map(d => d.itemId)
    const itemCostFallback: Record<string, number> = {}
    if (itemsWithNoCost.length > 0) {
      try {
        const [itemCosts, liveRates] = await Promise.all([
          prisma.itemCost.findMany({
            where: { itemId: { in: itemsWithNoCost } },
            orderBy: { createdAt: 'desc' },
            select: { itemId: true, unitPrice: true, currency: true },
          }),
          fetchLiveRates(),
        ])
        const krwMap: Record<string, number> = {}
        const anyMap: Record<string, number> = {}
        for (const c of itemCosts) {
          const krwVal = toKRW(Number(c.unitPrice), c.currency ?? 'KRW', liveRates)
          if (c.currency === 'KRW' && !krwMap[c.itemId]) krwMap[c.itemId] = Number(c.unitPrice)
          if (!anyMap[c.itemId]) anyMap[c.itemId] = krwVal
        }
        for (const id of itemsWithNoCost) {
          if (krwMap[id] !== undefined) itemCostFallback[id] = krwMap[id]
          else if (anyMap[id] !== undefined) itemCostFallback[id] = anyMap[id]
        }
      } catch {}
    }

    const dataWithCost = data.map(d => ({
      ...d,
      avgUnitCost: costMap[d.itemId]?.totalQty > 0
        ? costMap[d.itemId].totalValue / costMap[d.itemId].totalQty
        : (itemCostFallback[d.itemId] ?? null),
    }))

    return NextResponse.json({ success: true, data: { items: dataWithCost, total, page, limit } })
  } catch (err: any) {
    console.error('[GET /api/stock]', err)
    return NextResponse.json({ success: false, message: err.message ?? '재고 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { itemId, department, type, quantity, memo, userId, unitCost, currency = 'KRW' } = body

    if (!itemId || !department || !type || quantity == null) {
      return NextResponse.json({ success: false, message: 'itemId, department, type, quantity는 필수입니다.' }, { status: 400 })
    }
    const qty = Number(quantity)
    if (qty <= 0) {
      return NextResponse.json({ success: false, message: '수량은 0보다 커야 합니다.' }, { status: 400 })
    }

    // Neon HTTP 어댑터: $transaction 미지원 → 순차 실행
    let stock: any

    if (type === StockTxType.IN) {
      stock = await prisma.stock.upsert({
        where: { itemId_department: { itemId, department } },
        create: { itemId, department, quantity: qty },
        update: { quantity: { increment: qty } },
      })
      await prisma.stockTransaction.create({
        data: {
          itemId, type: StockTxType.IN, toDept: department, quantity: qty,
          memo: memo ?? null, userId: userId ?? null,
          unitCost: unitCost != null ? Number(unitCost) : null,
          currency: unitCost != null ? (currency ?? 'KRW') : null,
        },
      })
    } else if (type === StockTxType.OUT) {
      const existing = await prisma.stock.findUnique({ where: { itemId_department: { itemId, department } } })
      if (!existing || existing.quantity < qty) throw new Error('재고가 부족합니다.')
      stock = await prisma.stock.update({
        where: { itemId_department: { itemId, department } },
        data: { quantity: { decrement: qty } },
      })
      await prisma.stockTransaction.create({
        data: { itemId, type: StockTxType.OUT, fromDept: department, quantity: qty, memo: memo ?? null, userId: userId ?? null },
      })
    } else if (type === StockTxType.ADJUST) {
      stock = await prisma.stock.upsert({
        where: { itemId_department: { itemId, department } },
        create: { itemId, department, quantity: qty },
        update: { quantity: qty },
      })
      await prisma.stockTransaction.create({
        data: {
          itemId, type: StockTxType.ADJUST, toDept: department, quantity: qty,
          memo: memo ?? null, userId: userId ?? null,
          unitCost: unitCost != null ? Number(unitCost) : null,
          currency: unitCost != null ? (currency ?? 'KRW') : null,
        },
      })
    } else {
      throw new Error('지원하지 않는 트랜잭션 유형입니다.')
    }

    // FIFO 원가 레이어 업데이트 (재고 트랜잭션과 분리 — 실패 시 재고에 영향 없음)
    try {
      await updateCostLayers({ itemId, department: department as Department, type, qty, unitCost, currency })
    } catch (costErr: any) {
      console.error('[stock cost layer]', costErr)
    }

    return NextResponse.json({ success: true, data: stock })
  } catch (err: any) {
    console.error('[POST /api/stock]', err)
    const msg = err?.message ?? '재고 처리 중 오류가 발생했습니다.'
    return NextResponse.json({ success: false, message: msg }, { status: msg === '재고가 부족합니다.' ? 400 : 500 })
  }
}

async function updateCostLayers({
  itemId, department, type, qty, unitCost, currency = 'KRW',
}: {
  itemId: string
  department: Department
  type: string
  qty: number
  unitCost: any
  currency?: string
}) {
  if (type === StockTxType.IN) {
    if (unitCost != null && Number(unitCost) > 0) {
      await prisma.stockCostLayer.create({
        data: { itemId, department, unitCost: Number(unitCost), currency, origQty: qty, remainQty: qty },
      })
    }
    return
  }

  if (type === StockTxType.OUT) {
    const layers = await prisma.stockCostLayer.findMany({
      where: { itemId, department, remainQty: { gt: 0 } },
      orderBy: { createdAt: 'asc' }, // 선입선출: 오래된 레이어부터
    })
    let toConsume = qty
    const fullyConsumedIds: string[] = []
    let partialId: string | null = null
    let partialRemain = 0

    for (const layer of layers) {
      if (toConsume <= 0) break
      if (layer.remainQty <= toConsume) {
        fullyConsumedIds.push(layer.id)
        toConsume -= layer.remainQty
      } else {
        partialId = layer.id
        partialRemain = layer.remainQty - toConsume
        toConsume = 0
      }
    }

    if (fullyConsumedIds.length > 0) {
      await prisma.stockCostLayer.updateMany({
        where: { id: { in: fullyConsumedIds } },
        data: { remainQty: 0 },
      })
    }
    if (partialId) {
      await prisma.stockCostLayer.update({
        where: { id: partialId },
        data: { remainQty: partialRemain },
      })
    }
    return
  }

  if (type === StockTxType.ADJUST) {
    const layers = await prisma.stockCostLayer.findMany({
      where: { itemId, department, remainQty: { gt: 0 } },
    })
    const totalRemain = layers.reduce((sum, l) => sum + l.remainQty, 0)

    if (totalRemain <= 0) {
      // 기존 레이어 없음 → 단가 있으면 신규 레이어 생성
      if (unitCost != null && Number(unitCost) > 0) {
        await prisma.stockCostLayer.create({
          data: { itemId, department, unitCost: Number(unitCost), currency, origQty: qty, remainQty: qty },
        })
      }
    } else {
      const ratio = qty / totalRemain
      if (ratio <= 0) {
        await prisma.stockCostLayer.deleteMany({ where: { itemId, department } })
      } else {
        for (const layer of layers) {
          await prisma.stockCostLayer.update({
            where: { id: layer.id },
            data: { remainQty: Math.max(0, layer.remainQty * ratio) },
          })
        }
      }
    }
  }
}
