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

    const department = searchParams.get('department')

    const where: any = {}
    if (status) where.status = status as PurchaseStatus
    if (department) {
      // '연구비' 탭은 탭명 변경 전 '기타' 데이터도 포함
      where.department = department === '연구비'
        ? { in: ['연구비', '기타'] }
        : department
    }
    if (search?.trim()) {
      where.OR = [
        { documentNo: { contains: search.trim(), mode: 'insensitive' } },
        { title: { contains: search.trim(), mode: 'insensitive' } },
      ]
    }

    const [requests, total, rawCounts] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { orderBy: { lineNo: 'asc' } },
          requester: { select: { name: true, email: true } },
          files: { orderBy: { uploadedAt: 'asc' } },
        },
      }),
      prisma.purchaseRequest.count({ where }),
      prisma.purchaseRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    ])

    const statusCounts: Record<string, number> = {}
    for (const row of rawCounts) statusCounts[row.status] = row._count._all

    return NextResponse.json({ success: true, data: { requests, total, page, limit, statusCounts } })
  } catch (error) {
    console.error('[GET /api/purchases]', error)
    return NextResponse.json({ success: false, message: '데이터를 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { documentNo, title, requesterName, department, memo, items, requesterId, approvalLine } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: '품목을 1개 이상 입력해주세요.' }, { status: 400 })
    }
    const validItems = items.filter((it: any) => it.quantity && Number(it.quantity) > 0 && it.unit?.trim())
    if (validItems.length === 0) {
      return NextResponse.json({ success: false, message: '수량과 단위가 입력된 품목이 필요합니다.' }, { status: 400 })
    }

    const created = await prisma.purchaseRequest.create({
      data: {
        documentNo: documentNo?.trim() || null,
        title: title?.trim() || documentNo?.trim() || '구매요청',
        requesterName: requesterName?.trim() || null,
        department: department?.trim() || '생산구매팀',
        memo: memo?.trim() || null,
        requesterId: requesterId || null,
        approvalLine: approvalLine ? JSON.stringify(approvalLine) : null,
        items: {
          create: validItems.map((it: any, i: number) => ({
            lineNo: i + 1,
            workCode: it.workCode?.trim() || null,
            itemId: it.itemId || null,
            category: it.category?.trim() || null,
            midCategory: it.midCategory?.trim() || null,
            subCategory: it.subCategory?.trim() || null,
            bomNo: it.bomNo?.trim() || null,
            spec: it.spec?.trim() || null,
            quantity: Number(it.quantity),
            unit: it.unit?.trim() || 'EA',
            currency: it.currency || 'KRW',
            supplyAmount: it.supplyAmount != null ? Number(it.supplyAmount) : null,
            taxAmount: it.taxAmount != null ? Number(it.taxAmount) : null,
            purchaseReason: it.purchaseReason?.trim() || null,
            requestedDeliveryDate: it.requestedDeliveryDate ? new Date(it.requestedDeliveryDate) : null,
            supplier: it.supplier?.trim() || null,
            deliveryLocation: it.deliveryLocation?.trim() || null,
          })),
        },
      },
      include: {
        items: { orderBy: { lineNo: 'asc' } },
        requester: { select: { name: true, email: true } },
        files: true,
      },
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/purchases]', error)
    return NextResponse.json({ success: false, message: '구매 요청 생성에 실패했습니다.' }, { status: 500 })
  }
}
