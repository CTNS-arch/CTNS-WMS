import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isSameItem } from '@/lib/item-duplicate-check'
import { notifyErpWebhook } from '@/lib/erp-webhook'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        bomAsParent: { include: { child: true } },
        bomAsChild: { include: { parent: true } },
      },
    })
    if (!item) return NextResponse.json({ success: false, message: '품목을 찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json({ success: true, data: item })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    // ── 스펙 중복 검사 (자신 제외, revisionNumber·itemCode 제외한 모든 필드) ──
    if (body.itemName && body.category) {
      const dupeCheck = await prisma.item.findMany({
        where: { itemName: body.itemName, category: body.category, id: { not: id } },
      })
      if (dupeCheck.some(c => isSameItem(c as any, body))) {
        return NextResponse.json({ success: false, message: '동일한 품목이 있습니다.' }, { status: 409 })
      }
    }

    const item = await prisma.item.update({ where: { id }, data: body })
    notifyErpWebhook('upsert', item)
    return NextResponse.json({ success: true, data: item })
  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ success: false, message: '품목을 찾을 수 없습니다.' }, { status: 404 })
    if (err.code === 'P2002') return NextResponse.json({ success: false, message: '이미 존재하는 품번입니다.' }, { status: 409 })
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const force = new URL(req.url).searchParams.get('force') === 'true'

    const bomEntries = await prisma.bOM.findMany({
      where: { OR: [{ parentId: id }, { childId: id }] },
      include: { parent: { select: { itemCode: true, itemName: true } }, child: { select: { itemCode: true, itemName: true } } },
    })

    if (bomEntries.length > 0 && !force) {
      return NextResponse.json(
        { success: false, code: 'BOM_CONFLICT', bom: bomEntries },
        { status: 409 }
      )
    }

    if (bomEntries.length > 0) {
      await prisma.bOM.deleteMany({ where: { OR: [{ parentId: id }, { childId: id }] } })
    }

    await prisma.item.delete({ where: { id } })
    notifyErpWebhook('delete', { id })
    return NextResponse.json({ success: true, message: '삭제되었습니다.' })
  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ success: false, message: '품목을 찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
