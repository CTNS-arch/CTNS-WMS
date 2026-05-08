'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const CATEGORY_LABEL: Record<string, string> = {
  PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재',
}

const TX_TYPE_LABEL: Record<string, string> = {
  IN: '입고', OUT: '출고', ADJUST: '재고조정', TRANSFER: '이관',
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
  avgUnitCost: number | null
  memo: string | null
}

interface HistoryTx {
  id: string
  type: string
  fromDept: string | null
  toDept: string | null
  quantity: number
  memo: string | null
  unitCost: number | null
  currency: string | null
  createdAt: string
  user: { name: string | null; email: string | null } | null
}

const DEPT_LABEL: Record<Dept, string> = { LAB: '연구소', PRODUCTION: '생산구매팀' }
const LIMIT = 20

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center ml-1 cursor-help">
      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4M12 8h.01" />
      </svg>
      <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 rounded bg-gray-900 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-normal text-center">
        {text}
      </span>
    </span>
  )
}

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
  const [txForm, setTxForm] = useState({ quantity: '', memo: '', unitCost: '' })
  const [transferForm, setTransferForm] = useState({ quantity: '', memo: '' })
  const [submitting, setSubmitting] = useState(false)

  // 히스토리
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; row: StockRow | null }>({ open: false, row: null })
  const [historyRows, setHistoryRows] = useState<HistoryTx[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // 비고 편집
  const [memoDialog, setMemoDialog] = useState<{ open: boolean; row: StockRow | null }>({ open: false, row: null })
  const [memoInput, setMemoInput] = useState('')
  const [memoSubmitting, setMemoSubmitting] = useState(false)

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

  // 입고 다이얼로그 열 때 원가관리에서 최근 KRW 단가 자동 조회
  useEffect(() => {
    if (!txDialog.open || txDialog.type !== 'IN' || !txDialog.row) return
    const itemId = txDialog.row.itemId
    Promise.all([
      fetch(`/api/cost?itemId=${itemId}&limit=1`).then(r => r.json()),
      fetch('/api/exchange-rates').then(r => r.json()),
    ])
      .then(([costJson, rateJson]) => {
        if (costJson.success && costJson.data.items?.[0]?.costs?.length > 0) {
          const costs: any[] = costJson.data.items[0].costs
          const rates: Record<string, number> = rateJson.success ? rateJson.toKRW : {}
          const krwCost = costs.find(c => c.currency === 'KRW') ?? costs[0]
          if (krwCost) {
            const price = krwCost.currency === 'KRW'
              ? Number(krwCost.unitPrice)
              : Math.round(Number(krwCost.unitPrice) * (rates[krwCost.currency] ?? 1))
            setTxForm(f => ({ ...f, unitCost: String(price) }))
          }
        }
      })
      .catch(() => {})
  }, [txDialog.open, txDialog.type, txDialog.row?.itemId])

  // 히스토리 로드
  useEffect(() => {
    if (!historyDialog.open || !historyDialog.row) return
    setHistoryLoading(true)
    fetch(`/api/stock/${historyDialog.row.itemId}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setHistoryRows(json.data.transactions)
        else toast.error('히스토리 조회 실패')
      })
      .catch(() => toast.error('서버 오류가 발생했습니다.'))
      .finally(() => setHistoryLoading(false))
  }, [historyDialog.open, historyDialog.row?.itemId])

  const handleDeptChange = (d: Dept) => { setDept(d); setPage(1) }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const openTx = (row: StockRow, type: 'IN' | 'OUT' | 'ADJUST') => {
    setTxForm({ quantity: '', memo: '', unitCost: '' })
    setTxDialog({ open: true, row, type })
  }

  const openTransfer = (row: StockRow) => {
    setTransferForm({ quantity: '', memo: '' })
    setTransferDialog({ open: true, row })
  }

  const openHistory = (row: StockRow) => {
    setHistoryRows([])
    setHistoryDialog({ open: true, row })
  }

  const openMemo = (row: StockRow) => {
    setMemoInput(row.memo ?? '')
    setMemoDialog({ open: true, row })
  }

  const handleTxSubmit = async () => {
    const { row, type } = txDialog
    if (!row) return
    const qty = Number(txForm.quantity)
    if (!txForm.quantity || qty <= 0) { toast.error('수량을 올바르게 입력해주세요.'); return }
    setSubmitting(true)
    try {
      const body: any = { itemId: row.itemId, department: row.department, type, quantity: qty, memo: txForm.memo || null }
      if ((type === 'IN' || type === 'ADJUST') && txForm.unitCost && Number(txForm.unitCost) > 0) {
        body.unitCost = Number(txForm.unitCost)
        body.currency = 'KRW'
      }
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const handleMemoSubmit = async () => {
    const { row } = memoDialog
    if (!row) return
    setMemoSubmitting(true)
    try {
      const res = await fetch(`/api/stock/${row.itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: row.department, memo: memoInput || null }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('비고가 수정되었습니다.')
        setMemoDialog({ open: false, row: null })
        fetchRows(page, dept, search)
      } else {
        toast.error(json.message ?? '수정 실패')
      }
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    } finally {
      setMemoSubmitting(false)
    }
  }

  const txTypeLabel = (t: 'IN' | 'OUT' | 'ADJUST') =>
    t === 'IN' ? '입고' : t === 'OUT' ? '출고' : '재고조정'

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const deptShort = (d: string | null) => {
    if (!d) return '-'
    return d === 'LAB' ? '연구소' : d === 'PRODUCTION' ? '생산구매팀' : d
  }

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
        <table className="text-xs" style={{ tableLayout: 'fixed', width: '100%', minWidth: '1280px' }}>
          <colgroup>
            <col style={{ width: 220 }} />   {/* 품번 */}
            <col style={{ width: 220 }} />   {/* 품명 */}
            <col style={{ width: 72 }} />    {/* 대분류 */}
            <col style={{ width: 72 }} />    {/* 중분류 */}
            <col style={{ width: 52 }} />    {/* 단위 */}
            <col style={{ width: 96 }} />    {/* 재고수량 */}
            <col style={{ width: 120 }} />   {/* 원가 */}
            <col />                          {/* 비고 (반응형) */}
            <col style={{ width: 268 }} />   {/* 관리 */}
          </colgroup>
          <thead className="bg-gray-50 sticky top-0 z-20">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b sticky left-0 bg-gray-50 z-20">품번</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b sticky left-[220px] bg-gray-50 z-20 border-r border-gray-200">품명</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">대분류</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">중분류</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">단위</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">재고수량</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">
                <span className="inline-flex items-center">
                  원가
                  <InfoTooltip text="FIFO 선입선출 기준 가중평균 단가 (KRW)" />
                </span>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">비고</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400">불러오는 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400">품목이 없습니다.</td></tr>
            ) : rows.map(row => (
              <tr key={row.itemId} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-gray-700 overflow-hidden sticky left-0 bg-white z-[1]">
                  <span className="block truncate" title={row.itemCode}>{row.itemCode}</span>
                </td>
                <td className="px-3 py-2 text-gray-800 overflow-hidden sticky left-[220px] bg-white z-[1] border-r border-gray-200">
                  <span className="block truncate" title={row.itemName}>{row.itemName}</span>
                </td>
                <td className="px-3 py-2 text-gray-600 overflow-hidden">
                  <span className="block truncate" title={CATEGORY_LABEL[row.category] ?? row.category}>
                    {CATEGORY_LABEL[row.category] ?? row.category}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-500 overflow-hidden">
                  <span className="block truncate" title={row.subCategory ?? '-'}>{row.subCategory ?? '-'}</span>
                </td>
                <td className="px-3 py-2 text-gray-600 overflow-hidden">
                  <span className="block truncate">{row.unit}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={`font-bold ${row.quantity === 0 ? 'text-gray-300' : 'text-gray-900'}`}>
                    {row.quantity.toLocaleString()}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {row.avgUnitCost != null ? (
                    <span className="text-blue-700 font-medium">
                      ₩{Math.round(row.avgUnitCost).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="px-3 py-2 overflow-hidden">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="block truncate text-gray-500 flex-1" title={row.memo ?? ''}>
                      {row.memo ?? ''}
                    </span>
                    <button
                      onClick={() => openMemo(row)}
                      className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
                      title="비고 편집"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
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
                    <Button variant="outline" size="sm" className="h-7 text-xs border-gray-300 text-gray-600 hover:bg-gray-50 px-2"
                      onClick={() => openHistory(row)}>히스토리</Button>
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
              {txDialog.row.avgUnitCost != null && (
                <span className="ml-2 text-blue-600">
                  | FIFO 단가: ₩{Math.round(txDialog.row.avgUnitCost).toLocaleString()}
                </span>
              )}
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
            {(txDialog.type === 'IN' || txDialog.type === 'ADJUST') && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">
                  입고 단가 (KRW)
                  <span className="ml-1 text-gray-400 font-normal">(선택 — 원가 추적용)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} placeholder="0" className="h-8 text-sm"
                    value={txForm.unitCost} onChange={e => setTxForm(f => ({ ...f, unitCost: e.target.value }))} />
                  <span className="text-xs text-gray-500 shrink-0">₩</span>
                </div>
              </div>
            )}
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

      {/* 히스토리 다이얼로그 */}
      <Dialog open={historyDialog.open} onOpenChange={open => setHistoryDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="w-[90vw] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-sm">
              재고 히스토리 — <span className="font-mono">{historyDialog.row?.itemCode}</span>
              <span className="ml-2 font-normal text-gray-500">{historyDialog.row?.itemName}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh] -mx-1 min-h-[200px]">
            {historyLoading ? (
              <p className="text-xs text-gray-400 text-center py-8">불러오는 중...</p>
            ) : historyRows.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">히스토리가 없습니다.</p>
            ) : (
              <table className="text-xs w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['구분', '날짜', '수량', '단가', '방향', '담당자', '메모'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 border-b whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map(tx => (
                    <tr key={tx.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          tx.type === 'IN' ? 'bg-green-100 text-green-700'
                          : tx.type === 'OUT' ? 'bg-red-100 text-red-600'
                          : tx.type === 'ADJUST' ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-blue-100 text-blue-600'
                        }`}>
                          {TX_TYPE_LABEL[tx.type] ?? tx.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{formatDate(tx.createdAt)}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">{tx.quantity.toLocaleString()}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {tx.unitCost != null ? `₩${Number(tx.unitCost).toLocaleString()}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {tx.type === 'TRANSFER'
                          ? `${deptShort(tx.fromDept)} → ${deptShort(tx.toDept)}`
                          : tx.toDept ? deptShort(tx.toDept)
                          : tx.fromDept ? deptShort(tx.fromDept)
                          : '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {tx.user?.name ?? tx.user?.email ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-[160px]">
                        <span className="block truncate" title={tx.memo ?? ''}>{tx.memo ?? '-'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs"
              onClick={() => setHistoryDialog({ open: false, row: null })}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 비고 편집 다이얼로그 */}
      <Dialog open={memoDialog.open} onOpenChange={open => setMemoDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">비고 편집 — {memoDialog.row?.itemName}</DialogTitle>
          </DialogHeader>
          <div className="py-1">
            <textarea
              value={memoInput}
              onChange={e => setMemoInput(e.target.value)}
              placeholder="비고 내용을 입력하세요."
              rows={3}
              className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" disabled={memoSubmitting}
              onClick={() => setMemoDialog({ open: false, row: null })}>취소</Button>
            <Button size="sm" className="text-xs" disabled={memoSubmitting} onClick={handleMemoSubmit}>
              {memoSubmitting ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
