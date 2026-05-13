import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

async function buildMiscCode(): Promise<string> {
  const yy = new Date().getFullYear().toString().slice(-2)
  const existing = await prisma.purchaseRequest.findMany({
    where: { documentNo: { startsWith: `L${yy}-F` } },
    select: { documentNo: true },
  })
  let maxSerial = 119  // 이번년도 시작: L26-F120
  for (const r of existing) {
    const match = r.documentNo?.match(/-F(\d+)$/)
    if (match) maxSerial = Math.max(maxSerial, parseInt(match[1], 10))
  }
  return `L${yy}-F${String(maxSerial + 1).padStart(3, '0')}`
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    const body = await req.json()
    const {
      title, requesterName, memo, approvalLine,
      miscWorkCode, miscSupplier, miscUrl,
      miscTotalAmount, miscDocumentRef, miscDeliveryLoc, miscOrderMethod,
    } = body

    if (!title?.trim()) {
      return NextResponse.json({ success: false, message: '요청제목은 필수입니다.' }, { status: 400 })
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const documentNo = await buildMiscCode()

        const created = await prisma.purchaseRequest.create({
          data: {
            documentNo,
            title: title.trim(),
            requesterName: requesterName?.trim() || null,
            department: '연구비',
            memo: memo?.trim() || null,
            ...(session?.user?.id ? { requesterId: session.user.id } : {}),
            approvalLine: approvalLine ? JSON.stringify(approvalLine) : null,
            miscWorkCode:    miscWorkCode?.trim() || null,
            miscSupplier:    miscSupplier?.trim() || null,
            miscUrl:         miscUrl?.trim() || null,
            miscTotalAmount: miscTotalAmount ? Number(miscTotalAmount) : null,
            miscDocumentRef: miscDocumentRef?.trim() || null,
            miscDeliveryLoc:  miscDeliveryLoc?.trim()  || null,
            miscOrderMethod:  miscOrderMethod?.trim()  || null,
          },
        })

        // Neon HTTP: create+include는 내부 트랜잭션 발생 → 별도 findUnique로 분리
        const request = await prisma.purchaseRequest.findUnique({
          where: { id: created.id },
          include: {
            items: true,
            requester: { select: { name: true, email: true } },
            files: { orderBy: { uploadedAt: 'asc' } },
          },
        })

        return NextResponse.json({ success: true, data: request }, { status: 201 })
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < 2) continue
        throw err
      }
    }

    return NextResponse.json({ success: false, message: '코드 생성 중 충돌이 발생했습니다.' }, { status: 409 })
  } catch (error: any) {
    console.error('[POST /api/purchases/misc]', error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
