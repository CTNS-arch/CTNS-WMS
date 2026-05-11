import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0)
      return NextResponse.json({ success: false, message: '파일이 없습니다.' }, { status: 400 })

    const urls: string[] = []
    for (const file of files) {
      const safeName = file.name.replace(/[^\w가-힣._-]/g, '_')
      const pathname = `uploads/drawings/${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`
      const blob = await put(pathname, file, { access: 'public' })
      urls.push(blob.url)
    }

    return NextResponse.json({ success: true, data: { urls } })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url)
      return NextResponse.json({ success: false, message: '잘못된 파일 경로입니다.' }, { status: 400 })

    if (url.startsWith('https://')) await del(url)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
