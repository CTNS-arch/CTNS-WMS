import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PurchaseStatus } from '@prisma/client'

const EXTERNAL_ALLOWED_STATUSES: PurchaseStatus[] = ['APPROVED', 'WAITING', 'ORDER_PROGRESS', 'ORDERED', 'RECEIVED', 'SETTLED']

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10))
    const skip = (page - 1) * limit
    const department = searchParams.get('department')
    // 외부 거래처 클라이언트가 전달하는 플래그
    const externalView = searchParams.get('externalView') === '1'

    const where: any = {}

    if (externalView) {
      // 외부 거래처: 허용 상태만 (부서는 파라미터 또는 기본값 생산구매팀)
      if (department) where.department = department
      else where.department = '생산구매팀'
      if (status && EXTERNAL_ALLOWED_STATUSES.includes(status as PurchaseStatus)) {
        where.status = status as PurchaseStatus
      } else {
        where.status = { in: EXTERNAL_ALLOWED_STATUSES }
      }
    } else {
      if (status) where.status = status as PurchaseStatus
      if (department) {
        // '연구비' 탭은 탭명 변경 전 '기타' 데이터도 포함
        where.department = department === '연구비'
          ? { in: ['연구비', '기타'] }
          : department
      }
    }
    if (search?.trim()) {
      where.OR = [
        { documentNo: { contains: search.trim(), mode: 'insensitive' } },
        { title: { contains: search.trim(), mode: 'insensitive' } },
      ]
    }

    // Neon HTTP: Promise.all + include 조합이 암묵적 트랜잭션 유발 → 순차 실행으로 분리
    const requests = await prisma.purchaseRequest.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
    })
    const total = await prisma.purchaseRequest.count({ where })
    const rawCounts = await prisma.purchaseRequest.groupBy({ by: ['status'], where, _count: { _all: true } })

    // 관계 데이터 순차 조회 (include 대신 별도 쿼리)
    const reqIds = requests.map((r: any) => r.id)
    const allItems = reqIds.length > 0
      ? await prisma.purchaseRequestItem.findMany({ where: { purchaseRequestId: { in: reqIds } }, orderBy: { lineNo: 'asc' } })
      : []
    const allFiles = reqIds.length > 0
      ? await prisma.purchaseFile.findMany({ where: { purchaseRequestId: { in: reqIds } }, orderBy: { uploadedAt: 'asc' } })
      : []

    // requester는 requesterId 기반으로 매핑
    const requesterIds = [...new Set(requests.map((r: any) => r.requesterId).filter(Boolean))]
    const requesters = requesterIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: requesterIds } }, select: { id: true, name: true, email: true } })
      : []
    const requesterMap: Record<string, any> = Object.fromEntries(requesters.map(u => [u.id, u]))

    const itemsByReq: Record<string, any[]> = {}
    for (const it of allItems) {
      if (!itemsByReq[it.purchaseRequestId]) itemsByReq[it.purchaseRequestId] = []
      itemsByReq[it.purchaseRequestId].push(it)
    }
    const filesByReq: Record<string, any[]> = {}
    for (const f of allFiles) {
      if (!filesByReq[f.purchaseRequestId]) filesByReq[f.purchaseRequestId] = []
      filesByReq[f.purchaseRequestId].push(f)
    }
    const requestsWithRelations = requests.map((r: any) => ({
      ...r,
      items: itemsByReq[r.id] ?? [],
      files: filesByReq[r.id] ?? [],
      requester: r.requesterId ? (requesterMap[r.requesterId] ?? null) : null,
    }))

    const statusCounts: Record<string, number> = {}
    for (const row of rawCounts) statusCounts[row.status] = row._count._all

    return NextResponse.json({ success: true, data: { requests: requestsWithRelations, total, page, limit, statusCounts } })
  } catch (error) {
    console.error('[GET /api/purchases]', error)
    return NextResponse.json({ success: false, message: '데이터를 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { documentNo, title, requesterName, department, memo, items, requesterId, approvalLine } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: '품목을 1개 이상 입력해주세요.' }, { status: 400 })
    }
    const validItems = items.filter((it: any) => it.quantity && Number(it.quantity) > 0 && it.unit?.trim())
    if (validItems.length === 0) {
      return NextResponse.json({ success: false, message: '수량과 단위가 입력된 품목이 필요합니다.' }, { status: 400 })
    }

    const created = await prisma.purchaseRequest.create({
      data: {
        documentNo: documentNo?.trim() || null,
        title: title?.trim() || documentNo?.trim() || '구매요청',
        requesterName: requesterName?.trim() || null,
        department: department?.trim() || '생산구매팀',
        memo: memo?.trim() || null,
        requesterId: requesterId || null,
        approvalLine: approvalLine ? JSON.stringify(approvalLine) : null,
      },
    })
    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i]
      await prisma.purchaseRequestItem.create({
        data: {
          purchaseRequestId: created.id,
          lineNo: i + 1,
          workCode: it.workCode?.trim() || null,
          itemId: it.itemId || null,
          category: it.category?.trim() || null,
          midCategory: it.midCategory?.trim() || null,
          subCategory: it.subCategory?.trim() || null,
          bomNo: it.bomNo?.trim() || null,
          spec: it.spec?.trim() || null,
          quantity: Number(it.quantity),
          unit: it.unit?.trim() || 'EA',
          currency: it.currency || 'KRW',
          supplyAmount: it.supplyAmount != null ? Number(it.supplyAmount) : null,
          taxAmount: it.taxAmount != null ? Number(it.taxAmount) : null,
          purchaseReason: it.purchaseReason?.trim() || null,
          requestedDeliveryDate: it.requestedDeliveryDate ? new Date(it.requestedDeliveryDate) : null,
          supplier: it.supplier?.trim() || null,
          deliveryLocation: it.deliveryLocation?.trim() || null,
        },
      })
    }
    const createdItems = await prisma.purchaseRequestItem.findMany({ where: { purchaseRequestId: created.id }, orderBy: { lineNo: 'asc' } })
    return NextResponse.json({ success: true, data: { ...created, items: createdItems, files: [] } }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/purchases]', error)
    return NextResponse.json({ success: false, message: '구매 요청 생성에 실패했습니다.' }, { status: 500 })
  }
}
