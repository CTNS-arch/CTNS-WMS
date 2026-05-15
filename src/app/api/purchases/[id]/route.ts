import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PurchaseStatus } from '@prisma/client'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const request = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        items: { orderBy: { lineNo: 'asc' } },
        requester: { select: { name: true, email: true } },
        files: { orderBy: { uploadedAt: 'asc' } },
      },
    })
    if (!request) return NextResponse.json({ success: false, message: '구매 요청을 찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json({ success: true, data: request })
  } catch (error) {
    return NextResponse.json({ success: false, message: '데이터를 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const {
      documentNo, title, requesterName, department, memo, status, items, buyerItems, approvalLine,
      miscWorkCode, miscSupplier, miscUrl, miscTotalAmount, miscDocumentRef, miscDeliveryLoc, miscOrderMethod,
      cardUsed, miscPaymentType, miscExpenseRef, miscTaxInvoice, miscActualAmount, miscMemo,
    } = body

    const data: any = {}
    if (status !== undefined)        data.status = status as PurchaseStatus
    if (title !== undefined)         data.title = title.trim()
    if (documentNo !== undefined)    data.documentNo = documentNo?.trim() || null
    if (requesterName !== undefined) data.requesterName = requesterName?.trim() || null
    if (department !== undefined)    data.department = department.trim()
    if (memo !== undefined)          data.memo = memo?.trim() || null
    if (approvalLine !== undefined)  data.approvalLine = approvalLine ? JSON.stringify(approvalLine) : null
    if (miscWorkCode !== undefined)    data.miscWorkCode    = miscWorkCode?.trim()    || null
    if (miscSupplier !== undefined)    data.miscSupplier    = miscSupplier?.trim()    || null
    if (miscUrl !== undefined)         data.miscUrl         = miscUrl?.trim()         || null
    if (miscTotalAmount !== undefined) data.miscTotalAmount = miscTotalAmount != null  ? Number(miscTotalAmount) : null
    if (miscDocumentRef !== undefined) data.miscDocumentRef = miscDocumentRef?.trim() || null
    if (miscDeliveryLoc !== undefined)  data.miscDeliveryLoc  = miscDeliveryLoc?.trim()  || null
    if (miscOrderMethod !== undefined)  data.miscOrderMethod  = miscOrderMethod?.trim()  || null
    if (cardUsed !== undefined)         data.cardUsed         = cardUsed?.trim()         || null
    if (miscPaymentType !== undefined)  data.miscPaymentType  = miscPaymentType?.trim()  || null
    if (miscExpenseRef !== undefined)    data.miscExpenseRef    = miscExpenseRef?.trim()    || null
    if (miscTaxInvoice !== undefined)    data.miscTaxInvoice    = miscTaxInvoice?.trim()    || null
    if (miscActualAmount !== undefined)  data.miscActualAmount  = miscActualAmount != null   ? Number(miscActualAmount) : null
    if (miscMemo !== undefined)          data.miscMemo          = miscMemo?.trim()           || null

    // Neon HTTP 어댑터: $transaction 미지원 → 순차 실행
    // 요청자 모드: 품목 전체 교체
    if (items !== undefined) {
      await prisma.purchaseRequestItem.deleteMany({ where: { purchaseRequestId: id } })
      const validItems = items.filter((it: any) => it.quantity && Number(it.quantity) > 0 && it.unit?.trim())
      for (let i = 0; i < validItems.length; i++) {
        const it = validItems[i]
        await prisma.purchaseRequestItem.create({
          data: {
            purchaseRequestId: id,
            lineNo: i + 1,
            domestic: it.domestic?.trim() || null,
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
            additionalCost: it.additionalCost != null ? Number(it.additionalCost) : null,
            supplyAmount: it.supplyAmount != null ? Number(it.supplyAmount) : null,
            taxAmount: it.taxAmount != null ? Number(it.taxAmount) : null,
            purchaseReason: it.purchaseReason?.trim() || null,
            requestedDeliveryDate: it.requestedDeliveryDate ? new Date(it.requestedDeliveryDate) : null,
            supplier: it.supplier?.trim() || null,
            deliveryLocation: it.deliveryLocation?.trim() || null,
          },
        })
      }
    }

    // 구매자 모드: 품목별 구매 필드만 업데이트
    if (buyerItems !== undefined && Array.isArray(buyerItems)) {
      for (const bi of buyerItems) {
        if (!bi.id) continue
        await prisma.purchaseRequestItem.update({
          where: { id: bi.id },
          data: {
            supplier: bi.supplier?.trim() || null,
            domestic: bi.domestic?.trim() || null,
            orderMethod: bi.orderMethod?.trim() || null,
            orderNo: bi.orderNo?.trim() || null,
            plannedShipDate: bi.plannedShipDate ? new Date(bi.plannedShipDate) : null,
            actualShipDate: bi.actualShipDate ? new Date(bi.actualShipDate) : null,
            shippingMethod: bi.shippingMethod?.trim() || null,
            trackingNo: bi.trackingNo?.trim() || null,
            boxCount: bi.boxCount != null ? Number(bi.boxCount) : null,
            boxUnitQty: bi.boxUnitQty != null ? Number(bi.boxUnitQty) : null,
            remittanceDate: bi.remittanceDate ? new Date(bi.remittanceDate) : null,
            paymentDate: bi.paymentDate ? new Date(bi.paymentDate) : null,
            buyerCurrency: bi.buyerCurrency || null,
            buyerSupplyAmount: bi.buyerSupplyAmount != null ? Number(bi.buyerSupplyAmount) : null,
            buyerTaxAmount: bi.buyerTaxAmount != null ? Number(bi.buyerTaxAmount) : null,
            additionalCost: bi.additionalCost != null ? Number(bi.additionalCost) : null,
            portArrivalDate: bi.portArrivalDate ? new Date(bi.portArrivalDate) : null,
            loadingDate: bi.loadingDate ? new Date(bi.loadingDate) : null,
            estimatedArrivalDate: bi.estimatedArrivalDate ? new Date(bi.estimatedArrivalDate) : null,
            actualReceiptDate: bi.actualReceiptDate ? new Date(bi.actualReceiptDate) : null,
            blNo: bi.blNo?.trim() || null,
            buyerMemo: bi.buyerMemo?.trim() || null,
            exchangeRate: bi.exchangeRate != null ? Number(bi.exchangeRate) : null,
            krwAmount: bi.krwAmount != null ? Number(bi.krwAmount) : null,
            unitPrice: bi.unitPrice != null ? Number(bi.unitPrice) : null,
            paymentMethod: bi.paymentMethod?.trim() || null,
            payBankName: bi.payBankName?.trim() || null,
            payAccountNumber: bi.payAccountNumber?.trim() || null,
            payAccountHolder: bi.payAccountHolder?.trim() || null,
          },
        })
      }
    }

    // Neon HTTP: update+include는 내부 트랜잭션 발생 → 별도 findUnique로 분리
    await prisma.purchaseRequest.update({ where: { id }, data })
    const updated = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        items: { orderBy: { lineNo: 'asc' } },
        requester: { select: { name: true, email: true } },
        files: { orderBy: { uploadedAt: 'asc' } },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('[PATCH /api/purchases/[id]]', error)
    if (error?.code === 'P2025') {
      return NextResponse.json({ success: false, message: '해당 구매 요청을 찾을 수 없습니다.' }, { status: 404 })
    }
    return NextResponse.json({ success: false, message: '구매 요청 수정에 실패했습니다.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await prisma.purchaseRequest.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, message: '해당 구매 요청을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ success: false, message: '검토중 상태의 요청만 삭제할 수 있습니다.' }, { status: 400 })
    }
    await prisma.purchaseRequest.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE /api/purchases/[id]]', error)
    if (error?.code === 'P2025') {
      return NextResponse.json({ success: false, message: '해당 구매 요청을 찾을 수 없습니다.' }, { status: 404 })
    }
    return NextResponse.json({ success: false, message: '구매 요청 삭제에 실패했습니다.' }, { status: 500 })
  }
}
