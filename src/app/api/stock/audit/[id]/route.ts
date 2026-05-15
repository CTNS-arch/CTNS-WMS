import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/stock/audit/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const audit = await prisma.stockAudit.findUnique({
      where: { id },
      include: {
        items: { orderBy: { itemCode: 'asc' } },
        user:  { select: { name: true, email: true } },
      },
    })
    if (!audit) return NextResponse.json({ success: false, message: '실사 데이터를 찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json({ success: true, data: audit })
  } catch (err: any) {
    console.error('[GET /api/stock/audit/[id]]', err)
    return NextResponse.json({ success: false, message: err.message ?? '조회 실패' }, { status: 500 })
  }
}

// PATCH /api/stock/audit/[id]  { items: [{id, actualQty}], note? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { items, note } = body

    const dataUpdate: any = {}
    if (note !== undefined) dataUpdate.note = note?.trim() || null

    if (Object.keys(dataUpdate).length > 0) {
      await prisma.stockAudit.update({ where: { id }, data: dataUpdate })
    }

    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        await prisma.stockAuditItem.update({
          where: { id: it.id },
          data:  { actualQty: it.actualQty != null ? Number(it.actualQty) : null },
        })
      }
    }

    const updated = await prisma.stockAudit.findUnique({
      where: { id },
      include: {
        items: { orderBy: { itemCode: 'asc' } },
        user:  { select: { name: true, email: true } },
      },
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (err: any) {
    console.error('[PATCH /api/stock/audit/[id]]', err)
    return NextResponse.json({ success: false, message: err.message ?? '저장 실패' }, { status: 500 })
  }
}
