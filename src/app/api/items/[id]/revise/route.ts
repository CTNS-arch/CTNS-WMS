import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function getNextRevisionData(id: string) {
  const original = await prisma.item.findUnique({ where: { id } })
  if (!original) return null

  const segments = original.itemCode.split('-')
  const baseCode = segments.slice(0, -1).join('-')

  const existing = await prisma.item.findMany({
    where: { itemCode: { startsWith: baseCode + '-' } },
    select: { itemCode: true },
  })

  const maxVersion = existing.reduce((max, i) => {
    const v = parseInt(i.itemCode.split('-').pop() ?? '0', 10)
    return Math.max(max, isNaN(v) ? 0 : v)
  }, 0)

  const newVersion = maxVersion + 1
  const newCode = `${baseCode}-${String(newVersion).padStart(3, '0')}`

  const { id: _id, createdAt: _ca, updatedAt: _ua, ...data } = original as any
  return { ...data, itemCode: newCode, revisionNumber: newVersion }
}

// 리비전 미리보기 (폼 pre-fill용, 실제 생성 안 함)
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await getNextRevisionData(id)
    if (!data) return NextResponse.json({ success: false, message: '품목을 찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

// 리비전 직접 생성 (레거시, 현재 미사용)
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await getNextRevisionData(id)
    if (!data) return NextResponse.json({ success: false, message: '품목을 찾을 수 없습니다.' }, { status: 404 })
    const newItem = await prisma.item.create({ data })
    return NextResponse.json({ success: true, data: newItem })
  } catch (err: any) {
    if (err.code === 'P2002') return NextResponse.json({ success: false, message: '이미 존재하는 품번입니다.' }, { status: 409 })
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
