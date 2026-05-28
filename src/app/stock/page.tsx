'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import StockAuditDialog from '@/components/stock/StockAuditDialog'
import { SUB_OPTIONS } from '@/lib/classification'

const CATEGORY_LABEL: Record<string, string> = {
  PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재',
}

const TX_TYPE_LABEL: Record<string, string> = {
  IN: '입고', OUT: '출고', ADJUST: '재고조정', TRANSFER: '이관',
}

type Dept = 'LAB' | 'PRODUCTION'
type DeptTab = 'ALL' | 'LAB' | 'PRODUCTION'

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

interface AllStockRow {
  itemId: string
  itemCode: string
  itemName: string
  unit: string
  category: string
  subCategory: string | null
  labQty: number
  labCost: number | null
  prodQty: number
  prodCost: number | null
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
  const [deptTab, setDeptTab] = useState<DeptTab>('ALL')
  const [rows, setRows]       = useState<StockRow[]>([])
  const [allRows, setAllRows] = useState<AllStockRow[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [search, setSearch]   = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSubCategory, setFilterSubCategory] = useState<string[]>([])

  const [txDialog, setTxDialog] = useState<{ open: boolean; row: StockRow | null; type: 'IN' | 'OUT' | 'ADJUST' }>({
    open: false, row: null, type: 'IN',
  })
  const [transferDialog, setTransferDialog] = useState<{ open: boolean; row: StockRow | null }>({
    open: false, row: null,
  })
  const [txForm, setTxForm]             = useState({ quantity: '', memo: '', unitCost: '' })
  const [transferForm, setTransferForm] = useState({ quantity: '', memo: '' })
  const [submitting, setSubmitting]     = useState(false)

  const [inSourceDialog, setInSourceDialog] = useState<{ open: boolean; row: StockRow | null }>({ open: false, row: null })

  const [purchaseInDialog, setPurchaseInDialog] = useState<{
    open: boolean; row: StockRow | null
    purchases: any[]; loading: boolean; search: string
    selected: any | null; receiveQty: string
  }>({ open: false, row: null, purchases: [], loading: false, search: '', selected: null, receiveQty: '' })

  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; row: StockRow | null }>({ open: false, row: null })
  const [historyRows, setHistoryRows]     = useState<HistoryTx[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [memoDialog, setMemoDialog]   = useState<{ open: boolean; row: StockRow | null }>({ open: false, row: null })
  const [memoInput, setMemoInput]     = useState('')
  const [memoSubmitting, setMemoSubmitting] = useState(false)

  const [auditOpen, setAuditOpen] = useState(false)
  const [auditDept, setAuditDept] = useState<'LAB' | 'PRODUCTION'>('PRODUCTION')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const totalPages  = Math.max(1, Math.ceil(total / LIMIT))

  // ── 단일 부서 조회 ────────────────────────────────────────
  const fetchRows = useCallback(async (p: number, d: Dept, q: string, cat: string, subCats: string[]) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ department: d, page: String(p), limit: String(LIMIT) })
      if (q) params.set('search', q)
      if (cat) params.set('category', cat)
      if (subCats.length > 0) params.set('subCategory', subCats.join(','))
      const res  = await fetch(`/api/stock?${params}`)
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

  // ── 전체(양 부서 동시) 조회 ────────────────────────────────
  const fetchAllRows = useCallback(async (p: number, q: string, cat: string, subCats: string[]) => {
    setLoading(true)
    try {
      const qs = q ? `&search=${encodeURIComponent(q)}` : ''
      const catQs = cat ? `&category=${encodeURIComponent(cat)}` : ''
      const subQs = subCats.length > 0 ? `&subCategory=${encodeURIComponent(subCats.join(','))}` : ''
      const [labRes, prodRes] = await Promise.all([
        fetch(`/api/stock?department=LAB&page=${p}&limit=${LIMIT}${qs}${catQs}${subQs}`),
        fetch(`/api/stock?department=PRODUCTION&page=${p}&limit=${LIMIT}${qs}${catQs}${subQs}`),
      ])
      const [labJson, prodJson] = await Promise.all([labRes.json(), prodRes.json()])
      if (labJson.success && prodJson.success) {
        const prodMap = new Map<string, any>(prodJson.data.items.map((it: any) => [it.itemId, it]))
        setAllRows(labJson.data.items.map((it: any) => ({
          itemId:     it.itemId,
          itemCode:   it.itemCode,
          itemName:   it.itemName,
          unit:       it.unit,
          category:   it.category,
          subCategory: it.subCategory,
          labQty:  it.quantity,
          labCost: it.avgUnitCost,
          prodQty:  prodMap.get(it.itemId)?.quantity  ?? 0,
          prodCost: prodMap.get(it.itemId)?.avgUnitCost ?? null,
        })))
        setTotal(labJson.data.total)
        setPage(labJson.data.page)
      } else {
        toast.error('재고 조회 실패')
      }
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(() => {
    if (deptTab === 'ALL') fetchAllRows(page, search, filterCategory, filterSubCategory)
    else fetchRows(page, deptTab, search, filterCategory, filterSubCategory)
  }, [deptTab, page, search, filterCategory, filterSubCategory, fetchAllRows, fetchRows])

  useEffect(() => { refresh() }, [refresh])

  // 입고 다이얼로그 열 때 원가 자동 조회
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

  const handleDeptChange = (d: DeptTab) => { setDeptTab(d); setPage(1) }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const openTx = (row: StockRow, type: 'IN' | 'OUT' | 'ADJUST') => {
    setTxForm({ quantity: '', memo: '', unitCost: '' })
    setTxDialog({ open: true, row, type })
  }

  const openInSource = (row: StockRow) => setInSourceDialog({ open: true, row })

  const handleSelectDirectIn = () => {
    const row = inSourceDialog.row!
    setInSourceDialog({ open: false, row: null })
    openTx(row, 'IN')
  }

  const handleSelectPurchaseIn = async () => {
    const row = inSourceDialog.row!
    setInSourceDialog({ open: false, row: null })
    setPurchaseInDialog({ open: true, row, purchases: [], loading: true, search: '', selected: null, receiveQty: '' })
    try {
      const res  = await fetch('/api/purchases?status=ORDERED&limit=200')
      const json = await res.json()
      if (json.success) {
        const filtered = (json.data.requests as any[]).filter(req =>
          req.items.some((it: any) => it.itemId === row.itemId)
        )
        setPurchaseInDialog(prev => ({ ...prev, purchases: filtered, loading: false }))
      } else {
        setPurchaseInDialog(prev => ({ ...prev, loading: false }))
      }
    } catch {
      setPurchaseInDialog(prev => ({ ...prev, loading: false }))
    }
  }

  const handlePurchaseInSubmit = async () => {
    const { row, selected, receiveQty } = purchaseInDialog
    if (!row || !selected || !receiveQty || Number(receiveQty) <= 0) return
    const matchItem = selected.items.find((it: any) => it.itemId === row.itemId)
    setSubmitting(true)
    try {
      const stockRes = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: row.itemId, department: row.department, type: 'IN',
          quantity: Number(receiveQty),
          memo: `구매요청 ${selected.documentNo ?? selected.id} 입고`,
          unitCost: matchItem?.unitPrice ?? null, currency: 'KRW',
        }),
      })
      const stockJson = await stockRes.json()
      if (!stockJson.success) throw new Error(stockJson.message)

      await fetch(`/api/purchases/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RECEIVED' }),
      })

      toast.success(`입고 완료 (+${Number(receiveQty).toLocaleString()} ${row.unit})`)
      setPurchaseInDialog({ open: false, row: null, purchases: [], loading: false, search: '', selected: null, receiveQty: '' })
      refresh()
    } catch (e: any) {
      toast.error(e.message || '처리 실패')
    } finally {
      setSubmitting(false)
    }
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
      const res  = await fetch('/api/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (json.success) {
        const label = type === 'IN' ? '입고' : type === 'OUT' ? '출고' : '재고조정'
        toast.success(`${label} 완료되었습니다.`)
        setTxDialog({ open: false, row: null, type: 'IN' })
        refresh()
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
      const res  = await fetch('/api/stock/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: row.itemId, fromDept: row.department, toDept, quantity: qty, memo: transferForm.memo || null }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('이관 완료되었습니다.')
        setTransferDialog({ open: false, row: null })
        refresh()
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
      const res  = await fetch(`/api/stock/${row.itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: row.department, memo: memoInput || null }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('비고가 수정되었습니다.')
        setMemoDialog({ open: false, row: null })
        refresh()
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

  const fmtCost = (v: number | null) =>
    v != null ? <span className="text-blue-700 font-medium">₩{Math.round(v).toLocaleString()}</span> : <span className="text-gray-300">-</span>

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 타이틀 */}
      <div className="px-6 py-3 border-b bg-white shrink-0">
        <h1 className="text-sm font-semibold text-gray-800">재고 관리</h1>
      </div>

      {/* 부서 탭 */}
      <div className="bg-white border-b shrink-0 flex">
        {(['ALL', 'PRODUCTION', 'LAB'] as DeptTab[]).map(d => (
          <button
            key={d}
            onClick={() => handleDeptChange(d)}
            className={`px-5 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
              deptTab === d
                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {d === 'ALL' ? '전체' : DEPT_LABEL[d]}
          </button>
        ))}
      </div>

      {/* 메인 영역: 사이드바 + 콘텐츠 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 분류 사이드바 */}
        <aside className="w-44 shrink-0 border-r bg-white overflow-y-auto flex flex-col p-3 gap-4">
          {/* 대분류 */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1">대분류</p>
            {[
              { value: '', label: '전체' },
              { value: 'PRODUCT', label: '완제품' },
              { value: 'ASSEMBLY', label: '반제품' },
              { value: 'COMPONENT', label: '자재' },
            ].map(opt => (
              <button key={opt.value}
                onClick={() => { setFilterCategory(opt.value); setFilterSubCategory([]); setPage(1) }}
                className={`text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
                  filterCategory === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >{opt.label}</button>
            ))}
          </div>
          {/* 중분류 */}
          {filterCategory && (SUB_OPTIONS[filterCategory]?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1">중분류</p>
              {(SUB_OPTIONS[filterCategory] ?? []).map(opt => {
                const sel = filterSubCategory.includes(opt.value)
                return (
                  <button key={opt.value}
                    onClick={() => {
                      setFilterSubCategory(prev => sel ? prev.filter(v => v !== opt.value) : [...prev, opt.value])
                      setPage(1)
                    }}
                    className={`text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                      sel ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >{opt.label}</button>
                )
              })}
            </div>
          )}
          {(filterCategory || filterSubCategory.length > 0) && (
            <button onClick={() => { setFilterCategory(''); setFilterSubCategory([]); setPage(1) }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2.5 py-1 text-left">
              ↺ 필터 초기화
            </button>
          )}
        </aside>
        {/* 우측: 검색 + 테이블 + 페이지네이션 */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* 검색 */}
      <div className="px-4 py-2.5 border-b bg-white flex items-center gap-3 flex-wrap shrink-0">
        <form onSubmit={handleSearch} className="flex items-center gap-1">
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="품번 또는 품명 검색"
            className="h-8 text-xs w-52"
          />
          <Button type="submit" variant="outline" size="sm" className="h-8 text-xs px-3">검색</Button>
        </form>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">총 {total.toLocaleString()}개 품목</span>
          {deptTab !== 'ALL' && (
            <button
              onClick={() => { setAuditDept(deptTab as 'LAB' | 'PRODUCTION'); setAuditOpen(true) }}
              className="h-8 px-3 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors whitespace-nowrap"
            >
              재고실사
            </button>
          )}
        </div>
      </div>

      {/* 테이블 영역 */}
      <div className="flex-1 overflow-auto min-h-0">

        {/* ── 전체 탭 ─────────────────────────────────────── */}
        {deptTab === 'ALL' ? (
          <table className="text-xs" style={{ tableLayout: 'fixed', width: '100%', minWidth: '960px' }}>
            <colgroup>
              <col style={{ width: 200 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 72 }} />
              <col style={{ width: 72 }} />
              <col style={{ width: 48 }} />
              {/* 연구소 */}
              <col style={{ width: 88 }} />
              <col style={{ width: 120 }} />
              {/* 생산구매팀 */}
              <col style={{ width: 88 }} />
              <col style={{ width: 120 }} />
              {/* 합계 */}
              <col style={{ width: 80 }} />
              <col style={{ width: 120 }} />
            </colgroup>
            <thead className="bg-gray-50 sticky top-0 z-20">
              {/* 그룹 헤더 */}
              <tr>
                <th colSpan={5} className="border-b border-r border-gray-200" />
                <th colSpan={2} className="px-3 py-1.5 text-center text-[11px] font-bold text-teal-600 border-b border-r border-gray-200 bg-teal-50">
                  연구소
                </th>
                <th colSpan={2} className="px-3 py-1.5 text-center text-[11px] font-bold text-blue-600 border-b border-r border-gray-200 bg-blue-50">
                  생산구매팀
                </th>
                <th colSpan={2} className="border-b border-gray-200 bg-gray-50" />
              </tr>
              {/* 컬럼 헤더 */}
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b sticky left-0 bg-gray-50 z-20">품번</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b sticky left-[200px] bg-gray-50 z-20 border-r border-gray-200">품명</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">대분류</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">중분류</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">단위</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-teal-600 border-b bg-teal-50/40">수량</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-teal-500 border-b border-r border-gray-200 bg-teal-50/40">
                  <span className="inline-flex items-center justify-end">원가<InfoTooltip text="FIFO 가중평균 단가 (KRW)" /></span>
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-blue-600 border-b bg-blue-50/40">수량</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-blue-500 border-b border-r border-gray-200 bg-blue-50/40">
                  <span className="inline-flex items-center justify-end">원가<InfoTooltip text="FIFO 가중평균 단가 (KRW)" /></span>
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 border-b">합계</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 border-b">
                  <span className="inline-flex items-center justify-end">합계 원가<InfoTooltip text="수량 가중평균 단가 (KRW)" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-400">불러오는 중...</td></tr>
              ) : allRows.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-400">품목이 없습니다.</td></tr>
              ) : allRows.map(row => {
                const total = row.labQty + row.prodQty
                const labVal  = row.labCost  != null ? row.labQty  * row.labCost  : null
                const prodVal = row.prodCost != null ? row.prodQty * row.prodCost : null
                const validQty = (row.labCost  != null ? row.labQty  : 0)
                               + (row.prodCost != null ? row.prodQty : 0)
                const avgCost = validQty > 0
                  ? ((labVal ?? 0) + (prodVal ?? 0)) / validQty
                  : null
                return (
                  <tr key={row.itemId} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-700 overflow-hidden sticky left-0 bg-white z-[1]">
                      <span className="block truncate" title={row.itemCode}>{row.itemCode}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-800 overflow-hidden sticky left-[200px] bg-white z-[1] border-r border-gray-200">
                      <span className="block truncate" title={row.itemName}>{row.itemName}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 overflow-hidden">
                      <span className="block truncate">{CATEGORY_LABEL[row.category] ?? row.category}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 overflow-hidden">
                      <span className="block truncate">{row.subCategory ?? '-'}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{row.unit}</td>
                    {/* 연구소 */}
                    <td className="px-3 py-2 text-right bg-teal-50/20">
                      <span className={`font-bold ${row.labQty === 0 ? 'text-gray-300' : 'text-teal-700'}`}>
                        {row.labQty.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right bg-teal-50/20 border-r border-gray-100">
                      {fmtCost(row.labCost)}
                    </td>
                    {/* 생산구매팀 */}
                    <td className="px-3 py-2 text-right bg-blue-50/20">
                      <span className={`font-bold ${row.prodQty === 0 ? 'text-gray-300' : 'text-blue-700'}`}>
                        {row.prodQty.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right bg-blue-50/20 border-r border-gray-100">
                      {fmtCost(row.prodCost)}
                    </td>
                    {/* 합계 수량 */}
                    <td className="px-3 py-2 text-right">
                      <span className={`font-bold ${total === 0 ? 'text-gray-300' : 'text-gray-800'}`}>
                        {total.toLocaleString()}
                      </span>
                    </td>
                    {/* 합계 원가 */}
                    <td className="px-3 py-2 text-right">{fmtCost(avgCost)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

        ) : (
        // ── 연구소 / 생산구매팀 탭 ─────────────────────────
          <table className="text-xs" style={{ tableLayout: 'fixed', width: '100%', minWidth: '1280px' }}>
            <colgroup>
              <col style={{ width: 220 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 72 }} />
              <col style={{ width: 72 }} />
              <col style={{ width: 52 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 120 }} />
              <col />
              <col style={{ width: 268 }} />
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
                    {fmtCost(row.avgUnitCost)}
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
                        onClick={() => openInSource(row)}>입고</Button>
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
        )}
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
        </div>
      </div>

      {/* 입고 소스 선택 다이얼로그 */}
      <Dialog open={inSourceDialog.open} onOpenChange={open => setInSourceDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">입고 유형 선택</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500 -mt-2 truncate">{inSourceDialog.row?.itemName}</p>
          <div className="flex flex-col gap-2 py-1">
            <button
              onClick={handleSelectPurchaseIn}
              className="flex flex-col gap-0.5 px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 text-left transition-all"
            >
              <span className="text-xs font-semibold text-gray-800">구매요청 연결 입고</span>
              <span className="text-[11px] text-gray-400">발주완료된 구매요청에서 선택하여 재고에 반영</span>
            </button>
            <button
              onClick={handleSelectDirectIn}
              className="flex flex-col gap-0.5 px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-left transition-all"
            >
              <span className="text-xs font-semibold text-gray-800">직접 입고</span>
              <span className="text-[11px] text-gray-400">구매요청 없이 수량 직접 입력</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 구매요청 연결 입고 다이얼로그 */}
      {(() => {
        const q = purchaseInDialog.search.toLowerCase()
        const filteredPurchases = purchaseInDialog.purchases.filter(req =>
          !q ||
          req.documentNo?.toLowerCase().includes(q) ||
          req.requesterName?.toLowerCase().includes(q) ||
          req.items.some((it: any) => it.spec?.toLowerCase().includes(q))
        )
        return (
          <Dialog open={purchaseInDialog.open} onOpenChange={open => { if (!open) setPurchaseInDialog(prev => ({ ...prev, open: false, selected: null })) }}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-sm">구매요청 연결 입고</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-gray-500 -mt-2 truncate">{purchaseInDialog.row?.itemName}</p>
              <div className="flex flex-col gap-3">
                <Input
                  value={purchaseInDialog.search}
                  onChange={e => setPurchaseInDialog(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="구매요청코드 또는 요청자 검색"
                  className="h-8 text-xs"
                />
                {purchaseInDialog.loading ? (
                  <p className="text-xs text-gray-400 text-center py-6">불러오는 중...</p>
                ) : filteredPurchases.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">발주완료 구매요청이 없습니다.</p>
                ) : (
                  <div className="max-h-52 overflow-y-auto flex flex-col gap-1 pr-0.5">
                    {filteredPurchases.map((req: any) => {
                      const matchItems = req.items.filter((it: any) => it.itemId === purchaseInDialog.row?.itemId)
                      const isSelected = purchaseInDialog.selected?.id === req.id
                      return (
                        <button
                          key={req.id}
                          onClick={() => {
                            const matchItem = matchItems[0]
                            setPurchaseInDialog(prev => ({
                              ...prev,
                              selected: req,
                              receiveQty: matchItem ? String(matchItem.quantity) : '',
                            }))
                          }}
                          className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                            isSelected ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-gray-700">{req.documentNo}</span>
                              {req.requesterName && <span className="text-[11px] text-gray-400">{req.requesterName}</span>}
                            </div>
                            {matchItems.map((it: any) => (
                              <div key={it.id} className="text-[11px] text-gray-500 mt-0.5">
                                {it.spec ?? it.bomNo ?? '—'} · 요청 {it.quantity.toLocaleString()} {it.unit}
                              </div>
                            ))}
                          </div>
                          {isSelected && (
                            <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
                {purchaseInDialog.selected && (
                  <div className="border-t pt-3 flex items-center gap-2">
                    <label className="text-xs text-gray-500 shrink-0">입고 수량</label>
                    <Input
                      type="number" min="0"
                      value={purchaseInDialog.receiveQty}
                      onChange={e => setPurchaseInDialog(prev => ({ ...prev, receiveQty: e.target.value }))}
                      className="h-8 text-sm w-28 text-right"
                    />
                    <span className="text-xs text-gray-500 shrink-0">{purchaseInDialog.row?.unit}</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" className="text-xs" disabled={submitting}
                  onClick={() => setPurchaseInDialog(prev => ({ ...prev, open: false, selected: null }))}>취소</Button>
                <Button
                  size="sm"
                  className="text-xs bg-green-600 hover:bg-green-700 text-white"
                  disabled={submitting || !purchaseInDialog.selected || !purchaseInDialog.receiveQty || Number(purchaseInDialog.receiveQty) <= 0}
                  onClick={handlePurchaseInSubmit}
                >
                  {submitting ? '처리 중...' : '입고 확정'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      })()}

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

      {/* 재고실사 다이얼로그 */}
      <StockAuditDialog
        open={auditOpen}
        dept={auditDept}
        onClose={() => setAuditOpen(false)}
      />
    </div>
  )
}
