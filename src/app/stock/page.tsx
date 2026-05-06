'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const CATEGORY_LABEL: Record<string, string> = {
  PRODUCT: '제품', ASSEMBLY: '어셈블리', COMPONENT: '부자재',
}

type Dept = 'LAB' | 'PRODUCTION'

interface StockRow {
  itemId: string
  stockId: string | null
  itemCode: string
  itemName: string
  unit: string
  category: string
  subCategory: string | null
  department: Dept
  quantity: number
}

const DEPT_LABEL: Record<Dept, string> = { LAB: '연구소', PRODUCTION: '생산구매팀' }
const LIMIT = 20

export default function StockPage() {
  const [dept, setDept] = useState<Dept>('LAB')
  const [rows, setRows] = useState<StockRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [txDialog, setTxDialog] = useState<{ open: boolean; row: StockRow | null; type: 'IN' | 'OUT' | 'ADJUST' }>({
    open: false, row: null, type: 'IN',
  })
  const [transferDialog, setTransferDialog] = useState<{ open: boolean; row: StockRow | null }>({
    open: false, row: null,
  })
  const [txForm, setTxForm] = useState({ quantity: '', memo: '' })
  const [transferForm, setTransferForm] = useState({ quantity: '', memo: '' })
  const [submitting, setSubmitting] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const fetchRows = useCallback(async (p: number, d: Dept, q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ department: d, page: String(p), limit: String(LIMIT) })
      if (q) params.set('search', q)
      const res = await fetch(`/api/stock?${params}`)
      const json = await res.json()
      if (json.success) {
        setRows(json.data.items)
        setTotal(json.data.total)
        setPage(json.data.page)
      } else {
        toast.error(json.message ?? '재고 조회 실패')
      }
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRows(page, dept, search) }, [fetchRows, page, dept, search])

  const handleDeptChange = (d: Dept) => { setDept(d); setPage(1) }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const openTx = (row: StockRow, type: 'IN' | 'OUT' | 'ADJUST') => {
    setTxForm({ quantity: '', memo: '' })
    setTxDialog({ open: true, row, type })
  }

  const openTransfer = (row: StockRow) => {
    setTransferForm({ quantity: '', memo: '' })
    setTransferDialog({ open: true, row })
  }

  const handleTxSubmit = async () => {
    const { row, type } = txDialog
    if (!row) return
    const qty = Number(txForm.quantity)
    if (!txForm.quantity || qty <= 0) { toast.error('수량을 올바르게 입력해주세요.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: row.itemId, department: row.department, type, quantity: qty, memo: txForm.memo || null }),
      })
      const json = await res.json()
      if (json.success) {
        const label = type === 'IN' ? '입고' : type === 'OUT' ? '출고' : '재고조정'
        toast.success(`${label} 완료되었습니다.`)
        setTxDialog({ open: false, row: null, type: 'IN' })
        fetchRows(page, dept, search)
      } else {
        toast.error(json.message ?? '처리 실패')
      }
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTransferSubmit = async () => {
    const { row } = transferDialog
    if (!row) return
    const qty = Number(transferForm.quantity)
    if (!transferForm.quantity || qty <= 0) { toast.error('수량을 올바르게 입력해주세요.'); return }
    setSubmitting(true)
    try {
      const toDept: Dept = row.department === 'LAB' ? 'PRODUCTION' : 'LAB'
      const res = await fetch('/api/stock/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: row.itemId, fromDept: row.department, toDept, quantity: qty, memo: transferForm.memo || null }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('이관 완료되었습니다.')
        setTransferDialog({ open: false, row: null })
        fetchRows(page, dept, search)
      } else {
        toast.error(json.message ?? '이관 실패')
      }
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const txTypeLabel = (t: 'IN' | 'OUT' | 'ADJUST') =>
    t === 'IN' ? '입고' : t === 'OUT' ? '출고' : '재고조정'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 타이틀 */}
      <div className="px-6 py-3 border-b bg-white shrink-0">
        <h1 className="text-sm font-semibold text-gray-800">재고 관리</h1>
      </div>

      {/* 탭 + 검색 */}
      <div className="px-4 py-2.5 border-b bg-white flex items-center gap-3 flex-wrap min-h-[52px] shrink-0">
        <div className="flex gap-1">
          {(['LAB', 'PRODUCTION'] as Dept[]).map(d => (
            <button
              key={d}
              onClick={() => handleDeptChange(d)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                dept === d ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {DEPT_LABEL[d]}
            </button>
          ))}
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-1">
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="품번 또는 품명 검색"
            className="h-8 text-xs w-52"
          />
          <Button type="submit" variant="outline" size="sm" className="h-8 text-xs px-3">검색</Button>
        </form>
        <span className="ml-auto text-xs text-gray-400">총 {total.toLocaleString()}개 품목</span>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="text-xs" style={{ tableLayout: 'fixed', width: '960px', minWidth: '960px' }}>
          <colgroup>
            <col style={{ width: 160 }} />
            <col style={{ width: 240 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 220 }} />
          </colgroup>
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {['품번', '품명', '대분류', '중분류', '단위', '재고수량', '관리'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">불러오는 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">품목이 없습니다.</td></tr>
            ) : rows.map(row => (
              <tr key={row.itemId} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-mono truncate text-gray-700">{row.itemCode}</td>
                <td className="px-3 py-2 truncate text-gray-800">{row.itemName}</td>
                <td className="px-3 py-2 text-gray-600">{CATEGORY_LABEL[row.category] ?? row.category}</td>
                <td className="px-3 py-2 text-gray-500">{row.subCategory ?? '-'}</td>
                <td className="px-3 py-2 text-gray-600">{row.unit}</td>
                <td className="px-3 py-2">
                  <span className={`font-bold ${row.quantity === 0 ? 'text-gray-300' : 'text-gray-900'}`}>
                    {row.quantity.toLocaleString()}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs border-green-400 text-green-600 hover:bg-green-50 px-2"
                      onClick={() => openTx(row, 'IN')}>입고</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs border-red-300 text-red-500 hover:bg-red-50 px-2"
                      disabled={row.quantity === 0}
                      onClick={() => openTx(row, 'OUT')}>출고</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2"
                      onClick={() => openTx(row, 'ADJUST')}>조정</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs border-blue-300 text-blue-500 hover:bg-blue-50 px-2"
                      disabled={row.quantity === 0}
                      onClick={() => openTransfer(row)}>이관</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="px-4 py-2.5 border-t bg-white shrink-0 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {total.toLocaleString()}개 중 {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>이전</Button>
          <span className="text-xs text-gray-600 px-2">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>다음</Button>
        </div>
      </div>

      {/* 입고/출고/조정 다이얼로그 */}
      <Dialog open={txDialog.open} onOpenChange={open => setTxDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {txTypeLabel(txDialog.type)} — {txDialog.row?.itemName}
            </DialogTitle>
          </DialogHeader>
          {txDialog.row && txDialog.type === 'OUT' && (
            <p className="text-xs text-gray-500 -mt-1">
              현재 재고: <span className="font-semibold text-gray-800">{txDialog.row.quantity.toLocaleString()} {txDialog.row.unit}</span>
            </p>
          )}
          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">
                {txDialog.type === 'ADJUST' ? '조정 후 수량' : '수량'}
                <span className="text-red-400 ml-0.5">*</span>
              </label>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} placeholder="0" className="h-8 text-sm"
                  value={txForm.quantity} onChange={e => setTxForm(f => ({ ...f, quantity: e.target.value }))} />
                <span className="text-xs text-gray-500 shrink-0">{txDialog.row?.unit}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">메모</label>
              <Input placeholder="메모 (선택)" className="h-8 text-sm"
                value={txForm.memo} onChange={e => setTxForm(f => ({ ...f, memo: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" disabled={submitting}
              onClick={() => setTxDialog({ open: false, row: null, type: 'IN' })}>취소</Button>
            <Button size="sm" className="text-xs" disabled={submitting} onClick={handleTxSubmit}>
              {submitting ? '처리 중...' : txTypeLabel(txDialog.type)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 이관 다이얼로그 */}
      <Dialog open={transferDialog.open} onOpenChange={open => setTransferDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">재고 이관 — {transferDialog.row?.itemName}</DialogTitle>
          </DialogHeader>
          {transferDialog.row && (
            <div className="flex items-center justify-center gap-3 text-xs bg-gray-50 rounded-lg px-4 py-3 -mt-1">
              <span className="font-semibold text-gray-700">{DEPT_LABEL[transferDialog.row.department]}</span>
              <span className="text-gray-400">→</span>
              <span className="font-semibold text-gray-700">
                {DEPT_LABEL[transferDialog.row.department === 'LAB' ? 'PRODUCTION' : 'LAB']}
              </span>
              <span className="ml-2 text-gray-400">(현재 {transferDialog.row.quantity.toLocaleString()} {transferDialog.row.unit})</span>
            </div>
          )}
          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">이관 수량<span className="text-red-400 ml-0.5">*</span></label>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} placeholder="0" className="h-8 text-sm"
                  value={transferForm.quantity} onChange={e => setTransferForm(f => ({ ...f, quantity: e.target.value }))} />
                <span className="text-xs text-gray-500 shrink-0">{transferDialog.row?.unit}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">메모</label>
              <Input placeholder="메모 (선택)" className="h-8 text-sm"
                value={transferForm.memo} onChange={e => setTransferForm(f => ({ ...f, memo: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" disabled={submitting}
              onClick={() => setTransferDialog({ open: false, row: null })}>취소</Button>
            <Button size="sm" className="text-xs" disabled={submitting} onClick={handleTransferSubmit}>
              {submitting ? '처리 중...' : '이관'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
