import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const log = readFileSync(join(process.cwd(), 'auth-debug.log'), 'utf-8')
    return new NextResponse(log, { headers: { 'Content-Type': 'text/plain' } })
  } catch {
    return new NextResponse('로그 없음 (아직 로그인 시도 안 함)', { headers: { 'Content-Type': 'text/plain' } })
  }
}

export async function DELETE() {
  try {
    const { unlinkSync } = await import('fs')
    unlinkSync(join(process.cwd(), 'auth-debug.log'))
  } catch {}
  return new NextResponse('로그 삭제됨')
}
