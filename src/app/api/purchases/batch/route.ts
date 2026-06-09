import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function makeItemData(it: any, lineNo: number) {
  return {
    lineNo,
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

async function buildCode(dept: string): Promise<string> {
  const yy = new Date().getFullYear().toString().slice(-2)

  if (dept === '연구소') {
    const existing = await prisma.purchaseRequest.findMany({
      where: { documentNo: { startsWith: `L${yy}-P` } },
      select: { documentNo: true },
    })
    let maxSerial = 19
    for (const r of existing) {
      const match = (r.documentNo as string | null)?.match(/-P(\d+)$/)
      if (match) maxSerial = Math.max(maxSerial, parseInt(match[1], 10))
    }
    return `L${yy}-P${String(maxSerial + 1).padStart(3, '0')}`
  } else {
    const existing = await prisma.purchaseRequest.findMany({
      where: { documentNo: { startsWith: `P${yy}-` } },
      select: { documentNo: true },
    })
    let maxSerial = 0
    for (const r of existing) {
      const match = (r.documentNo as string | null)?.match(/-(\d+)$/)
      if (match) maxSerial = Math.max(maxSerial, parseInt(match[1], 10))
    }
    return `P${yy}-${String(maxSerial + 1).padStart(4, '0')}`
  }
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

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const code = await buildCode(dept)

        // 구매요청 1건 생성
        const request = await prisma.purchaseRequest.create({
          data: {
            documentNo: code,
            title: validItems[0].spec?.trim() || code,
            requesterName: requesterName?.trim() || null,
            department: dept,
            memo: memo?.trim() || null,
            requesterId: requesterId || null,
            approvalLine: approvalLine ? JSON.stringify(approvalLine) : null,
          },
        })

        // 품목 N개를 순서대로 생성
        for (let i = 0; i < validItems.length; i++) {
          await prisma.purchaseRequestItem.create({
            data: {
              purchaseRequestId: request.id,
              ...makeItemData(validItems[i], i + 1),
            },
          })
        }

        const record = await prisma.purchaseRequest.findUnique({
          where: { id: request.id },
          include: {
            items: { orderBy: { lineNo: 'asc' } },
            requester: { select: { name: true, email: true } },
            files: true,
          },
        })

        return NextResponse.json({ success: true, data: [record] }, { status: 201 })
      } catch (err: any) {
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

export async function PATCH(req: NextRequest) {
  try {
    const { auth } = await import('@/auth')
    const session = await auth()
    const roles = session?.user?.roles ?? []
    const allowed = roles.includes('MASTER_ADMIN') || roles.includes('PROD_STOCK') || roles.includes('LAB_STOCK')
    if (!allowed)
      return NextResponse.json({ success: false, message: '권한이 없습니다.' }, { status: 403 })

    const { ids, status } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0)
      return NextResponse.json({ success: false, message: '변경할 요청 ID 목록이 필요합니다.' }, { status: 400 })
    const validStatuses = ['PENDING', 'APPROVED', 'WAITING', 'ORDERED', 'RECEIVED', 'REJECTED']
    if (!validStatuses.includes(status))
      return NextResponse.json({ success: false, message: '유효하지 않은 상태값입니다.' }, { status: 400 })
    const { count } = await prisma.purchaseRequest.updateMany({
      where: { id: { in: ids } },
      data: { status: status as any },
    })
    return NextResponse.json({ success: true, count })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
