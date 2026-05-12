import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function makeItemData(it: any) {
  return {
    lineNo: 1,
    domestic: it.domestic?.trim() || null,
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
    additionalCost: it.additionalCost != null ? Number(it.additionalCost) : null,
    supplyAmount: it.supplyAmount != null ? Number(it.supplyAmount) : null,
    taxAmount: it.taxAmount != null ? Number(it.taxAmount) : null,
    purchaseReason: it.purchaseReason?.trim() || null,
    requestedDeliveryDate: it.requestedDeliveryDate ? new Date(it.requestedDeliveryDate) : null,
    supplier: it.supplier?.trim() || null,
    deliveryLocation: it.deliveryLocation?.trim() || null,
  }
}

async function buildCodes(dept: string, count: number): Promise<string[]> {
  const prefix = dept === '연구소' ? 'L' : 'P'
  const yy = new Date().getFullYear().toString().slice(-2)
  const existing = await prisma.purchaseRequest.findMany({
    where: { documentNo: { startsWith: `${prefix}${yy}-` } },
    select: { documentNo: true },
  })
  let maxSerial = 0
  for (const r of existing) {
    const match = (r.documentNo as string | null)?.match(/-(\d+)$/)
    if (match) maxSerial = Math.max(maxSerial, parseInt(match[1], 10))
  }
  return Array.from({ length: count }, (_, i) =>
    `${prefix}${yy}-${String(maxSerial + 1 + i).padStart(4, '0')}`
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { requesterName, department, memo, requesterId, approvalLine, items } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: '품목을 1개 이상 입력해주세요.' }, { status: 400 })
    }
    const validItems = items.filter((it: any) => it.quantity && Number(it.quantity) > 0 && it.unit?.trim())
    if (validItems.length === 0) {
      return NextResponse.json({ success: false, message: '수량과 단위가 입력된 품목이 필요합니다.' }, { status: 400 })
    }

    const dept = department?.trim() || '생산구매팀'

    // unique 충돌 시 최대 3회 재시도 (동시 요청 대비)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const codes = await buildCodes(dept, validItems.length)

        // Neon HTTP 어댑터: 중첩 create 미지원 → PurchaseRequest 생성 후 PurchaseRequestItem 별도 생성
        const created: any[] = []
        for (let i = 0; i < validItems.length; i++) {
          const request = await prisma.purchaseRequest.create({
            data: {
              documentNo: codes[i],
              title: validItems[i].spec?.trim() || codes[i],
              requesterName: requesterName?.trim() || null,
              department: dept,
              memo: memo?.trim() || null,
              requesterId: requesterId || null,
              approvalLine: approvalLine ? JSON.stringify(approvalLine) : null,
            },
          })

          await prisma.purchaseRequestItem.create({
            data: {
              purchaseRequestId: request.id,
              ...makeItemData(validItems[i]),
            },
          })

          const record = await prisma.purchaseRequest.findUnique({
            where: { id: request.id },
            include: {
              items: { orderBy: { lineNo: 'asc' } },
              requester: { select: { name: true, email: true } },
              files: true,
            },
          })
          if (record) created.push(record)
        }

        return NextResponse.json({ success: true, data: created }, { status: 201 })
      } catch (err: any) {
        // P2002 = unique constraint violation → 재시도
        if (err?.code === 'P2002' && attempt < 2) continue
        throw err
      }
    }

    return NextResponse.json({ success: false, message: '코드 생성 중 충돌이 발생했습니다. 다시 시도해주세요.' }, { status: 409 })
  } catch (error: any) {
    console.error('[POST /api/purchases/batch] code:', error?.code, 'message:', error?.message, error)
    const msg = error?.code === 'P2003'
      ? '참조 데이터가 존재하지 않습니다. 품목 ID를 확인해주세요.'
      : error?.code === 'P2002'
      ? '코드 생성 중 충돌이 발생했습니다. 다시 시도해주세요.'
      : '구매요청 생성에 실패했습니다.'
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
