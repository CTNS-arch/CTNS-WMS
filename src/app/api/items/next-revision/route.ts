import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const baseCode = new URL(req.url).searchParams.get('baseCode')
    if (!baseCode)
      return NextResponse.json({ success: false, message: 'baseCode required' }, { status: 400 })

    const siblings = await prisma.item.findMany({
      where: { itemCode: { startsWith: baseCode + '-' } },
      select: { itemCode: true },
    })

    const maxVersion = siblings.reduce((max, s) => {
      const v = parseInt(s.itemCode.split('-').pop() ?? '0', 10)
      return Math.max(max, isNaN(v) ? 0 : v)
    }, 0)

    return NextResponse.json({ success: true, data: { nextRevision: maxVersion + 1 } })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
