import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PurchaseStatus } from '@prisma/client'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { status, url, itemName, quantity, unit, price, memo } = body

    const data: any = {}
    if (status !== undefined) data.status = status as PurchaseStatus
    if (url !== undefined) data.url = url === '' ? null : url
    if (itemName !== undefined && itemName.trim() !== '') data.itemName = itemName.trim()
    if (quantity !== undefined && quantity !== '') data.quantity = Number(quantity)
    if (unit !== undefined && unit.trim() !== '') data.unit = unit.trim()
    if (price !== undefined) data.price = price === '' || price === null ? null : Number(price)
    if (memo !== undefined) data.memo = memo === '' ? null : memo

    const updated = await prisma.purchaseRequest.update({
      where: { id },
      data,
      include: {
        requester: { select: { name: true, email: true } },
        item: { select: { itemCode: true } },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('[PATCH /api/purchases/[id]]', error)
    if (error?.code === 'P2025') {
      return NextResponse.json({ success: false, message: '해당 구매 요청을 찾을 수 없습니다.' }, { status: 404 })
    }
    return NextResponse.json({ success: false, message: '구매 요청 수정에 실패했습니다.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const existing = await prisma.purchaseRequest.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, message: '해당 구매 요청을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (existing.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, message: '검토중 상태의 요청만 삭제할 수 있습니다.' },
        { status: 400 }
      )
    }

    await prisma.purchaseRequest.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE /api/purchases/[id]]', error)
    if (error?.code === 'P2025') {
      return NextResponse.json({ success: false, message: '해당 구매 요청을 찾을 수 없습니다.' }, { status: 404 })
    }
    return NextResponse.json({ success: false, message: '구매 요청 삭제에 실패했습니다.' }, { status: 500 })
  }
}
