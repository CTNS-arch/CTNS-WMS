import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PurchaseStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = parseInt(searchParams.get('limit') ?? '20', 10)
    const skip = (page - 1) * limit

    const where: any = {}
    if (status && status !== '') {
      where.status = status as PurchaseStatus
    }
    if (search && search.trim() !== '') {
      where.itemName = { contains: search.trim(), mode: 'insensitive' }
    }

    const [requests, total] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requester: { select: { name: true, email: true } },
          item: { select: { itemCode: true } },
        },
      }),
      prisma.purchaseRequest.count({ where }),
    ])

    return NextResponse.json({ success: true, data: { requests, total, page, limit } })
  } catch (error) {
    console.error('[GET /api/purchases]', error)
    return NextResponse.json({ success: false, message: '데이터를 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, itemId, itemName, quantity, unit, price, memo, requesterId } = body

    if (!itemName || itemName.trim() === '') {
      return NextResponse.json({ success: false, message: '품명은 필수입니다.' }, { status: 400 })
    }
    if (quantity === undefined || quantity === null || quantity === '') {
      return NextResponse.json({ success: false, message: '수량은 필수입니다.' }, { status: 400 })
    }
    if (!unit || unit.trim() === '') {
      return NextResponse.json({ success: false, message: '단위는 필수입니다.' }, { status: 400 })
    }

    const data: any = {
      itemName: itemName.trim(),
      quantity: Number(quantity),
      unit: unit.trim(),
      status: 'PENDING' as PurchaseStatus,
    }
    if (url !== undefined && url !== '') data.url = url
    if (itemId !== undefined && itemId !== '') data.itemId = itemId
    if (price !== undefined && price !== '' && price !== null) data.price = Number(price)
    if (memo !== undefined && memo !== '') data.memo = memo
    if (requesterId !== undefined && requesterId !== '') data.requesterId = requesterId

    const request = await prisma.purchaseRequest.create({
      data,
      include: {
        requester: { select: { name: true, email: true } },
        item: { select: { itemCode: true } },
      },
    })

    return NextResponse.json({ success: true, data: request }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/purchases]', error)
    return NextResponse.json({ success: false, message: '구매 요청 생성에 실패했습니다.' }, { status: 500 })
  }
}
