import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const subCategory = new URL(req.url).searchParams.get('subCategory')
    if (!subCategory)
      return NextResponse.json({ success: false, message: 'subCategory required' }, { status: 400 })

    if (!(prisma as any).supplier) {
      return NextResponse.json({ success: true, data: { nextCode: `${subCategory}001` } })
    }

    const existing = await prisma.supplier.findMany({
      where: { supplierCode: { startsWith: subCategory } },
      select: { supplierCode: true },
    })

    const maxSerial = existing.reduce((max, s) => {
      const serial = parseInt(s.supplierCode.slice(subCategory.length), 10)
      return isNaN(serial) ? max : Math.max(max, serial)
    }, 0)

    const nextCode = `${subCategory}${String(maxSerial + 1).padStart(3, '0')}`
    return NextResponse.json({ success: true, data: { nextCode } })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
