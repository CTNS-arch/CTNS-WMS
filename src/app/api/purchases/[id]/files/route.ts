import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

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

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'purchases', id)
    await mkdir(uploadDir, { recursive: true })

    const saved = []
    for (const file of files) {
      const safeName = file.name.replace(/[^\w가-힣._-]/g, '_')
      const unique = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`
      const filePath = path.join(uploadDir, unique)

      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(filePath, buffer)

      const fileUrl = `/uploads/purchases/${id}/${unique}`

      const record = await prisma.purchaseFile.create({
        data: {
          purchaseRequestId: id,
          fileName: file.name,
          fileUrl,
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
