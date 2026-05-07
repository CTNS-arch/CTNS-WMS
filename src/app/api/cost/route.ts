import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const itemId = searchParams.get('itemId')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.max(1, parseInt(searchParams.get('limit') ?? '30', 10))
    const skip = (page - 1) * limit

    const where: any = {}
    if (itemId) where.itemId = itemId
    if (search?.trim()) {
      where.item = {
        OR: [
          { itemCode: { contains: search.trim(), mode: 'insensitive' } },
          { itemName: { contains: search.trim(), mode: 'insensitive' } },
        ],
      }
    }

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where: search?.trim() ? {
          OR: [
            { itemCode: { contains: search.trim(), mode: 'insensitive' } },
            { itemName: { contains: search.trim(), mode: 'insensitive' } },
          ],
        } : itemId ? { id: itemId } : {},
        skip,
        take: limit,
        orderBy: { itemCode: 'asc' },
        include: {
          costs: { orderBy: { createdAt: 'desc' } },
        },
      }),
      prisma.item.count({
        where: search?.trim() ? {
          OR: [
            { itemCode: { contains: search.trim(), mode: 'insensitive' } },
            { itemName: { contains: search.trim(), mode: 'insensitive' } },
          ],
        } : itemId ? { id: itemId } : {},
      }),
    ])

    return NextResponse.json({ success: true, data: { items, total, page, limit } })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { itemId, currency, unitPrice, supplier, note } = body

    if (!itemId || !currency || unitPrice == null) {
      return NextResponse.json({ success: false, message: 'itemId, currency, unitPrice는 필수입니다.' }, { status: 400 })
    }
    const price = Number(unitPrice)
    if (isNaN(price) || price < 0) {
      return NextResponse.json({ success: false, message: '단가는 0 이상의 숫자여야 합니다.' }, { status: 400 })
    }

    const cost = await prisma.itemCost.create({
      data: {
        itemId,
        currency,
        unitPrice: price,
        supplier: supplier?.trim() || null,
        note: note?.trim() || null,
      },
    })
    return NextResponse.json({ success: true, data: cost }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
