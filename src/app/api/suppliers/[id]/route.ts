import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const {
      companyName, status, region,
      businessRegNo, url, bankName, accountNumber, accountHolder, subCategory, note,
      contacts, itemIds, files,
    } = body

    const updateData: any = {}
    if (companyName !== undefined) updateData.companyName = companyName
    if (status !== undefined) updateData.status = status
    if (region !== undefined) updateData.region = region
    if (businessRegNo !== undefined) updateData.businessRegNo = businessRegNo || null
    if (url !== undefined) updateData.url = url || null
    if (bankName !== undefined) updateData.bankName = bankName || null
    if (accountNumber !== undefined) updateData.accountNumber = accountNumber || null
    if (accountHolder !== undefined) updateData.accountHolder = accountHolder || null
    if (subCategory !== undefined) updateData.subCategory = subCategory || null
    if (note !== undefined) updateData.note = note || null

    await prisma.supplier.update({ where: { id }, data: updateData })

    // Neon HTTP: createMany 대신 개별 create 루프 사용
    if (contacts !== undefined) {
      await prisma.supplierContact.deleteMany({ where: { supplierId: id } })
      for (const c of contacts.filter((c: any) => c.name?.trim())) {
        await prisma.supplierContact.create({
          data: {
            supplierId: id,
            name: c.name.trim(),
            title: c.title || null,
            phone: c.phone || null,
            email: c.email || null,
          },
        })
      }
    }

    if (itemIds !== undefined) {
      await prisma.supplierItem.deleteMany({ where: { supplierId: id } })
      for (const itemId of (itemIds as string[])) {
        await prisma.supplierItem.create({ data: { supplierId: id, itemId } })
      }
    }

    if (files !== undefined) {
      await prisma.supplierFile.deleteMany({ where: { supplierId: id } })
      for (const f of (files as any[])) {
        await prisma.supplierFile.create({
          data: {
            supplierId: id,
            fileName: f.fileName,
            fileUrl: f.fileUrl,
            fileSize: f.fileSize ?? null,
            mimeType: f.mimeType ?? null,
          },
        })
      }
    }

    const result = await prisma.supplier.findUnique({
      where: { id },
      include: {
        contacts: true,
        files: true,
        items: { include: { item: { select: { id: true, itemCode: true, itemName: true, category: true, subCategory: true, status: true } } } },
      },
    })

    return NextResponse.json({ success: true, data: result })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.supplier.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
