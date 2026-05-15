import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Department } from '@prisma/client'

// GET /api/stock/audit?department=LAB&page=1&limit=20
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const department = searchParams.get('department') as Department | null
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10))
    const limit = Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10))
    const skip  = (page - 1) * limit

    const where: any = {}
    if (department) where.department = department

    const [audits, total] = await Promise.all([
      prisma.stockAudit.findMany({
        where,
        orderBy: { auditedAt: 'desc' },
        skip,
        take: limit,
        include: {
          user:   { select: { name: true, email: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.stockAudit.count({ where }),
    ])

    return NextResponse.json({ success: true, data: { audits, total, page, limit } })
  } catch (err: any) {
    console.error('[GET /api/stock/audit]', err)
    return NextResponse.json({ success: false, message: err.message ?? '조회 실패' }, { status: 500 })
  }
}

// POST /api/stock/audit  { department, note?, auditedBy? }
// 현재 재고 스냅샷 생성
// Neon HTTP 어댑터: 중첩 create 미지원 → StockAudit 생성 후 StockAuditItem 별도 생성
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { department, note, auditedBy } = body

    if (!department || !['LAB', 'PRODUCTION'].includes(department)) {
      return NextResponse.json({ success: false, message: 'department(LAB|PRODUCTION) 필수' }, { status: 400 })
    }

    const dept = department as Department

    // 현재 재고 전체 조회 (Item 기준 — 재고 없는 품목도 포함)
    const items = await prisma.item.findMany({
      where: { status: 'ACTIVE' },
      include: { stocks: { where: { department: dept } } },
      orderBy: { itemCode: 'asc' },
    })

    // 1. StockAudit 헤더 생성
    const audit = await prisma.stockAudit.create({
      data: {
        department: dept,
        note: note?.trim() || null,
        auditedBy: auditedBy || null,
      },
    })

    // 2. StockAuditItem 개별 생성 (Neon HTTP 어댑터 중첩 create 미지원)
    for (const item of items) {
      await prisma.stockAuditItem.create({
        data: {
          auditId:     audit.id,
          itemId:      item.id,
          itemCode:    item.itemCode,
          itemName:    item.itemName,
          unit:        item.unit,
          category:    item.category    ?? null,
          subCategory: item.subCategory ?? null,
          systemQty:   item.stocks[0]?.quantity ?? 0,
        },
      })
    }

    // 3. 생성된 실사 전체 조회
    const full = await prisma.stockAudit.findUnique({
      where: { id: audit.id },
      include: {
        items: { orderBy: { itemCode: 'asc' } },
        user:  { select: { name: true, email: true } },
      },
    })

    return NextResponse.json({ success: true, data: full }, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/stock/audit]', err)
    return NextResponse.json({ success: false, message: err.message ?? '실사 생성 실패' }, { status: 500 })
  }
}
