import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dept = searchParams.get('dept') || '생산구매팀'
    const prefix = dept === '연구소' ? 'L' : 'P'
    const yy = new Date().getFullYear().toString().slice(-2)

    const existing = await prisma.purchaseRequest.findMany({
      where: { documentNo: { startsWith: `${prefix}${yy}-` } },
      select: { documentNo: true },
    })
    let maxSerial = 0
    for (const r of existing) {
      const match = (r.documentNo as string | null)?.match(/-(\d+)$/)
      if (match) maxSerial = Math.max(maxSerial, parseInt(match[1], 10))
    }
    return NextResponse.json({ success: true, data: { nextSerial: maxSerial + 1, prefix, yy } })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
