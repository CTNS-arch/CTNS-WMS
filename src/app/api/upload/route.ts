import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'drawings')

async function ensureDir() {
  if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true })
}

export async function POST(req: NextRequest) {
  try {
    await ensureDir()
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0)
      return NextResponse.json({ success: false, message: '파일이 없습니다.' }, { status: 400 })

    const urls: string[] = []
    for (const file of files) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // 원본 파일명 보존 (특수문자 제거)
      const safeName = file.name.replace(/[^\w가-힣._-]/g, '_')
      const filename = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`
      await writeFile(join(UPLOAD_DIR, filename), buffer)
      urls.push(`/uploads/drawings/${filename}`)
    }

    return NextResponse.json({ success: true, data: { urls } })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || !url.startsWith('/uploads/drawings/'))
      return NextResponse.json({ success: false, message: '잘못된 파일 경로입니다.' }, { status: 400 })

    const filepath = join(process.cwd(), 'public', url)
    if (existsSync(filepath)) await unlink(filepath)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
