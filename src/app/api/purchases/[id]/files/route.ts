import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'
import { randomUUID } from 'crypto'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const files = await prisma.purchaseFile.findMany({
      where: { purchaseRequestId: id },
      orderBy: { uploadedAt: 'asc' },
    })
    return NextResponse.json({ success: true, data: files })
  } catch (error) {
    return NextResponse.json({ success: false, message: '파일 목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const fileType = formData.get('fileType') as string | null

    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, message: '파일이 없습니다.' }, { status: 400 })
    }

    const saved = []
    for (const file of files) {
      const safeName = file.name.replace(/[^\w가-힣._-]/g, '_')
      const pathname = `uploads/purchases/${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`
      const blob = await put(pathname, file, { access: 'public' })

      const record = await prisma.purchaseFile.create({
        data: {
          purchaseRequestId: id,
          fileName: file.name,
          fileUrl: blob.url,
          fileType: fileType || '기타',
          fileSize: file.size,
        },
      })
      saved.push(record)
    }

    return NextResponse.json({ success: true, data: saved }, { status: 201 })
  } catch (error: any) {
    console.error('[POST /api/purchases/[id]/files]', error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
