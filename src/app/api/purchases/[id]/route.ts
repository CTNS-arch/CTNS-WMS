import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PurchaseStatus } from '@prisma/client'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { title, department, memo, status, items } = body

    const data: any = {}
    if (status !== undefined) data.status = status as PurchaseStatus
    if (title !== undefined) data.title = title.trim()
    if (department !== undefined) data.department = department.trim()
    if (memo !== undefined) data.memo = memo?.trim() || null

    const updated = await prisma.$transaction(async (tx) => {
      if (items !== undefined) {
        await tx.purchaseRequestItem.deleteMany({ where: { purchaseRequestId: id } })
        const validItems = items.filter((it: any) => it.quantity && Number(it.quantity) > 0 && it.unit?.trim())
        data.items = {
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
        }
      }
      return tx.purchaseRequest.update({
        where: { id },
        data,
        include: {
          items: { orderBy: { lineNo: 'asc' } },
          requester: { select: { name: true, email: true } },
        },
      })
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
      return NextResponse.json({ success: false, message: '검토중 상태의 요청만 삭제할 수 있습니다.' }, { status: 400 })
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
