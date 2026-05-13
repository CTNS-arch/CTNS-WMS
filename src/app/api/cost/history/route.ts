import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const LIMIT = 50

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const item      = searchParams.get('item')?.trim() || ''
    const workCode  = searchParams.get('workCode')?.trim() || ''
    const dateFrom  = searchParams.get('dateFrom') || ''
    const dateTo    = searchParams.get('dateTo') || ''
    const page      = Math.max(1, Number(searchParams.get('page') || 1))

    const where: any = {
      actualReceiptDate: { not: null },
    }

    if (item) {
      where.OR = [
        { bomNo: { contains: item, mode: 'insensitive' } },
        { spec:  { contains: item, mode: 'insensitive' } },
        { item:  { itemCode: { contains: item, mode: 'insensitive' } } },
        { item:  { itemName: { contains: item, mode: 'insensitive' } } },
      ]
    }

    if (workCode) {
      where.workCode = { contains: workCode, mode: 'insensitive' }
    }

    if (dateFrom) {
      where.actualReceiptDate = { ...where.actualReceiptDate, gte: new Date(dateFrom) }
    }

    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      where.actualReceiptDate = { ...where.actualReceiptDate, lte: to }
    }

    const [rows, total] = await Promise.all([
      prisma.purchaseRequestItem.findMany({
        where,
        include: {
          purchaseRequest: { select: { documentNo: true, department: true } },
          item: { select: { itemCode: true, itemName: true, unit: true } },
        },
        orderBy: { actualReceiptDate: 'desc' },
        skip: (page - 1) * LIMIT,
        take: LIMIT,
      }),
      prisma.purchaseRequestItem.count({ where }),
    ])

    return NextResponse.json({ success: true, data: { rows, total, page } })
  } catch (error: any) {
    console.error('[GET /api/cost/history]', error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
