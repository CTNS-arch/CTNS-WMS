import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { currency, unitPrice, supplier, note } = body

    const data: any = {}
    if (currency !== undefined) data.currency = currency
    if (unitPrice !== undefined) data.unitPrice = Number(unitPrice)
    if (supplier !== undefined) data.supplier = supplier?.trim() || null
    if (note !== undefined) data.note = note?.trim() || null

    const cost = await prisma.itemCost.update({ where: { id }, data })
    return NextResponse.json({ success: true, data: cost })
  } catch (err: any) {
    if (err?.code === 'P2025') return NextResponse.json({ success: false, message: '원가 항목을 찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.itemCost.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err?.code === 'P2025') return NextResponse.json({ success: false, message: '원가 항목을 찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
