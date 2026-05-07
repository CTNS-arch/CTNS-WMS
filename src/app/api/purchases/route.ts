import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PurchaseStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10))
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) where.status = status as PurchaseStatus
    if (search?.trim()) where.title = { contains: search.trim(), mode: 'insensitive' }

    const [requests, total] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { orderBy: { lineNo: 'asc' } },
          requester: { select: { name: true, email: true } },
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
    const { title, department, memo, items, requesterId, approvalLine } = body

    if (!title?.trim()) {
      return NextResponse.json({ success: false, message: '제목은 필수입니다.' }, { status: 400 })
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: '품목을 1개 이상 입력해주세요.' }, { status: 400 })
    }
    const validItems = items.filter((it: any) => it.quantity && Number(it.quantity) > 0 && it.unit?.trim())
    if (validItems.length === 0) {
      return NextResponse.json({ success: false, message: '수량과 단위가 입력된 품목이 필요합니다.' }, { status: 400 })
    }

    const request = await prisma.purchaseRequest.create({
      data: {
        title: title.trim(),
        department: department?.trim() || '생산구매팀',
        memo: memo?.trim() || null,
        requesterId: requesterId || null,
        approvalLine: approvalLine ? JSON.stringify(approvalLine) : null,
        items: {
          create: validItems.map((it: any, i: number) => ({
            lineNo: i + 1,
            workCode: it.workCode?.trim() || null,
            category: it.category?.trim() || null,
            midCategory: it.midCategory?.trim() || null,
            subCategory: it.subCategory?.trim() || null,
            bomNo: it.bomNo?.trim() || null,
            spec: it.spec?.trim() || null,
            quantity: Number(it.quantity),
            unit: it.unit?.trim() || 'EA',
            purchaseReason: it.purchaseReason?.trim() || null,
          })),
        },
      },
      include: {
        items: { orderBy: { lineNo: 'asc' } },
        requester: { select: { name: true, email: true } },
      },
    })

    return NextResponse.json({ success: true, data: request }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/purchases]', error)
    return NextResponse.json({ success: false, message: '구매 요청 생성에 실패했습니다.' }, { status: 500 })
  }
}
