import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dept = searchParams.get('dept') || '생산구매팀'
    const yy = new Date().getFullYear().toString().slice(-2)

    if (dept === '연구소') {
      // L{YY}-P{NNN}, 이번년도 시작: L26-P020
      const existing = await prisma.purchaseRequest.findMany({
        where: { documentNo: { startsWith: `L${yy}-P` } },
        select: { documentNo: true },
      })
      let maxSerial = 19  // min 20
      for (const r of existing) {
        const match = r.documentNo?.match(/-P(\d+)$/)
        if (match) maxSerial = Math.max(maxSerial, parseInt(match[1], 10))
      }
      return NextResponse.json({ success: true, data: { nextSerial: maxSerial + 1, dept } })
    } else {
      // 생산구매팀: P{YY}-{NNNN}
      const existing = await prisma.purchaseRequest.findMany({
        where: { documentNo: { startsWith: `P${yy}-` } },
        select: { documentNo: true },
      })
      let maxSerial = 0
      for (const r of existing) {
        const match = r.documentNo?.match(/-(\d+)$/)
        if (match) maxSerial = Math.max(maxSerial, parseInt(match[1], 10))
      }
      return NextResponse.json({ success: true, data: { nextSerial: maxSerial + 1, dept } })
    }
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
