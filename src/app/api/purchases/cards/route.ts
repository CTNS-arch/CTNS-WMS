import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const cards = await prisma.purchaseCard.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ success: true, data: cards })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ success: false, message: '카드명을 입력하세요.' }, { status: 400 })
    }
    const card = await prisma.purchaseCard.create({ data: { name: name.trim() } })
    return NextResponse.json({ success: true, data: card }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ success: false, message: '이미 존재하는 카드명입니다.' }, { status: 409 })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
