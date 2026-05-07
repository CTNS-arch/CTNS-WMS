import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// 정확한 품번 변경 매핑 (현재코드 → 새코드 + 리비전 번호)
const CODE_MAP = [
  { from: '1-BP-NM-S45T-12S5P-BM-001', to: '1-BP-NM-S45T-12S5P-B-003', revisionNumber: 3 },
  { from: '1-BP-NM-S45T-12S5P-BM-002', to: '1-BP-NM-S45T-12S5P-B-004', revisionNumber: 4 },
  { from: '1-BP-NM-S45T-12S5P-BM-003', to: '1-BP-NM-S45T-12S5P-B-005', revisionNumber: 5 },
  { from: '1-BP-NM-S45T-12S5P-BM-004', to: '1-BP-NM-S45T-12S5P-B-006', revisionNumber: 6 },
]

// PRODUCT 대분류에서 이동할 소분류 → 새 대분류
const CAT_REMAP: Record<string, { category: string; catCode: string }> = {
  BM: { category: 'ASSEMBLY',  catCode: '2' },
  PC: { category: 'ASSEMBLY',  catCode: '2' },
  CL: { category: 'COMPONENT', catCode: '3' },
}

export async function POST() {
  const results: string[] = []

  await prisma.$transaction(async (tx: TxClient) => {
    // ── 1. BP 품번 회로 코드 수정 (명시적 매핑) ───────────────────
    for (const { from, to, revisionNumber } of CODE_MAP) {
      const item = await tx.item.findUnique({ where: { itemCode: from } })
      if (!item) {
        results.push(`[건너뜀] ${from} — 존재하지 않음`)
        continue
      }
      await tx.item.update({
        where: { id: item.id },
        data: { itemCode: to, revisionNumber },
      })
      results.push(`[회로코드] ${from} → ${to} (rev.${revisionNumber})`)
    }

    // ── 2. 대분류/소분류 재배치 (PRODUCT BM/PC/CL → ASSEMBLY/COMPONENT) ──
    for (const [sub, { category, catCode }] of Object.entries(CAT_REMAP)) {
      const items = await tx.item.findMany({
        where: { category: 'PRODUCT' as any, subCategory: sub },
      })

      for (const item of items) {
        const segs = item.itemCode.split('-')
        segs[0] = catCode
        const newBase = segs.slice(0, segs.length - 1).join('-')
        const origRev = parseInt(segs[segs.length - 1], 10)

        const existing = await tx.item.findMany({
          where: { itemCode: { startsWith: newBase + '-' }, id: { not: item.id } },
        })
        const usedRevs = new Set(existing.map((e: { itemCode: string }) => parseInt(e.itemCode.split('-').pop()!, 10)))

        let assignedRev = origRev
        if (usedRevs.has(origRev)) {
          assignedRev = Math.max(0, ...Array.from(usedRevs)) + 1
        }

        const newCode = `${newBase}-${String(assignedRev).padStart(3, '0')}`
        await tx.item.update({
          where: { id: item.id },
          data: { itemCode: newCode, revisionNumber: assignedRev, category: category as any },
        })
        results.push(`[분류재배치] ${item.itemCode} → ${newCode} (${category}/${sub})`)
      }
    }
  }, { timeout: 30000 })

  return NextResponse.json({
    success: true,
    message: `${results.length}개 항목이 마이그레이션되었습니다.`,
    results,
  })
}
