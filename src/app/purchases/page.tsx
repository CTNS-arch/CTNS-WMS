'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '검토중',
  APPROVED: '승인',
  ORDERED: '발주',
  RECEIVED: '입고완료',
  REJECTED: '반려',
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

const LIMIT = 20

const emptyForm = {
  url: '',
  itemId: '',
  itemName: '',
  quantity: '',
  unit: '',
  price: '',
  memo: '',
}

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
  const [form, setForm] = useState({ ...emptyForm })
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

      const res = await fetch(`/api/purchases?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setRequests(json.data.requests)
        setTotal(json.data.total)
        setPage(json.data.page)
      } else {
        toast.error('데이터를 불러오지 못했습니다.')
      }
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests(page, filterStatus, search)
  }, [fetchRequests, page, filterStatus, search])

  function handleFilterStatus(value: string) {
    setFilterStatus(value)
    setPage(1)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  function openCreate() {
    setEditReq(null)
    setForm({ ...emptyForm })
    setFormOpen(true)
  }

  function openEdit(req: any) {
    setEditReq(req)
    setForm({
      url: req.url ?? '',
      itemId: req.itemId ?? '',
      itemName: req.itemName ?? '',
      quantity: req.quantity != null ? String(req.quantity) : '',
      unit: req.unit ?? '',
      price: req.price != null ? String(req.price) : '',
      memo: req.memo ?? '',
    })
    setFormOpen(true)
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    if (!form.itemName.trim()) {
      toast.error('품명을 입력해주세요.')
      return
    }
    if (!form.quantity) {
      toast.error('수량을 입력해주세요.')
      return
    }
    if (!form.unit.trim()) {
      toast.error('단위를 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      const body: any = {
        itemName: form.itemName.trim(),
        quantity: Number(form.quantity),
        unit: form.unit.trim(),
      }
      if (form.url.trim()) body.url = form.url.trim()
      if (form.itemId.trim()) body.itemId = form.itemId.trim()
      if (form.price !== '') body.price = Number(form.price)
      if (form.memo.trim()) body.memo = form.memo.trim()

      let res: Response
      if (editReq) {
        res = await fetch(`/api/purchases/${editReq.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/purchases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      const json = await res.json()
      if (json.success) {
        toast.success(editReq ? '구매 요청이 수정되었습니다.' : '구매 요청이 등록되었습니다.')
        setFormOpen(false)
        fetchRequests(page, filterStatus, search)
      } else {
        toast.error(json.message ?? '저장에 실패했습니다.')
      }
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
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
      } else {
        toast.error(json.message ?? '상태 변경에 실패했습니다.')
      }
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/purchases/${deleteId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success('구매 요청이 삭제되었습니다.')
        setDeleteId(null)
        const newPage = requests.length === 1 && page > 1 ? page - 1 : page
        fetchRequests(newPage, filterStatus, search)
      } else {
        toast.error(json.message ?? '삭제에 실패했습니다.')
      }
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 타이틀 */}
      <div className="px-6 py-3 border-b bg-white shrink-0">
        <h1 className="text-sm font-semibold text-gray-800">구매 요청</h1>
      </div>

      {/* 필터 바 */}
      <div className="px-4 py-2.5 border-b bg-white flex items-center gap-2 flex-wrap min-h-[52px] shrink-0">
        <div className="flex items-center gap-1">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill.value}
              onClick={() => handleFilterStatus(pill.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterStatus === pill.value
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-1">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="품명 검색"
            className="h-8 text-xs w-44"
          />
          <Button type="submit" variant="outline" size="sm" className="h-8 text-xs px-3">
            검색
          </Button>
        </form>

        <div className="ml-auto">
          <Button onClick={openCreate} size="sm" className="h-8 text-xs">
            + 구매요청
          </Button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: 1100 }}>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 text-xs">
                <TableHead style={{ width: 100 }} className="text-xs">요청일</TableHead>
                <TableHead style={{ width: 240 }} className="text-xs">품명</TableHead>
                <TableHead style={{ width: 180 }} className="text-xs">URL</TableHead>
                <TableHead style={{ width: 80 }} className="text-xs text-right">수량</TableHead>
                <TableHead style={{ width: 60 }} className="text-xs">단위</TableHead>
                <TableHead style={{ width: 100 }} className="text-xs text-right">금액</TableHead>
                <TableHead style={{ width: 90 }} className="text-xs">상태</TableHead>
                <TableHead style={{ width: 180 }} className="text-xs">메모</TableHead>
                <TableHead style={{ width: 70 }} className="text-xs">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-xs text-gray-400">
                    불러오는 중...
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-xs text-gray-400">
                    구매 요청 내역이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id} className="text-xs hover:bg-gray-50">
                    <TableCell className="text-xs text-gray-600">
                      {new Date(req.createdAt).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell className="text-xs font-medium max-w-[240px] truncate">
                      {req.itemName}
                    </TableCell>
                    <TableCell style={{ width: 180 }} className="text-xs">
                      {req.url ? (
                        <a
                          href={req.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline block truncate max-w-[160px]"
                          title={req.url}
                        >
                          {req.url}
                        </a>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right">{req.quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{req.unit}</TableCell>
                    <TableCell className="text-xs text-right">
                      {req.price != null
                        ? `${Number(req.price).toLocaleString()}원`
                        : <span className="text-gray-300">-</span>}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[req.status] ?? ''}`}
                      >
                        {STATUS_LABEL[req.status] ?? req.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 max-w-[180px] truncate">
                      {req.memo || <span className="text-gray-300">-</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => openEdit(req)}
                          >
                            수정
                          </Button>
                          {req.status === 'PENDING' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 text-xs px-2"
                              onClick={() => setDeleteId(req.id)}
                            >
                              삭제
                            </Button>
                          )}
                        </div>
                        <Select
                          value={req.status}
                          onValueChange={(val) => handleStatusChange(req.id, val)}
                        >
                          <SelectTrigger className="h-7 text-xs w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs">
                                {STATUS_LABEL[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 페이지네이션 */}
      <div className="px-4 py-2 border-t bg-white shrink-0 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          총 {total.toLocaleString()}건
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            이전
          </Button>
          <span className="text-xs text-gray-600 px-2">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </Button>
        </div>
      </div>

      {/* 등록/수정 다이얼로그 */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {editReq ? '구매 요청 수정' : '구매 요청 등록'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            {/* 품명 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                품명 <span className="text-red-500">*</span>
              </label>
              <Input
                name="itemName"
                value={form.itemName}
                onChange={handleFormChange}
                placeholder="품명을 입력하세요"
                className="h-8 text-xs"
              />
            </div>

            {/* URL */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">URL</label>
              <Input
                name="url"
                value={form.url}
                onChange={handleFormChange}
                placeholder="https://..."
                className="h-8 text-xs"
              />
            </div>

            {/* 수량 + 단위 */}
            <div className="flex gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs font-medium text-gray-700">
                  수량 <span className="text-red-500">*</span>
                </label>
                <Input
                  name="quantity"
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={handleFormChange}
                  placeholder="0"
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1 w-24">
                <label className="text-xs font-medium text-gray-700">
                  단위 <span className="text-red-500">*</span>
                </label>
                <Input
                  name="unit"
                  value={form.unit}
                  onChange={handleFormChange}
                  placeholder="개"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* 금액 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">금액</label>
              <div className="flex items-center gap-1">
                <Input
                  name="price"
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={handleFormChange}
                  placeholder="0"
                  className="h-8 text-xs flex-1"
                />
                <span className="text-xs text-gray-500 whitespace-nowrap">원</span>
              </div>
            </div>

            {/* 메모 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">메모</label>
              <textarea
                name="memo"
                value={form.memo}
                onChange={handleFormChange}
                rows={2}
                placeholder="메모를 입력하세요"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              취소
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 AlertDialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold">구매 요청 삭제</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600">
              구매 요청을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs" disabled={deleting}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
