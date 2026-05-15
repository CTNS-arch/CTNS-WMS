import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const storeRow  = await prisma.appOption.findUnique({ where: { key: '__store__'  } })
    const groupsRow = await prisma.appOption.findUnique({ where: { key: '__groups__' } })
    return NextResponse.json({
      success: true,
      data: {
        options:          storeRow?.data  ?? null,
        cellModelGroups:  groupsRow?.data ?? null,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body: { options?: unknown; cellModelGroups?: unknown } = await req.json()

    if (body.options !== undefined) {
      await prisma.appOption.upsert({
        where:  { key: '__store__' },
        update: { data: body.options as any },
        create: { key: '__store__', data: body.options as any },
      })
    }
    if (body.cellModelGroups !== undefined) {
      await prisma.appOption.upsert({
        where:  { key: '__groups__' },
        update: { data: body.cellModelGroups as any },
        create: { key: '__groups__', data: body.cellModelGroups as any },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
