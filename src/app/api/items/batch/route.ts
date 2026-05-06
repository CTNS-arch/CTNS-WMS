import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ItemStatus } from '@prisma/client'

export async function PATCH(req: NextRequest) {
  try {
    const { ids, status } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0)
      return NextResponse.json({ success: false, message: '변경할 품목 ID 목록이 필요합니다.' }, { status: 400 })
    if (!status)
      return NextResponse.json({ success: false, message: '변경할 상태값이 필요합니다.' }, { status: 400 })

    const validStatuses: ItemStatus[] = ['ACTIVE', 'INACTIVE', 'RESTRICTED', 'DISCONTINUED']
    if (!validStatuses.includes(status))
      return NextResponse.json({ success: false, message: '유효하지 않은 상태값입니다.' }, { status: 400 })

    const { count } = await prisma.item.updateMany({
      where: { id: { in: ids } },
      data: { status },
    })
    return NextResponse.json({ success: true, message: `${count}개 품목 상태가 변경되었습니다.` })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0)
      return NextResponse.json({ success: false, message: '삭제할 품목 ID 목록이 필요합니다.' }, { status: 400 })

    const bomCount = await prisma.bOM.count({
      where: { OR: [{ parentId: { in: ids } }, { childId: { in: ids } }] },
    })
    if (bomCount > 0)
      return NextResponse.json(
        { success: false, message: 'BOM에 사용 중인 품목이 포함되어 있습니다.' },
        { status: 409 }
      )

    const { count } = await prisma.item.deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json({ success: true, message: `${count}개 품목이 삭제되었습니다.` })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
