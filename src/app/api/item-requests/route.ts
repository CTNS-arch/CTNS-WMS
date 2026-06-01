import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const LIMIT = 30

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const status   = searchParams.get('status') || ''
    const page     = Math.max(1, Number(searchParams.get('page') || 1))
    const canWrite = session.user.roles?.includes('ITEM_WRITE') || session.user.roles?.includes('MASTER_ADMIN')
    const isExternal = session.user.id.startsWith('ext:')

    const where: any = {}
    if (status) where.status = status
    if (!canWrite) {
      if (isExternal) {
        where.requesterName = session.user.name || ''
      } else {
        where.requesterId = session.user.id
      }
    }

    const [rows, total] = await Promise.all([
      prisma.itemCreateRequest.findMany({
        where,
        include: { requester: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * LIMIT,
        take: LIMIT,
      }),
      prisma.itemCreateRequest.count({ where }),
    ])

    return NextResponse.json({ success: true, data: { rows, total, page } })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await req.json()
    const { category, subCategory, itemName, spec, quantity, unit, workCode, memo, oldItemCode } = body

    if (!category || !itemName?.trim()) {
      return NextResponse.json({ success: false, message: '대분류와 품명은 필수입니다.' }, { status: 400 })
    }

    const trimmedName = (itemName as string).trim()
    const normSub     = subCategory || null
    const normSpec    = spec?.trim() || null
    const normQty     = quantity ? Number(quantity) : null
    const normUnit    = unit?.trim() || null
    const normWork    = workCode?.trim() || null
    const normMemo    = memo?.trim() || null

    // ── 기존 품목에 동일 품목 존재 여부 검사 ──
    const existingItem = await prisma.item.findFirst({
      where: {
        category,
        subCategory: normSub,
        itemName: { equals: trimmedName, mode: 'insensitive' },
      },
    })
    if (existingItem) {
      return NextResponse.json({ success: false, message: '동일한 품목이 있습니다.' }, { status: 409 })
    }

    // ── 기존 요청 중 모든 필드가 동일한 항목 검사 (PENDING·APPROVED) ──
    const existingRequest = await prisma.itemCreateRequest.findFirst({
      where: {
        status:      { in: ['PENDING', 'APPROVED'] },
        category,
        subCategory: normSub,
        itemName:    trimmedName,
        spec:        normSpec,
        quantity:    normQty,
        unit:        normUnit,
        workCode:    normWork,
        memo:        normMemo,
      },
    })
    if (existingRequest) {
      return NextResponse.json({ success: false, message: '동일한 품목이 있습니다.' }, { status: 409 })
    }

    // NeonHTTP: nested connect/include는 내부 트랜잭션을 유발하므로
    // 단순 create 후 raw UPDATE로 requesterId 설정
    const record = await prisma.itemCreateRequest.create({
      data: {
        requesterName: session.user.name || session.user.email || '',
        category,
        subCategory:   normSub,
        itemName:      trimmedName,
        spec:          normSpec,
        quantity:      normQty,
        unit:          normUnit,
        workCode:      normWork,
        memo:          normMemo,
        oldItemCode:   oldItemCode?.trim() || null,
      },
    })

    // 내부 사용자만 requesterId 설정 (외부 거래처는 ExternalUser이므로 스킵)
    const isExternal = session.user.id.startsWith('ext:')
    if (!isExternal && session.user.id) {
      await prisma.$executeRaw`UPDATE "ItemCreateRequest" SET "requesterId" = ${session.user.id} WHERE id = ${record.id}`
    }

    return NextResponse.json({ success: true, data: record }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
