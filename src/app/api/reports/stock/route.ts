import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dept = searchParams.get('department') // LAB | PRODUCTION | null(전체)

    // ── 1. 현재 재고 현황 ──
    const stockWhere: any = {}
    if (dept) stockWhere.department = dept

    const stocks = await prisma.stock.findMany({
      where: stockWhere,
      include: { item: { select: { category: true, subCategory: true, itemCode: true, itemName: true, unit: true } } },
    })

    // 카테고리별 재고 합계
    const byCat: Record<string, number> = {}
    const topItems: { itemCode: string; itemName: string; unit: string; quantity: number; category: string }[] = []

    for (const s of stocks) {
      const cat = s.item.category
      byCat[cat] = (byCat[cat] ?? 0) + s.quantity
      topItems.push({
        itemCode: s.item.itemCode,
        itemName: s.item.itemName,
        unit: s.item.unit,
        quantity: s.quantity,
        category: cat,
      })
    }
    topItems.sort((a, b) => b.quantity - a.quantity)

    // ── 2. 최근 12개월 입출고 집계 ──
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
    twelveMonthsAgo.setDate(1)
    twelveMonthsAgo.setHours(0, 0, 0, 0)

    const txWhere: any = { createdAt: { gte: twelveMonthsAgo } }
    if (dept) txWhere.OR = [{ toDept: dept }, { fromDept: dept }]

    const transactions = await prisma.stockTransaction.findMany({
      where: txWhere,
      select: { type: true, quantity: true, createdAt: true },
    })

    // 월별 집계
    const monthMap: Record<string, { label: string; in: number; out: number; adjust: number }> = {}
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMap[key] = { label: `${d.getMonth() + 1}월`, in: 0, out: 0, adjust: 0 }
    }

    for (const tx of transactions) {
      const d = new Date(tx.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!monthMap[key]) continue
      if (tx.type === 'IN') monthMap[key].in += tx.quantity
      else if (tx.type === 'OUT') monthMap[key].out += tx.quantity
      else if (tx.type === 'ADJUST') monthMap[key].adjust += tx.quantity
    }

    const monthly = Object.entries(monthMap).map(([key, v]) => ({ key, ...v }))

    // ── 3. 최근 거래 이력 (20건) ──
    const recentTx = await prisma.stockTransaction.findMany({
      where: dept ? { OR: [{ toDept: dept as any }, { fromDept: dept as any }] } : {},
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { item: { select: { itemCode: true, itemName: true, unit: true } } },
    })

    // ── 4. 요약 통계 ──
    const totalIn = monthly.reduce((s, m) => s + m.in, 0)
    const totalOut = monthly.reduce((s, m) => s + m.out, 0)
    const totalStock = stocks.reduce((s, st) => s + st.quantity, 0)

    return NextResponse.json({
      success: true,
      data: {
        summary: { totalIn, totalOut, totalStock, itemCount: topItems.length },
        byCat,
        topItems: topItems.slice(0, 15),
        monthly,
        recentTx,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
