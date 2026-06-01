import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const ITEM_CAT_LABEL: Record<string, string> = {
  PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 })
    }

    const canWrite = session.user.roles?.includes('ITEM_WRITE') || session.user.roles?.includes('MASTER_ADMIN')
    if (!canWrite) {
      return NextResponse.json({ success: false, message: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params
    const { itemId } = await req.json()

    if (!itemId) {
      return NextResponse.json({ success: false, message: '연결할 품목 ID가 필요합니다.' }, { status: 400 })
    }

    // 품목 생성 요청 조회
    const itemRequest = await prisma.itemCreateRequest.findUnique({ where: { id } })
    if (!itemRequest) {
      return NextResponse.json({ success: false, message: '요청을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 연결할 WMS 품목 조회
    const item = await prisma.item.findUnique({ where: { id: itemId } })
    if (!item) {
      return NextResponse.json({ success: false, message: '품목을 찾을 수 없습니다.' }, { status: 404 })
    }

    // NeonHTTP: nested connect는 내부 트랜잭션 유발 → raw UPDATE 사용
    await prisma.$executeRaw`
      UPDATE "ItemCreateRequest"
      SET "linkedItemId" = ${itemId}, status = 'APPROVED'::"ItemRequestStatus", "updatedAt" = NOW()
      WHERE id = ${id}
    `
    const updated = await prisma.itemCreateRequest.findUnique({ where: { id } })

    // oldItemCode로 등록된 구매요청 품목들을 신규 코드로 일괄 업데이트
    let updatedCount = 0
    if (itemRequest.oldItemCode) {
      const result = await prisma.purchaseRequestItem.updateMany({
        where: { bomNo: itemRequest.oldItemCode, itemId: null },
        data: {
          itemId,
          bomNo: item.itemCode,
          spec: item.itemName,
          category: ITEM_CAT_LABEL[item.category] ?? item.category,
        },
      })
      updatedCount = result.count
    }

    return NextResponse.json({
      success: true,
      data: updated,
      updatedPurchaseItems: updatedCount,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
