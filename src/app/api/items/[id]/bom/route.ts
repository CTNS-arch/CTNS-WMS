import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const lines = await prisma.bOM.findMany({
      where: { parentId: id },
      include: {
        child: {
          select: { id: true, itemCode: true, itemName: true, unit: true, category: true, subCategory: true, formFactor: true, chemistryType: true },
        },
      },
      orderBy: { id: 'asc' },
    })
    return NextResponse.json({ success: true, data: lines })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { childId, quantity, unit, memo } = await req.json()

    if (!childId || quantity == null || !unit)
      return NextResponse.json({ success: false, message: '필수 항목 누락: 품목, 수량, 단위' }, { status: 400 })

    if (childId === id)
      return NextResponse.json({ success: false, message: '자기 자신을 BOM에 추가할 수 없습니다.' }, { status: 400 })

    const line = await prisma.bOM.create({
      data: { parentId: id, childId, quantity: parseFloat(quantity), unit, memo: memo || null },
    })
    const child = await prisma.item.findUnique({
      where: { id: childId },
      select: { id: true, itemCode: true, itemName: true, unit: true, category: true, subCategory: true, formFactor: true, chemistryType: true },
    })
    return NextResponse.json({ success: true, data: { ...line, child } }, { status: 201 })
  } catch (err: any) {
    if (err.code === 'P2002')
      return NextResponse.json({ success: false, message: '이미 등록된 품목입니다.' }, { status: 409 })
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
