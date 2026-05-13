'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })
}

function fmtNum(v: number | null | undefined, digits = 0) {
  if (v == null) return '—'
  return v.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

const LIMIT = 50

type HistoryRow = {
  id: string
  actualReceiptDate: string | null
  workCode: string | null
  bomNo: string | null
  spec: string | null
  quantity: number
  unit: string
  supplier: string | null
  buyerCurrency: string | null
  unitPrice: number | null
  buyerSupplyAmount: number | null
  buyerTaxAmount: number | null
  additionalCost: number | null
  krwAmount: number | null
  purchaseRequest: { documentNo: string | null; department: string } | null
  item: { itemCode: string; itemName: string; unit: string } | null
}

const COLS = ['입고일', '부서', '구매코드', '프로젝트코드', '품목코드', '품명', '수량', '단위', '공급금액(KRW)', '단가(KRW)']

export default function CostPage() {
  const [rows,    setRows]    = useState<HistoryRow[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)

  const [itemInput,     setItemInput]     = useState('')
  const [workCodeInput, setWorkCodeInput] = useState('')
  const [dateFrom,      setDateFrom]      = useState('')
  const [dateTo,        setDateTo]        = useState('')

  const [item,     setItem]     = useState('')
  const [workCode, setWorkCode] = useState('')

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const fetchRows = useCallback(async (p: number, it: string, wc: string, df: string, dt: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (it) params.set('item', it)
      if (wc) params.set('workCode', wc)
      if (df) params.set('dateFrom', df)
      if (dt) params.set('dateTo', dt)
      const res  = await fetch(`/api/cost/history?${params}`)
      const json = await res.json()
      if (json.success) {
        setRows(json.data.rows)
        setTotal(json.data.total)
        setPage(json.data.page)
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRows(page, item, workCode, dateFrom, dateTo) }, [page, item, workCode, dateFrom, dateTo])

  function applySearch() {
    setItem(itemInput)
    setWorkCode(workCodeInput)
    setPage(1)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') applySearch()
  }

  function clearFilters() {
    setItemInput(''); setWorkCodeInput(''); setDateFrom(''); setDateTo('')
    setItem(''); setWorkCode('')
    setPage(1)
  }

  const hasFilter = itemInput || workCodeInput || dateFrom || dateTo

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50/50">

      {/* 헤더 */}
      <div className="px-6 py-3 border-b bg-white shrink-0">
        <h1 className="text-sm font-bold text-gray-900">원가 관리</h1>
        <p className="text-[11px] text-gray-400 mt-0.5">입고 완료된 품목의 구매 원가 내역을 조회합니다</p>
      </div>

      {/* 필터 바 */}
      <div className="px-4 py-3 border-b bg-white shrink-0 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500">품목 검색</label>
          <Input
            value={itemInput}
            onChange={e => setItemInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="품번 또는 품명"
            className="h-8 text-xs w-44"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500">프로젝트코드</label>
          <Input
            value={workCodeInput}
            onChange={e => setWorkCodeInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="B26-1234"
            className="h-8 text-xs w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500">입고일 (시작)</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            className="h-8 text-xs w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500">입고일 (종료)</label>
          <Input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1) }}
            className="h-8 text-xs w-36"
          />
        </div>
        <div className="flex gap-1.5 pb-0.5">
          <Button size="sm" className="h-8 text-xs px-4 bg-blue-600 hover:bg-blue-700" onClick={applySearch}>
            검색
          </Button>
          {hasFilter && (
            <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={clearFilters}>
              초기화
            </Button>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto">
        <table className="text-xs w-full border-collapse" style={{ minWidth: 980 }}>
          <colgroup>
            <col style={{ width: 88 }} />   {/* 입고일 */}
            <col style={{ width: 78 }} />   {/* 부서 */}
            <col style={{ width: 116 }} />  {/* 구매코드 */}
            <col style={{ width: 116 }} />  {/* 프로젝트코드 */}
            <col style={{ width: 130 }} />  {/* 품목코드 */}
            <col />                          {/* 품명 (남은 공간 채움) */}
            <col style={{ width: 68 }} />   {/* 수량 */}
            <col style={{ width: 48 }} />   {/* 단위 */}
            <col style={{ width: 148 }} />  {/* 공급금액(KRW) */}
            <col style={{ width: 136 }} />  {/* 단가(KRW) */}
          </colgroup>
          <thead className="bg-white sticky top-0 z-10">
            <tr className="border-b border-gray-200">
              {COLS.map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 whitespace-nowrap bg-gray-50/80">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-3 py-16 text-center text-gray-400 text-xs">불러오는 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-16 text-center">
                  <div className="text-gray-300 text-2xl mb-2">📊</div>
                  <div className="text-gray-400 text-xs">원가 내역이 없습니다.</div>
                  <div className="text-gray-300 text-xs mt-1">입고 완료된 구매 품목이 여기에 표시됩니다.</div>
                </td>
              </tr>
            ) : rows.map(row => {
              const itemCode    = row.item?.itemCode || row.bomNo || '—'
              const itemName    = row.item?.itemName || row.spec  || '—'
              const unit        = row.item?.unit     || row.unit
              const supplyKrw   = row.krwAmount
              const unitPriceKrw = supplyKrw != null && row.quantity > 0
                ? Math.round(supplyKrw / row.quantity)
                : null
              return (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fmtDate(row.actualReceiptDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                    {row.purchaseRequest?.department || '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600 font-mono text-[11px]">
                    {row.purchaseRequest?.documentNo || '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600 font-mono text-[11px]">
                    {row.workCode || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-mono text-gray-700 text-[11px]">{itemCode}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-700 truncate max-w-0">{itemName}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums text-gray-700">
                    {fmtNum(row.quantity)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">{unit}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums font-medium text-gray-800">
                    {supplyKrw != null ? `₩ ${fmtNum(supplyKrw)}` : '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums text-blue-700 font-medium">
                    {unitPriceKrw != null ? `₩ ${fmtNum(unitPriceKrw)}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="px-4 py-2 border-t bg-white shrink-0 flex items-center justify-between">
        <span className="text-xs text-gray-400">총 {total.toLocaleString()}건</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs"
            disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>이전</Button>
          <span className="text-xs text-gray-500 px-2">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" className="h-7 text-xs"
            disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>다음</Button>
        </div>
      </div>
    </div>
  )
}
