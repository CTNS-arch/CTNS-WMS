'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SUB_OPTIONS } from '@/lib/classification'

const CAT_LABEL: Record<string, string> = { PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재' }
const CAT_COLOR: Record<string, string> = {
  PRODUCT:   'bg-blue-100 text-blue-700',
  ASSEMBLY:  'bg-purple-100 text-purple-700',
  COMPONENT: 'bg-emerald-100 text-emerald-700',
}

const STATUS_LABEL: Record<string, string> = { PENDING: '검토중', APPROVED: '승인', REJECTED: '반려' }
const STATUS_COLOR: Record<string, string> = {
  PENDING:  'bg-amber-100 text-amber-700 border border-amber-200',
  APPROVED: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  REJECTED: 'bg-red-100 text-red-500 border border-red-200',
}
const STATUS_STRIPE: Record<string, string> = {
  PENDING:  'bg-amber-400',
  APPROVED: 'bg-emerald-500',
  REJECTED: 'bg-red-400',
}

const FILTER_PILLS = [
  { value: '', label: '전체' },
  { value: 'PENDING', label: '검토중' },
  { value: 'APPROVED', label: '승인' },
  { value: 'REJECTED', label: '반려' },
]

const LIMIT = 30

type ItemRequest = {
  id: string
  status: string
  requesterName: string | null
  category: string
  subCategory: string | null
  itemName: string
  spec: string | null
  quantity: number | null
  unit: string | null
  workCode: string | null
  memo: string | null
  reviewMemo: string | null
  oldItemCode: string | null
  linkedItemId: string | null
  createdAt: string
  requester: { name: string | null; email: string } | null
}

function getSubLabel(category: string, subCode: string | null) {
  if (!subCode) return null
  return (SUB_OPTIONS[category] ?? []).find(o => o.value === subCode)?.label ?? subCode
}

function DetailModal({
  req, canWrite, onClose, onStatusChange, onLinked,
}: {
  req: ItemRequest
  canWrite: boolean
  onClose: () => void
  onStatusChange: (id: string, status: string, reviewMemo: string) => Promise<void>
  onLinked: () => void
}) {
  const [reviewMemo, setReviewMemo] = useState(req.reviewMemo || '')
  const [saving, setSaving]         = useState(false)
  const [linkSearch, setLinkSearch] = useState('')
  const [linkResults, setLinkResults] = useState<any[]>([])
  const [linkSearching, setLinkSearching] = useState(false)
  const [linking, setLinking]       = useState(false)
  const linkTimer = useState<ReturnType<typeof setTimeout> | null>(null)

  async function searchItems(q: string) {
    if (!q.trim()) { setLinkResults([]); return }
    setLinkSearching(true)
    try {
      const res = await fetch(`/api/items?search=${encodeURIComponent(q)}&limit=8`)
      const json = await res.json()
      if (json.success) setLinkResults(json.data.items)
    } finally { setLinkSearching(false) }
  }

  function handleLinkInput(v: string) {
    setLinkSearch(v)
    clearTimeout(linkTimer[0] as any)
    ;(linkTimer as any)[0] = setTimeout(() => searchItems(v), 250)
  }

  async function handleLink(itemId: string) {
    setLinking(true)
    try {
      const res = await fetch(`/api/item-requests/${req.id}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })
      const json = await res.json()
      if (json.success) {
        const cnt = json.updatedPurchaseItems ?? 0
        toast.success(`품목 연결 완료${cnt > 0 ? ` — 구매요청 ${cnt}건 자동 업데이트` : ''}`)
        onLinked()
        onClose()
      } else {
        toast.error(json.message ?? '연결에 실패했습니다.')
      }
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setLinking(false) }
  }

  async function handle(status: string) {
    setSaving(true)
    await onStatusChange(req.id, status, reviewMemo)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[540px] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[req.status] ?? ''}`}>
              {STATUS_LABEL[req.status] ?? req.status}
            </span>
            <h2 className="text-sm font-bold text-gray-900">품목 생성 요청 상세</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg font-light">
            ×
          </button>
        </div>

        {/* 내용 */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto" style={{ maxHeight: '65vh' }}>

          {/* 기존 품목코드 (구매요청 연동) */}
          {req.oldItemCode && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[11px] text-amber-700">구매요청 기존 품목코드:</span>
              <span className="text-[11px] font-mono font-bold text-amber-800">{req.oldItemCode}</span>
              {req.linkedItemId && (
                <span className="ml-auto text-[10px] text-emerald-600 font-medium">✓ 연결완료</span>
              )}
            </div>
          )}

          {/* 분류 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">대분류</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CAT_COLOR[req.category] ?? 'bg-gray-100 text-gray-600'}`}>
                {CAT_LABEL[req.category] ?? req.category}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">중분류</p>
              <span className="text-xs text-gray-700">
                {getSubLabel(req.category, req.subCategory) ?? <span className="text-gray-300">—</span>}
              </span>
            </div>
          </div>

          {/* 품명 */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">품명 / 설명</p>
            <p className="text-sm font-semibold text-gray-900">{req.itemName}</p>
          </div>

          {/* 규격 */}
          {req.spec && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">규격 / 사양</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{req.spec}</p>
            </div>
          )}

          {/* 수량 + 단위 */}
          {(req.quantity != null || req.unit) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">필요 수량</p>
                <p className="text-xs text-gray-700">
                  {req.quantity != null ? req.quantity.toLocaleString('ko-KR') : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">단위</p>
                <p className="text-xs text-gray-700">{req.unit || '—'}</p>
              </div>
            </div>
          )}

          {/* 프로젝트코드 */}
          {req.workCode && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">프로젝트코드</p>
              <p className="text-xs font-mono text-gray-700">{req.workCode}</p>
            </div>
          )}

          {/* 요청자 메모 */}
          {req.memo && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">요청 메모</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">{req.memo}</p>
            </div>
          )}

          {/* 요청 정보 */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">요청자</p>
              <p className="text-xs text-gray-600">
                {req.requester?.name || req.requesterName || '—'}
                {req.requester?.email && (
                  <span className="text-gray-400 ml-1">({req.requester.email})</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">요청일</p>
              <p className="text-xs text-gray-600">
                {new Date(req.createdAt).toLocaleDateString('ko-KR')}
              </p>
            </div>
          </div>

          {/* 검토 의견 (이미 있는 경우) */}
          {req.reviewMemo && req.status !== 'PENDING' && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">검토 의견</p>
              <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 whitespace-pre-wrap">{req.reviewMemo}</p>
            </div>
          )}

          {/* 관리자: 품목 연결 (oldItemCode 있고 아직 미연결일 때) */}
          {canWrite && req.oldItemCode && !req.linkedItemId && (
            <div className="pt-3 border-t border-gray-200">
              <p className="text-[11px] font-semibold text-gray-700 mb-2">WMS 품목 연결</p>
              <p className="text-[11px] text-gray-400 mb-2">신규 생성된 WMS 품목을 검색해서 연결하면, 기존 구매요청의 품목코드가 자동으로 교체됩니다.</p>
              <div className="relative">
                <input
                  value={linkSearch}
                  onChange={e => handleLinkInput(e.target.value)}
                  placeholder="품목코드 또는 품목명 검색..."
                  className="w-full h-8 rounded-lg border border-gray-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {linkSearching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">검색 중...</span>
                )}
              </div>
              {linkResults.length > 0 && (
                <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
                  {linkResults.map(item => (
                    <button
                      key={item.id}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleLink(item.id)}
                      disabled={linking}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-0 flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <span className="text-[11px] font-mono font-semibold text-gray-800 whitespace-nowrap">{item.itemCode}</span>
                      <span className="text-[11px] text-gray-500 truncate">{item.itemName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 관리자 검토 영역 */}
          {canWrite && req.status === 'PENDING' && (
            <div className="pt-3 border-t border-gray-200">
              <p className="text-[11px] font-semibold text-gray-500 mb-2">검토 의견 (선택)</p>
              <textarea
                value={reviewMemo}
                onChange={e => setReviewMemo(e.target.value)}
                placeholder="승인 또는 반려 사유를 입력하세요"
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <div className="flex gap-2 mt-2.5">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handle('APPROVED')}
                  disabled={saving}
                >
                  {saving ? '처리 중...' : '승인'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => handle('REJECTED')}
                  disabled={saving}
                >
                  {saving ? '처리 중...' : '반려'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ItemRequestsPage() {
  const { data: session } = useSession()
  const canWrite = (session?.user?.roles?.includes('ITEM_WRITE') || session?.user?.roles?.includes('MASTER_ADMIN')) ?? false

  const [rows,    setRows]    = useState<ItemRequest[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [selected, setSelected] = useState<ItemRequest | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const fetchRows = useCallback(async (p: number, st: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (st) params.set('status', st)
      const res  = await fetch(`/api/item-requests?${params}`)
      const json = await res.json()
      if (json.success) {
        setRows(json.data.rows)
        setTotal(json.data.total)
        setPage(json.data.page)
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRows(page, filterStatus) }, [fetchRows, page, filterStatus])

  async function handleStatusChange(id: string, status: string, reviewMemo: string) {
    try {
      const res  = await fetch(`/api/item-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewMemo }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(status === 'APPROVED' ? '승인되었습니다.' : '반려되었습니다.')
        setSelected(null)
        fetchRows(page, filterStatus)
      } else {
        toast.error(json.message ?? '처리에 실패했습니다.')
      }
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('요청을 삭제하시겠습니까?')) return
    try {
      const res  = await fetch(`/api/item-requests/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success('삭제되었습니다.')
        fetchRows(rows.length === 1 && page > 1 ? page - 1 : page, filterStatus)
      } else {
        toast.error(json.message ?? '삭제 실패')
      }
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50/50">

      {/* 헤더 */}
      <div className="px-6 py-3 border-b bg-white shrink-0">
        <h1 className="text-sm font-bold text-gray-900">품목 생성 요청</h1>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {canWrite ? '요청된 품목 등록을 검토하고 승인/반려할 수 있습니다' : '본인이 요청한 품목 등록 내역을 확인할 수 있습니다'}
        </p>
      </div>

      {/* 필터 */}
      <div className="px-4 pt-2.5 pb-2 border-b bg-white flex gap-1.5 shrink-0">
        {FILTER_PILLS.map(pill => {
          const active = filterStatus === pill.value
          return (
            <button key={pill.value}
              onClick={() => { setFilterStatus(pill.value); setPage(1) }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                active ? 'bg-gray-800 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {pill.label}
            </button>
          )
        })}
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto">
        <table className="text-xs w-full border-collapse" style={{ minWidth: 940 }}>
          <colgroup>
            <col style={{ width: 4 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 200 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 100 }} />
          </colgroup>
          <thead className="bg-white sticky top-0 z-10">
            <tr className="border-b border-gray-200">
              <th className="w-1 p-0" />
              {['상태', '대분류', '중분류', '기존 품목코드', '품명 / 설명', '규격', '수량', '요청자', '요청일'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 whitespace-nowrap bg-gray-50/80">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-3 py-16 text-center text-gray-400">불러오는 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-16 text-center">
                  <div className="text-gray-300 text-2xl mb-2">📋</div>
                  <div className="text-gray-400 text-xs">품목 생성 요청이 없습니다.</div>
                </td>
              </tr>
            ) : rows.map(row => (
              <tr
                key={row.id}
                className="border-b border-gray-100 hover:bg-blue-50/40 transition-colors cursor-pointer"
                onClick={() => setSelected(row)}
              >
                <td className={`w-1 p-0 ${STATUS_STRIPE[row.status] ?? 'bg-gray-200'}`} />
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[row.status] ?? ''}`}>
                    {STATUS_LABEL[row.status] ?? row.status}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${CAT_COLOR[row.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {CAT_LABEL[row.category] ?? row.category}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                  {getSubLabel(row.category, row.subCategory) ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  {row.oldItemCode
                    ? <span className={`font-mono text-[11px] font-semibold whitespace-nowrap ${row.linkedItemId ? 'text-emerald-600' : 'text-amber-600'}`}>{row.oldItemCode}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5 font-medium text-gray-800 max-w-[200px] truncate whitespace-nowrap">{row.itemName}</td>
                <td className="px-3 py-2.5 text-gray-500 max-w-[150px] truncate">
                  {row.spec || <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                  {row.quantity != null ? `${row.quantity.toLocaleString()} ${row.unit || ''}` : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5 text-gray-600">
                  {row.requester?.name || row.requesterName || '—'}
                </td>
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                  {new Date(row.createdAt).toLocaleDateString('ko-KR')}
                </td>
              </tr>
            ))}
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

      {/* 상세 팝업 */}
      {selected && (
        <DetailModal
          req={selected}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          onLinked={() => fetchRows(page, filterStatus)}
        />
      )}
    </div>
  )
}
