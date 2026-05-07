'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
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
const CATEGORY_OPTIONS = ['완제품', '반제품', '자재', '소모품', '공구', '설비', '기타']
const ITEM_CAT_LABEL: Record<string, string> = {
  PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재',
}
const SUB_CAT_LABEL: Record<string, string> = {
  BP: '배터리팩', BM: 'BMS', PC: 'PCM',
  CL: '셀', EL: '전장/전기부품', ME: '기구/외장부품',
  CD: '도전재', PK: '포장자재', FS: '체결부품',
  SM: '부자재/소모품', RM: '일반자재', OT: '생품/기타',
}

type Approver = { order: number; role: string; name: string }
const DEFAULT_APPROVAL_LINE: Approver[] = [
  { order: 1, role: '기안자', name: '' },
  { order: 2, role: '검토자', name: '담당자명 입력' },
  { order: 3, role: '승인자', name: '담당자명 입력' },
]

const LIMIT = 20
const DEFAULT_ROWS = 8

type ItemRow = {
  workCode: string; category: string; midCategory: string; subCategory: string
  bomNo: string; spec: string; quantity: string; unit: string; purchaseReason: string
}

const emptyRow = (): ItemRow => ({
  workCode: '', category: '', midCategory: '', subCategory: '',
  bomNo: '', spec: '', quantity: '', unit: 'EA', purchaseReason: '',
})

const initRows = () => Array.from({ length: DEFAULT_ROWS }, emptyRow)

const emptyForm = () => ({
  title: '', department: '생산구매팀', memo: '',
  items: initRows(),
  approvalLine: DEFAULT_APPROVAL_LINE.map(a => ({ ...a })),
})

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
  const [approvalEditing, setApprovalEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  const bomRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const bomSearchTimer = useRef<any>(null)
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const [itemDropdown, setItemDropdown] = useState<{
    idx: number
    results: any[]
    pos: { top: number; left: number; width: number }
  } | null>(null)

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
      } else { toast.error('데이터를 불러오지 못했습니다.') }
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRequests(page, filterStatus, search) }, [fetchRequests, page, filterStatus, search])

  function openCreate() {
    setEditReq(null)
    setForm(emptyForm())
    setApprovalEditing(false)
    setFormOpen(true)
    setTimeout(() => titleRef.current?.focus(), 100)
  }

  function openEdit(req: any) {
    setEditReq(req)
    const loaded = req.items?.length > 0
      ? req.items.map((it: any) => ({
          workCode: it.workCode ?? '', category: it.category ?? '',
          midCategory: it.midCategory ?? '', subCategory: it.subCategory ?? '',
          bomNo: it.bomNo ?? '', spec: it.spec ?? '',
          quantity: String(it.quantity), unit: it.unit ?? 'EA',
          purchaseReason: it.purchaseReason ?? '',
        }))
      : []
    // pad to at least DEFAULT_ROWS
    while (loaded.length < DEFAULT_ROWS) loaded.push(emptyRow())
    let loadedApproval: Approver[]
    try { loadedApproval = req.approvalLine ? JSON.parse(req.approvalLine) : DEFAULT_APPROVAL_LINE.map(a => ({ ...a })) }
    catch { loadedApproval = DEFAULT_APPROVAL_LINE.map(a => ({ ...a })) }
    setForm({ title: req.title ?? '', department: req.department ?? '생산구매팀', memo: req.memo ?? '', items: loaded, approvalLine: loadedApproval })
    setApprovalEditing(false)
    setFormOpen(true)
  }

  function updateItem(idx: number, key: keyof ItemRow, val: string) {
    setForm(f => ({ ...f, items: f.items.map((r, i) => i === idx ? { ...r, [key]: val } : r) }))
  }

  function addRows(n = 5) {
    setForm(f => ({ ...f, items: [...f.items, ...Array.from({ length: n }, emptyRow)] }))
  }

  function clearRow(idx: number) {
    setForm(f => ({ ...f, items: f.items.map((r, i) => i === idx ? emptyRow() : r) }))
  }

  async function fetchBomItems(query: string, idx: number) {
    const el = bomRefs.current[idx]
    if (!el) return
    try {
      const url = query.trim()
        ? `/api/items?search=${encodeURIComponent(query)}&limit=10`
        : `/api/items?limit=10&sortBy=createdAt&sortOrder=desc`
      const res = await fetch(url)
      const json = await res.json()
      if (json.success) {
        const r = el.getBoundingClientRect()
        if (json.data.items.length > 0) {
          setItemDropdown({ idx, results: json.data.items, pos: { top: r.bottom + 2, left: r.left, width: r.width } })
        } else {
          setItemDropdown(d => d?.idx === idx ? null : d)
        }
      }
    } catch { setItemDropdown(null) }
  }

  function handleBomFocus(idx: number) {
    fetchBomItems(form.items[idx]?.bomNo ?? '', idx)
  }

  function handleBomInput(idx: number, value: string) {
    updateItem(idx, 'bomNo', value)
    clearTimeout(bomSearchTimer.current)
    bomSearchTimer.current = setTimeout(() => fetchBomItems(value, idx), 200)
  }

  function selectBomItem(item: any) {
    if (!itemDropdown) return
    const idx = itemDropdown.idx
    setForm(f => ({
      ...f,
      items: f.items.map((r, i) => i === idx ? {
        ...r,
        bomNo: item.itemCode,
        spec: item.itemName || r.spec,
        unit: item.unit || r.unit,
        category: ITEM_CAT_LABEL[item.category] || r.category,
        midCategory: item.subCategory ? (SUB_CAT_LABEL[item.subCategory] ?? item.subCategory) : r.midCategory,
      } : r),
    }))
    setItemDropdown(null)
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('제목을 입력해주세요.'); titleRef.current?.focus(); return }
    const validItems = form.items.filter(it => it.quantity && Number(it.quantity) > 0 && it.unit.trim())
    if (validItems.length === 0) { toast.error('수량과 단위가 입력된 품목이 1개 이상 필요합니다.'); return }

    setSaving(true)
    try {
      const body = { title: form.title, department: form.department, memo: form.memo, items: form.items, approvalLine: form.approvalLine }
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
      } else { toast.error(json.message ?? '저장에 실패했습니다.') }
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setSaving(false) }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      const res = await fetch(`/api/purchases/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (json.success) { toast.success('상태가 변경되었습니다.'); fetchRequests(page, filterStatus, search) }
      else { toast.error(json.message ?? '상태 변경 실패') }
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

  // Cell input style
  const cell = 'h-8 w-full rounded border-0 bg-transparent px-2 text-xs focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none hover:bg-gray-50 transition-colors'

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

      {/* 목록 테이블 */}
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
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{new Date(req.createdAt).toLocaleDateString('ko-KR')}</td>
                <td className="px-3 py-2 font-medium text-gray-800 max-w-[300px] truncate">{req.title}</td>
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
                    <Select value={req.status} onValueChange={val => val && handleStatusChange(req.id, val)}>
                      <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="text-xs">{STATUS_LABEL[s]}</SelectItem>)}
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

      {/* ── 등록/수정 다이얼로그 ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          className="flex flex-col gap-0 p-0 overflow-hidden"
          style={{ width: '92vw', maxWidth: '92vw', height: '88vh', maxHeight: '88vh' }}
        >
          {/* 헤더 */}
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="text-base font-semibold">
              {editReq ? '구매 요청 수정' : '구매 요청 등록'}
            </DialogTitle>
          </DialogHeader>

          {/* 바디 */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-5 px-6 py-4">

            {/* 기본 정보 행 */}
            <div className="flex gap-4 flex-wrap">
              <div className="flex flex-col gap-1 flex-1 min-w-[280px]">
                <label className="text-xs font-medium text-gray-600">구매요청 제목 <span className="text-red-500">*</span></label>
                <Input
                  ref={titleRef}
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예) [삼성전자] P26-0502_삼성전자 대응_FRT COVER 외 1건_구매요청"
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1 w-40">
                <label className="text-xs font-medium text-gray-600">구매요청부서 <span className="text-red-500">*</span></label>
                <Select value={form.department} onValueChange={(val: string | null) => setForm(f => ({ ...f, department: val ?? '생산구매팀' }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPT_OPTIONS.map(d => <SelectItem key={d} value={d} className="text-sm">{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1 w-32">
                <label className="text-xs font-medium text-gray-600">구매요청일</label>
                <div className="h-9 flex items-center px-3 border rounded-md text-sm text-gray-500 bg-gray-50">
                  {new Date().toLocaleDateString('ko-KR')}
                </div>
              </div>
            </div>

            {/* 결재 라인 */}
            <div className="flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-600">결재 라인</label>
                <button
                  type="button"
                  onClick={() => setApprovalEditing(e => !e)}
                  className="text-xs text-blue-500 hover:text-blue-700 underline underline-offset-2"
                >
                  {approvalEditing ? '완료' : '변경'}
                </button>
                {approvalEditing && (
                  <button
                    type="button"
                    onClick={() => { setForm(f => ({ ...f, approvalLine: DEFAULT_APPROVAL_LINE.map(a => ({ ...a })) })); setApprovalEditing(false) }}
                    className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
                  >
                    기본값으로 초기화
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {form.approvalLine.map((approver, i) => (
                  <React.Fragment key={approver.order}>
                    {i > 0 && <span className="text-gray-300 text-sm font-light select-none">→</span>}
                    <div className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg border text-xs min-w-[80px] ${approvalEditing ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                      <span className="text-gray-400 font-medium text-[10px] uppercase tracking-wide">{approver.role}</span>
                      {approvalEditing ? (
                        <input
                          value={approver.name}
                          onChange={e => setForm(f => ({
                            ...f,
                            approvalLine: f.approvalLine.map((a, ai) => ai === i ? { ...a, name: e.target.value } : a),
                          }))}
                          placeholder="이름 입력"
                          className="w-20 text-center text-xs border-0 bg-transparent border-b border-blue-300 focus:outline-none focus:border-blue-500 py-0 px-0 placeholder-gray-300"
                        />
                      ) : (
                        <span className={`font-medium ${approver.name ? 'text-gray-700' : 'text-gray-300 italic'}`}>
                          {approver.name || '미설정'}
                        </span>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* 품목 테이블 */}
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">
                  품목 <span className="text-red-500">*</span>
                  <span className="ml-2 text-gray-400 font-normal">
                    (수량·단위 입력된 행만 저장됩니다)
                  </span>
                </label>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs px-3" onClick={() => addRows(5)}>+ 5행 추가</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs px-3" onClick={() => addRows(10)}>+ 10행 추가</Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-auto flex-1">
                <table className="text-xs border-collapse" style={{ minWidth: 1100, width: '100%' }}>
                  <colgroup>
                    <col style={{ width: 40 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 100 }} />
                    <col style={{ width: 90 }} />
                    <col style={{ width: 90 }} />
                    <col style={{ width: 100 }} />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 70 }} />
                    <col />
                    <col style={{ width: 36 }} />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    <tr>
                      {['NO', '프로젝트코드', '구분', '중분류', '소분류', 'BOM No.', '품목명', '수량', '단위', '구매 사유', ''].map((h, i) => (
                        <th key={i} className="px-2 py-2 text-left text-xs font-semibold text-gray-600 border-b border-r last:border-r-0 whitespace-nowrap bg-gray-50">
                          {h}{(h === '수량' || h === '단위') && <span className="text-red-400 ml-0.5">*</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((row, idx) => {
                      const filled = row.quantity || row.workCode || row.spec || row.purchaseReason
                      return (
                        <tr key={idx} className={`border-b last:border-0 ${filled ? 'bg-blue-50/30' : ''}`}>
                          <td className="px-2 py-0.5 text-center text-gray-400 border-r text-xs">{idx + 1}</td>
                          <td className="px-0.5 py-0.5 border-r">
                            <input value={row.workCode} onChange={e => updateItem(idx, 'workCode', e.target.value)}
                              placeholder="예) P26-0502" className={cell} />
                          </td>
                          <td className="px-0.5 py-0.5 border-r">
                            <Select value={row.category || '_none'}
                              onValueChange={(val: string | null) => updateItem(idx, 'category', (!val || val === '_none') ? '' : val)}>
                              <SelectTrigger className="h-8 text-xs border-0 bg-transparent hover:bg-gray-50 focus:ring-1 focus:ring-blue-400">
                                <SelectValue placeholder="선택" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none" className="text-xs text-gray-400">-</SelectItem>
                                {CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-0.5 py-0.5 border-r">
                            <input value={row.midCategory} onChange={e => updateItem(idx, 'midCategory', e.target.value)}
                              placeholder="케이스" className={cell} />
                          </td>
                          <td className="px-0.5 py-0.5 border-r">
                            <input value={row.subCategory} onChange={e => updateItem(idx, 'subCategory', e.target.value)}
                              placeholder="스틸" className={cell} />
                          </td>
                          <td className="px-0.5 py-0.5 border-r">
                            <input
                              ref={el => { bomRefs.current[idx] = el }}
                              value={row.bomNo}
                              onChange={e => handleBomInput(idx, e.target.value)}
                              onFocus={() => handleBomFocus(idx)}
                              onBlur={() => setTimeout(() => setItemDropdown(d => d?.idx === idx ? null : d), 200)}
                              placeholder="품번 검색"
                              className={cell}
                            />
                          </td>
                          <td className="px-0.5 py-0.5 border-r">
                            <input value={row.spec} onChange={e => updateItem(idx, 'spec', e.target.value)}
                              placeholder="215×210×2.0t" className={cell} />
                          </td>
                          <td className="px-0.5 py-0.5 border-r">
                            <input type="number" min={0} value={row.quantity}
                              onChange={e => updateItem(idx, 'quantity', e.target.value)}
                              placeholder="0" className={cell + ' text-right'} />
                          </td>
                          <td className="px-0.5 py-0.5 border-r">
                            <input value={row.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                              placeholder="EA" className={cell + ' text-center'} />
                          </td>
                          <td className="px-0.5 py-0.5 border-r">
                            <input value={row.purchaseReason} onChange={e => updateItem(idx, 'purchaseReason', e.target.value)}
                              placeholder="삼성전자 대응" className={cell} />
                          </td>
                          <td className="py-0.5 text-center">
                            {filled ? (
                              <button onClick={() => clearRow(idx)}
                                className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 mx-auto transition-colors text-base">
                                ×
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 비고 */}
            <div className="flex flex-col gap-1 shrink-0">
              <label className="text-xs font-medium text-gray-600">비고</label>
              <textarea
                value={form.memo}
                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                rows={2}
                placeholder="비고 사항을 입력하세요"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* 푸터 */}
          <DialogFooter className="px-6 py-4 border-t bg-gray-50 shrink-0 flex items-center justify-between sm:justify-between">
            <span className="text-xs text-gray-400">
              입력된 품목: {form.items.filter(it => it.quantity && Number(it.quantity) > 0).length}건
            </span>
            <div className="flex gap-2">
              <Button variant="outline" className="h-9 text-sm px-5" onClick={() => setFormOpen(false)} disabled={saving}>취소</Button>
              <Button className="h-9 text-sm px-6" onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 품목 검색 드롭다운 */}
      {itemDropdown && (
        <div
          style={{
            position: 'fixed',
            top: itemDropdown.pos.top,
            left: itemDropdown.pos.left,
            minWidth: Math.max(itemDropdown.pos.width, 480),
            zIndex: 99999,
          }}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
        >
          <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">품목 선택</span>
            <span className="text-xs text-gray-400">{itemDropdown.results.length}건</span>
          </div>
          {/* 컬럼 헤더 */}
          <div className="grid grid-cols-[1fr_1.4fr_60px_70px_60px] px-3 py-1 bg-gray-50 border-b text-xs text-gray-400 font-medium">
            <span>품번</span><span>품명</span><span>대분류</span><span>중분류</span><span>단위</span>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {itemDropdown.results.map(item => (
              <button
                key={item.id}
                onMouseDown={e => { e.preventDefault(); selectBomItem(item) }}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 grid grid-cols-[1fr_1.4fr_60px_70px_60px] gap-x-2 items-center border-b last:border-0 transition-colors"
              >
                <span className="text-xs font-mono font-semibold text-gray-800 truncate">{item.itemCode}</span>
                <span className="text-xs text-gray-700 truncate">{item.itemName}</span>
                <span className="text-xs text-gray-500">{ITEM_CAT_LABEL[item.category] ?? item.category}</span>
                <span className="text-xs text-gray-500">{item.subCategory ? (SUB_CAT_LABEL[item.subCategory] ?? item.subCategory) : '-'}</span>
                <span className="text-xs text-gray-400">{item.unit}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
