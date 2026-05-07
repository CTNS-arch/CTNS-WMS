import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const checks: Record<string, unknown> = {}

  checks.env = {
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    AZURE_AD_CLIENT_ID: !!process.env.AZURE_AD_CLIENT_ID,
    AZURE_AD_CLIENT_SECRET: !!process.env.AZURE_AD_CLIENT_SECRET,
    AZURE_AD_TENANT_ID: !!process.env.AZURE_AD_TENANT_ID,
    DATABASE_URL: !!process.env.DATABASE_URL,
  }

  try {
    const count = await prisma.user.count()
    checks.db = { ok: true, userCount: count }
  } catch (e: unknown) {
    checks.db = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json(checks)
}
