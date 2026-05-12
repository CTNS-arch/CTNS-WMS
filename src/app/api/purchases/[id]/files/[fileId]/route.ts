import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { del } from '@vercel/blob'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const { fileId } = await params
    const file = await prisma.purchaseFile.findUnique({ where: { id: fileId } })
    if (!file) return NextResponse.json({ success: false, message: '파일을 찾을 수 없습니다.' }, { status: 404 })

    if (file.fileUrl.startsWith('https://')) await del(file.fileUrl)
    await prisma.purchaseFile.delete({ where: { id: fileId } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const { fileId } = await params
    const { fileType } = await req.json()
    const updated = await prisma.purchaseFile.update({
      where: { id: fileId },
      data: { fileType },
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
