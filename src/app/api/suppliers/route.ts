import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const region = searchParams.get('region')
    const subCategory = searchParams.get('subCategory')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10))
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) where.status = status
    if (region) where.region = region
    if (subCategory) where.subCategory = subCategory
    if (search?.trim()) {
      where.OR = [
        { supplierCode: { contains: search.trim(), mode: 'insensitive' } },
        { companyName: { contains: search.trim(), mode: 'insensitive' } },
      ]
    }

    if (!(prisma as any).supplier) {
      return NextResponse.json({ success: true, data: { suppliers: [], total: 0, page, limit } })
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contacts: true,
          files: true,
          items: { include: { item: { select: { id: true, itemCode: true, itemName: true, category: true, subCategory: true, status: true } } } },
        },
      }),
      prisma.supplier.count({ where }),
    ])

    return NextResponse.json({ success: true, data: { suppliers, total, page, limit } })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      supplierCode, companyName, status = 'ACTIVE', region = 'DOMESTIC',
      businessRegNo, url, bankName, accountNumber, accountHolder, subCategory, note,
      contacts = [], itemIds = [], files = [],
    } = body

    if (!(prisma as any).supplier) {
      return NextResponse.json({ success: false, message: 'DB 마이그레이션이 필요합니다. (prisma db push && prisma generate)' }, { status: 503 })
    }
    if (!companyName) {
      return NextResponse.json({ success: false, message: '회사명은 필수입니다.' }, { status: 400 })
    }

    let finalCode = supplierCode
    if (!finalCode && subCategory) {
      const existing = await prisma.supplier.findMany({
        where: { supplierCode: { startsWith: subCategory } },
        select: { supplierCode: true },
      })
      const maxSerial = existing.reduce((max, s) => {
        const serial = parseInt(s.supplierCode.slice(subCategory.length), 10)
        return isNaN(serial) ? max : Math.max(max, serial)
      }, 0)
      finalCode = `${subCategory}${String(maxSerial + 1).padStart(3, '0')}`
    }
    if (!finalCode) {
      return NextResponse.json({ success: false, message: '회사코드 또는 소분류가 필요합니다.' }, { status: 400 })
    }

    // Neon HTTP 어댑터는 암묵적 트랜잭션 미지원 → 중첩 create 대신 순차 createMany 사용
    const supplier = await prisma.supplier.create({
      data: {
        supplierCode: finalCode,
        companyName,
        status,
        region,
        businessRegNo: businessRegNo || null,
        url: url || null,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        accountHolder: accountHolder || null,
        subCategory: subCategory || null,
        note: note || null,
      },
    })

    // Neon HTTP: createMany 대신 개별 create 루프 사용
    for (const c of contacts.filter((c: any) => c.name?.trim())) {
      await prisma.supplierContact.create({
        data: { supplierId: supplier.id, name: c.name.trim(), title: c.title || null, phone: c.phone || null, email: c.email || null },
      })
    }
    for (const f of (files as any[])) {
      await prisma.supplierFile.create({
        data: { supplierId: supplier.id, fileName: f.fileName, fileUrl: f.fileUrl, fileSize: f.fileSize ?? null, mimeType: f.mimeType ?? null },
      })
    }
    for (const itemId of (itemIds as string[])) {
      await prisma.supplierItem.create({ data: { supplierId: supplier.id, itemId } })
    }

    const result = await prisma.supplier.findUnique({
      where: { id: supplier.id },
      include: {
        contacts: true,
        files: true,
        items: { include: { item: { select: { id: true, itemCode: true, itemName: true, category: true, subCategory: true, status: true } } } },
      },
    })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (err: any) {
    if (err.code === 'P2002')
      return NextResponse.json({ success: false, message: '이미 존재하는 회사코드입니다.' }, { status: 409 })
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
