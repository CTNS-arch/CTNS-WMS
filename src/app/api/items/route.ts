import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ItemCategory, ItemStatus, Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category') as ItemCategory | null
    const subCategory = searchParams.get('subCategory')
    const status = searchParams.get('status') as ItemStatus | null
    const search = searchParams.get('search')
    const page = Number(searchParams.get('page') ?? 1)
    const limit = Number(searchParams.get('limit') ?? 20)
    const skip = (page - 1) * limit

    const where: Prisma.ItemWhereInput = {}

    // 쉼표 구분 다중값 → in 쿼리 헬퍼
    const multiIn = (param: string | null) => {
      if (!param) return null
      const vals = param.split(',').filter(Boolean)
      return vals.length === 1 ? vals[0] : vals
    }
    const toIn = <T>(vals: string | string[] | null): T | { in: T[] } | null => {
      if (!vals) return null
      if (Array.isArray(vals)) return { in: vals as unknown as T[] }
      return vals as unknown as T
    }

    const catVal = multiIn(category)
    if (catVal) where.category = toIn<ItemCategory>(catVal) as any
    const subVal = multiIn(subCategory)
    if (subVal) where.subCategory = toIn(subVal) as any
    const statusVal = multiIn(status)
    if (statusVal) where.status = toIn<ItemStatus>(statusVal) as any

    if (search) {
      where.OR = [
        { itemCode: { contains: search, mode: 'insensitive' } },
        { itemName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const sortBy = searchParams.get('sortBy') ?? 'createdAt'
    const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'

    const chemVal = multiIn(searchParams.get('chemistryType'))
    if (chemVal) where.chemistryType = toIn(chemVal) as any
    const cellVal = multiIn(searchParams.get('cellModel'))
    if (cellVal) where.cellModel = toIn(cellVal) as any
    const circuitVal = multiIn(searchParams.get('circuit'))
    if (circuitVal) where.circuit = toIn(circuitVal) as any
    const packVal = multiIn(searchParams.get('packType'))
    if (packVal) where.packType = toIn(packVal) as any
    const matVal = multiIn(searchParams.get('material'))
    if (matVal) where.material = toIn(matVal) as any
    const vendorParam = searchParams.get('vendor')
    if (vendorParam) {
      const vals = vendorParam.split(',').filter(Boolean)
      where.vendors = { hasSome: vals }
    }

    const seriesCountParam = searchParams.get('seriesCount')
    const parallelCountParam = searchParams.get('parallelCount')
    const layerCountParam = searchParams.get('layerCount')

    if (seriesCountParam) where.seriesCount = parseInt(seriesCountParam)
    if (parallelCountParam) where.parallelCount = parseInt(parallelCountParam)
    if (layerCountParam) where.layerCount = parseInt(layerCountParam)

    const validSort = ['itemCode', 'itemName', 'category', 'subCategory', 'status', 'createdAt', 'updatedAt', 'revisionNumber']
    const orderBy: Prisma.ItemOrderByWithRelationInput = validSort.includes(sortBy)
      ? { [sortBy]: sortOrder }
      : { createdAt: 'desc' }

    const [items, total] = await Promise.all([
      prisma.item.findMany({ where, skip, take: limit, orderBy }),
      prisma.item.count({ where }),
    ])

    return NextResponse.json({ success: true, data: { items, total, page, limit } })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    let { itemCode, itemName, unit, category, subCategory, status, ...rest } = body

    if (!itemCode || !itemName || !unit || !category) {
      return NextResponse.json(
        { success: false, message: '필수 항목 누락: 품번, 품명, 단위, 대분류' },
        { status: 400 }
      )
    }

    // 동일 베이스 코드를 가진 기존 품목 조회
    const segments = (itemCode as string).split('-')
    const baseCode = segments.slice(0, -1).join('-')

    const siblings = await prisma.item.findMany({
      where: { itemCode: { startsWith: baseCode + '-' } },
      select: { itemCode: true },
    })

    // 제출된 품번이 이미 존재하면 다음 일련번호로 자동 설정
    if (siblings.some(s => s.itemCode === itemCode)) {
      const maxVersion = siblings.reduce((max, s) => {
        const v = parseInt(s.itemCode.split('-').pop() ?? '0', 10)
        return Math.max(max, isNaN(v) ? 0 : v)
      }, 0)
      const newVersion = maxVersion + 1
      itemCode = `${baseCode}-${String(newVersion).padStart(3, '0')}`
      rest.revisionNumber = newVersion
    }

    const item = await prisma.item.create({
      data: { itemCode, itemName, unit, category, subCategory, status, ...rest },
    })

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (err: any) {
    if (err.code === 'P2002')
      return NextResponse.json({ success: false, message: '이미 존재하는 품번입니다.' }, { status: 409 })
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
