'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '검토중', APPROVED: '승인', ORDERED: '발주', RECEIVED: '입고완료', REJECTED: '반려',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  ORDERED: 'bg-purple-100 text-purple-700',
  RECEIVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}
const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'ORDERED', 'RECEIVED', 'REJECTED']
const FILTER_PILLS = [
  { value: '', label: '전체' },
  { value: 'PENDING', label: '검토중' },
  { value: 'APPROVED', label: '승인' },
  { value: 'ORDERED', label: '발주' },
  { value: 'RECEIVED', label: '입고완료' },
  { value: 'REJECTED', label: '반려' },
]
const DEPT_OPTIONS = ['생산구매팀', '연구소', '기타']
const CATEGORY_OPTIONS = ['원자재', '소모품', '공구', '설비', '기타']
const LIMIT = 20

type ItemRow = {
  workCode: string; category: string; midCategory: string; subCategory: string
  bomNo: string; spec: string; quantity: string; unit: string; purchaseReason: string
}

const emptyRow = (): ItemRow => ({
  workCode: '', category: '', midCategory: '', subCategory: '',
  bomNo: '', spec: '', quantity: '', unit: 'EA', purchaseReason: '',
})

const emptyForm = () => ({ title: '', department: '생산구매팀', memo: '', items: [emptyRow()] })

export default function PurchasesPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editReq, setEditReq] = useState<any | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const fetchRequests = useCallback(async (p: number, status: string, q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (q.trim()) params.set('search', q.trim())
      params.set('page', String(p))
      params.set('limit', String(LIMIT))
      const res = await fetch(`/api/purchases?${params}`)
      const json = await res.json()
      if (json.success) {
        setRequests(json.data.requests)
        setTotal(json.data.total)
        setPage(json.data.page)
      } else {
        toast.error('데이터를 불러오지 못했습니다.')
      }
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRequests(page, filterStatus, search) }, [fetchRequests, page, filterStatus, search])

  function openCreate() {
    setEditReq(null)
    setForm(emptyForm())
    setFormOpen(true)
  }

  function openEdit(req: any) {
    setEditReq(req)
    setForm({
      title: req.title ?? '',
      department: req.department ?? '생산구매팀',
      memo: req.memo ?? '',
      items: req.items?.length > 0
        ? req.items.map((it: any) => ({
          workCode: it.workCode ?? '', category: it.category ?? '',
          midCategory: it.midCategory ?? '', subCategory: it.subCategory ?? '',
          bomNo: it.bomNo ?? '', spec: it.spec ?? '',
          quantity: String(it.quantity), unit: it.unit ?? 'EA',
          purchaseReason: it.purchaseReason ?? '',
        }))
        : [emptyRow()],
    })
    setFormOpen(true)
  }

  function updateItem(idx: number, key: keyof ItemRow, val: string) {
    setForm(f => ({
      ...f,
      items: f.items.map((row, i) => i === idx ? { ...row, [key]: val } : row),
    }))
  }

  function addRow() { setForm(f => ({ ...f, items: [...f.items, emptyRow()] })) }

  function removeRow(idx: number) {
    setForm(f => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : f.items }))
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('제목을 입력해주세요.'); return }
    const validItems = form.items.filter(it => it.quantity && Number(it.quantity) > 0 && it.unit.trim())
    if (validItems.length === 0) { toast.error('수량과 단위가 입력된 품목이 1개 이상 필요합니다.'); return }

    setSaving(true)
    try {
      const body = { title: form.title, department: form.department, memo: form.memo, items: form.items }
      const res = await fetch(editReq ? `/api/purchases/${editReq.id}` : '/api/purchases', {
        method: editReq ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(editReq ? '수정되었습니다.' : '등록되었습니다.')
        setFormOpen(false)
        fetchRequests(page, filterStatus, search)
      } else {
        toast.error(json.message ?? '저장에 실패했습니다.')
      }
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setSaving(false) }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      const res = await fetch(`/api/purchases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('상태가 변경되었습니다.')
        fetchRequests(page, filterStatus, search)
      } else { toast.error(json.message ?? '상태 변경 실패') }
    } catch { toast.error('서버 오류가 발생했습니다.') }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/purchases/${deleteId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success('삭제되었습니다.')
        setDeleteId(null)
        fetchRequests(requests.length === 1 && page > 1 ? page - 1 : page, filterStatus, search)
      } else { toast.error(json.message ?? '삭제 실패') }
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setDeleting(false) }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 타이틀 */}
      <div className="px-6 py-3 border-b bg-white shrink-0">
        <h1 className="text-sm font-semibold text-gray-800">구매 요청</h1>
      </div>

      {/* 필터 바 */}
      <div className="px-4 py-2.5 border-b bg-white flex items-center gap-2 flex-wrap shrink-0">
        <div className="flex gap-1">
          {FILTER_PILLS.map(pill => (
            <button key={pill.value} onClick={() => { setFilterStatus(pill.value); setPage(1) }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterStatus === pill.value ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{pill.label}</button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1) }} className="flex gap-1">
          <Input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="제목 검색" className="h-8 text-xs w-44" />
          <Button type="submit" variant="outline" size="sm" className="h-8 text-xs px-3">검색</Button>
        </form>
        <div className="ml-auto">
          <Button onClick={openCreate} size="sm" className="h-8 text-xs">+ 구매요청</Button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto">
        <table className="text-xs w-full" style={{ minWidth: 760 }}>
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {['요청일', '제목', '부서', '품목수', '상태', '관리'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-400">불러오는 중...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-400">구매 요청 내역이 없습니다.</td></tr>
            ) : requests.map(req => (
              <tr key={req.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                  {new Date(req.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-3 py-2 font-medium text-gray-800 max-w-[280px] truncate">{req.title}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{req.department}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{req.items?.length ?? 0}건</td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[req.status] ?? ''}`}>
                    {STATUS_LABEL[req.status] ?? req.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => openEdit(req)}>수정</Button>
                    {req.status === 'PENDING' && (
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-2" onClick={() => setDeleteId(req.id)}>삭제</Button>
                    )}
                    <Select value={req.status} onValueChange={val => handleStatusChange(req.id, val)}>
                      <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s} value={s} className="text-xs">{STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="px-4 py-2 border-t bg-white shrink-0 flex items-center justify-between">
        <span className="text-xs text-gray-500">총 {total.toLocaleString()}건</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>이전</Button>
          <span className="text-xs text-gray-600 px-2">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>다음</Button>
        </div>
      </div>

      {/* 등록/수정 다이얼로그 */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {editReq ? '구매 요청 수정' : '구매 요청 등록'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1">
            {/* 제목 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">구매요청 제목 <span className="text-red-500">*</span></label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="예) [삼성전자] P26-0502_삼성전자 대응_FRT COVER 외 1건_구매요청"
                className="h-8 text-xs" />
            </div>

            {/* 부서 + 요청일 */}
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 w-48">
                <label className="text-xs font-medium text-gray-700">구매요청부서 <span className="text-red-500">*</span></label>
                <Select value={form.department} onValueChange={(val: string | null) => setForm(f => ({ ...f, department: val ?? '생산구매팀' }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPT_OPTIONS.map(d => <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">구매요청일</label>
                <div className="h-8 flex items-center px-3 border rounded-md text-xs text-gray-500 bg-gray-50">
                  {new Date().toLocaleDateString('ko-KR')}
                </div>
              </div>
            </div>

            {/* 품목 테이블 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">품목 <span className="text-red-500">*</span></label>
              <div className="overflow-x-auto border rounded-md">
                <table className="text-xs w-full" style={{ minWidth: 960 }}>
                  <thead className="bg-gray-50">
                    <tr>
                      {['NO', 'WORK CODE', '구분', '중분류', '소분류', 'BOM No.', '규격', '수량*', '단위*', '구매 사유', ''].map(h => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium text-gray-500 border-b whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((row, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="px-2 py-1 text-gray-400 text-center w-8">{idx + 1}</td>
                        <td className="px-1 py-1 w-24">
                          <Input value={row.workCode} onChange={e => updateItem(idx, 'workCode', e.target.value)}
                            placeholder="P26-0502" className="h-7 text-xs px-2" />
                        </td>
                        <td className="px-1 py-1 w-24">
                          <Select value={row.category || '_none'} onValueChange={(val: string | null) => updateItem(idx, 'category', (!val || val === '_none') ? '' : val)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none" className="text-xs text-gray-400">-</SelectItem>
                              {CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-1 py-1 w-20">
                          <Input value={row.midCategory} onChange={e => updateItem(idx, 'midCategory', e.target.value)}
                            placeholder="케이스" className="h-7 text-xs px-2" />
                        </td>
                        <td className="px-1 py-1 w-20">
                          <Input value={row.subCategory} onChange={e => updateItem(idx, 'subCategory', e.target.value)}
                            placeholder="스틸" className="h-7 text-xs px-2" />
                        </td>
                        <td className="px-1 py-1 w-24">
                          <Input value={row.bomNo} onChange={e => updateItem(idx, 'bomNo', e.target.value)}
                            placeholder="CCST010" className="h-7 text-xs px-2" />
                        </td>
                        <td className="px-1 py-1 w-36">
                          <Input value={row.spec} onChange={e => updateItem(idx, 'spec', e.target.value)}
                            placeholder="215*210*2.0t" className="h-7 text-xs px-2" />
                        </td>
                        <td className="px-1 py-1 w-16">
                          <Input type="number" min={0} value={row.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)}
                            placeholder="0" className="h-7 text-xs px-2" />
                        </td>
                        <td className="px-1 py-1 w-16">
                          <Input value={row.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                            placeholder="EA" className="h-7 text-xs px-2" />
                        </td>
                        <td className="px-1 py-1">
                          <Input value={row.purchaseReason} onChange={e => updateItem(idx, 'purchaseReason', e.target.value)}
                            placeholder="삼성전자 대응" className="h-7 text-xs px-2" />
                        </td>
                        <td className="px-1 py-1 w-8 text-center">
                          <button onClick={() => removeRow(idx)}
                            className="text-gray-300 hover:text-red-400 text-base leading-none">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs w-24 mt-1" onClick={addRow}>+ 행 추가</Button>
            </div>

            {/* 비고 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">비고</label>
              <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                rows={2} placeholder="비고 사항을 입력하세요"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setFormOpen(false)} disabled={saving}>취소</Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold">구매 요청 삭제</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600">
              구매 요청을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs" disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction className="h-8 text-xs bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={deleting}>
              {deleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
