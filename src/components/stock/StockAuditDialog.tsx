'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type Dept = 'LAB' | 'PRODUCTION'

const DEPT_LABEL: Record<Dept, string> = { LAB: '연구소', PRODUCTION: '생산구매팀' }

const CAT_LABEL: Record<string, string> = {
  PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재',
}

interface AuditItem {
  id: string
  itemCode: string
  itemName: string
  unit: string
  category: string | null
  subCategory: string | null
  systemQty: number
  actualQty: number | null
}

interface Audit {
  id: string
  department: Dept
  note: string | null
  auditedAt: string
  user: { name: string | null; email: string | null } | null
  items: AuditItem[]
}

interface HistoryAudit {
  id: string
  department: Dept
  note: string | null
  auditedAt: string
  user: { name: string | null; email: string | null } | null
  _count: { items: number }
}

interface Props {
  open: boolean
  dept: Dept
  onClose: () => void
}

type View = 'history' | 'create' | 'historyDetail'

const HIST_LIMIT = 15

export default function StockAuditDialog({ open, dept, onClose }: Props) {
  const [view,           setView]           = useState<View>('history')
  const [audit,          setAudit]          = useState<Audit | null>(null)
  const [editMap,        setEditMap]        = useState<Record<string, string>>({})
  const [note,           setNote]           = useState('')
  const [loading,        setLoading]        = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [saved,          setSaved]          = useState(false)

  const [history,        setHistory]        = useState<HistoryAudit[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyDetail,  setHistoryDetail]  = useState<Audit | null>(null)
  const [historyPage,    setHistoryPage]    = useState(1)
  const [historyTotal,   setHistoryTotal]   = useState(0)

  // 다이얼로그 열릴 때마다 히스토리 뷰로 리셋
  useEffect(() => {
    if (open) {
      setView('history')
      setAudit(null)
      setEditMap({})
      setNote('')
      setSaved(false)
    }
  }, [open])

  // ── 히스토리 목록 ─────────────────────────────────────────
  const loadHistory = useCallback(async (p: number) => {
    setHistoryLoading(true)
    try {
      const res  = await fetch(`/api/stock/audit?department=${dept}&page=${p}&limit=${HIST_LIMIT}`)
      const json = await res.json()
      if (json.success) {
        setHistory(json.data.audits)
        setHistoryTotal(json.data.total)
        setHistoryPage(p)
      }
    } catch { toast.error('히스토리 로드 실패') }
    finally { setHistoryLoading(false) }
  }, [dept])

  useEffect(() => {
    if (open && view === 'history') loadHistory(1)
  }, [open, view, loadHistory])

  // ── 새 실사 생성 ──────────────────────────────────────────
  async function startCreate() {
    setView('create')
    setAudit(null)
    setSaved(false)
    setLoading(true)
    try {
      const res  = await fetch('/api/stock/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: dept }),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.message ?? '실사 생성 실패'); setView('history'); return }
      const a: Audit = json.data
      setAudit(a)
      const initMap: Record<string, string> = {}
      for (const it of a.items) {
        initMap[it.id] = it.actualQty != null ? String(it.actualQty) : ''
      }
      setEditMap(initMap)
      setNote(a.note ?? '')
    } catch { toast.error('서버 오류가 발생했습니다.'); setView('history') }
    finally { setLoading(false) }
  }

  // ── 저장 ──────────────────────────────────────────────────
  async function handleSave() {
    if (!audit) return
    setSaving(true)
    try {
      const items = audit.items.map(it => ({
        id: it.id,
        actualQty: editMap[it.id] !== '' && editMap[it.id] != null ? Number(editMap[it.id]) : null,
      }))
      const res  = await fetch(`/api/stock/audit/${audit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, note }),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.message ?? '저장 실패'); return }
      setAudit(json.data)
      setSaved(true)
      toast.success('재고실사가 저장되었습니다.')
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setSaving(false) }
  }

  // ── 히스토리 상세 ─────────────────────────────────────────
  async function openHistoryDetail(id: string) {
    setHistoryDetail(null)
    setView('historyDetail')
    try {
      const res  = await fetch(`/api/stock/audit/${id}`)
      const json = await res.json()
      if (json.success) setHistoryDetail(json.data)
      else toast.error('상세 로드 실패')
    } catch { toast.error('서버 오류') }
  }

  // ── PDF 인쇄 ──────────────────────────────────────────────
  function printAudit(a: Audit) {
    const deptLabel = DEPT_LABEL[a.department]
    const dateStr   = new Date(a.auditedAt).toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
    const rows = a.items.map(it => {
      const sys  = it.systemQty
      const act  = it.actualQty ?? null
      const diff = act != null ? act - sys : null
      const diffStr   = diff == null ? '-' : diff > 0 ? `+${diff.toLocaleString()}` : diff < 0 ? diff.toLocaleString() : '0'
      const diffColor = diff == null ? '' : diff > 0 ? 'color:#15803d' : diff < 0 ? 'color:#dc2626' : 'color:#555'
      return `<tr>
        <td>${it.itemCode}</td><td>${it.itemName}</td>
        <td>${CAT_LABEL[it.category ?? ''] ?? it.category ?? '-'}</td>
        <td>${it.unit}</td>
        <td style="text-align:right">${sys.toLocaleString()}</td>
        <td style="text-align:right">${act != null ? act.toLocaleString() : '-'}</td>
        <td style="text-align:right;${diffColor}">${diffStr}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>재고실사 — ${deptLabel} ${dateStr}</title>
<style>
  body{font-family:'Malgun Gothic',sans-serif;font-size:11px;margin:24px;color:#111}
  h2{font-size:15px;margin:0 0 4px}
  .sub{font-size:11px;color:#666;margin-bottom:16px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #ccc;padding:5px 8px;white-space:nowrap}
  th{background:#f5f5f5;font-weight:600;text-align:left}
  tr:nth-child(even){background:#fafafa}
  .note{margin-top:16px;font-size:11px;color:#444}
  @media print{body{margin:12px}}
</style></head><body>
<h2>재고실사 보고서</h2>
<div class="sub">${deptLabel} · ${dateStr}${a.user?.name ? ' · ' + a.user.name : ''}</div>
<table>
  <thead><tr><th>품번</th><th>품명</th><th>분류</th><th>단위</th><th>시스템재고</th><th>실사재고</th><th>차이</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
${a.note ? `<div class="note">비고: ${a.note}</div>` : ''}
</body></html>`

    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) { toast.error('팝업 차단을 해제해주세요.'); return }
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  if (!open) return null

  const totalPages = Math.max(1, Math.ceil(historyTotal / HIST_LIMIT))
  const deptLabel  = DEPT_LABEL[dept]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '90vw', maxWidth: 1000, height: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-6 py-4 border-b shrink-0 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {(view === 'create' || view === 'historyDetail') && (
                <button
                  onClick={() => { setView('history'); if (view === 'create') loadHistory(1) }}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  ← 목록
                </button>
              )}
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  재고 실사 — {deptLabel}
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {view === 'history'       && '실사 이력을 확인하거나 새 실사를 생성합니다.'}
                  {view === 'create'        && (audit ? `${new Date(audit.auditedAt).toLocaleString('ko-KR')} 기준 스냅샷 · ${audit.items.length}개 품목` : '재고 불러오는 중...')}
                  {view === 'historyDetail' && (historyDetail ? `${new Date(historyDetail.auditedAt).toLocaleString('ko-KR')} 기준 · ${historyDetail.items.length}개 품목` : '불러오는 중...')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {view === 'history' && (
                <Button
                  size="sm"
                  className="h-8 text-xs px-4 bg-blue-600 hover:bg-blue-700"
                  onClick={startCreate}
                >
                  + 새 실사 생성
                </Button>
              )}
              {view === 'historyDetail' && historyDetail && (
                <button
                  onClick={() => printAudit(historyDetail)}
                  className="h-8 px-3 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                >
                  PDF 저장
                </button>
              )}
              <button onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg font-light">
                ×
              </button>
            </div>
          </div>
        </div>

        {/* ── 히스토리 목록 ─────────────────────────────────── */}
        {view === 'history' && (
          <div className="flex-1 overflow-y-auto min-h-0">
            {historyLoading ? (
              <p className="text-xs text-gray-400 text-center py-16">불러오는 중...</p>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400">아직 실사 이력이 없습니다.</p>
                <Button size="sm" className="h-8 text-xs px-5 bg-blue-600 hover:bg-blue-700 mt-1" onClick={startCreate}>
                  첫 실사 생성
                </Button>
              </div>
            ) : (
              <>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      {['날짜', '품목 수', '비고', '담당자', ''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id} className="border-b hover:bg-blue-50/40 transition-colors">
                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">
                          {new Date(h.auditedAt).toLocaleDateString('ko-KR')}
                          <span className="ml-1.5 text-gray-400">
                            {new Date(h.auditedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{h._count.items.toLocaleString()}개</td>
                        <td className="px-4 py-2.5 text-gray-500 max-w-[220px] truncate">{h.note ?? '-'}</td>
                        <td className="px-4 py-2.5 text-gray-500">{h.user?.name ?? h.user?.email ?? '-'}</td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => openHistoryDetail(h.id)}
                            className="h-6 px-2.5 rounded text-[10px] font-medium border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 whitespace-nowrap"
                          >
                            상세 보기
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1 py-4">
                    <button disabled={historyPage === 1} onClick={() => loadHistory(historyPage - 1)}
                      className="h-7 px-2.5 rounded text-xs border border-gray-200 text-gray-600 disabled:opacity-40">이전</button>
                    <span className="text-xs text-gray-500 px-2">{historyPage} / {totalPages}</span>
                    <button disabled={historyPage === totalPages} onClick={() => loadHistory(historyPage + 1)}
                      className="h-7 px-2.5 rounded text-xs border border-gray-200 text-gray-600 disabled:opacity-40">다음</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── 히스토리 상세 (읽기 전용) ────────────────────── */}
        {view === 'historyDetail' && (
          <div className="flex-1 overflow-y-auto min-h-0">
            {!historyDetail ? (
              <p className="text-xs text-gray-400 text-center py-16">불러오는 중...</p>
            ) : (
              <AuditTable items={historyDetail.items} editMap={{}} readOnly />
            )}
          </div>
        )}

        {/* ── 새 실사 작성 ─────────────────────────────────── */}
        {view === 'create' && (
          <>
            <div className="flex-1 overflow-y-auto min-h-0">
              {loading ? (
                <p className="text-xs text-gray-400 text-center py-16">재고 불러오는 중...</p>
              ) : audit ? (
                <AuditTable
                  items={audit.items}
                  editMap={editMap}
                  onEdit={(id, val) => setEditMap(prev => ({ ...prev, [id]: val }))}
                />
              ) : null}
            </div>
            {/* 푸터 */}
            <div className="px-6 py-3 border-t bg-gray-50/70 shrink-0 flex items-center gap-3">
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="비고 (선택)"
                className="flex-1 h-8 px-2.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
              {saved && audit && (
                <Button variant="outline" size="sm" className="h-8 text-xs px-4 border-gray-300"
                  onClick={() => printAudit({ ...audit, note })}>
                  PDF 저장
                </Button>
              )}
              <Button size="sm" className="h-8 text-xs px-5 bg-blue-600 hover:bg-blue-700"
                onClick={handleSave} disabled={!audit || saving}>
                {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── 실사 테이블 ───────────────────────────────────────────────
function AuditTable({
  items, editMap, onEdit, readOnly = false,
}: {
  items: AuditItem[]
  editMap: Record<string, string>
  onEdit?: (id: string, val: string) => void
  readOnly?: boolean
}) {
  if (items.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-12">품목이 없습니다.</p>
  }

  return (
    <table className="w-full text-xs" style={{ tableLayout: 'fixed', minWidth: 760 }}>
      <colgroup>
        <col style={{ width: 140 }} />
        <col style={{ width: 220 }} />
        <col style={{ width: 80 }} />
        <col style={{ width: 60 }} />
        <col style={{ width: 110 }} />
        <col style={{ width: 130 }} />
        <col style={{ width: 110 }} />
      </colgroup>
      <thead className="bg-gray-50 sticky top-0 z-10">
        <tr>
          {['품번', '품명', '분류', '단위', '시스템 재고', '실사 재고', '차이'].map(h => (
            <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 border-b whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map(it => {
          const sys  = it.systemQty
          const rawAct = readOnly
            ? (it.actualQty != null ? String(it.actualQty) : '')
            : (editMap[it.id] ?? '')
          const act  = rawAct !== '' ? Number(rawAct) : null
          const diff = act != null ? act - sys : null

          return (
            <tr key={it.id} className="border-b hover:bg-gray-50/60 transition-colors">
              <td className="px-3 py-1.5 font-mono text-gray-700 truncate" title={it.itemCode}>{it.itemCode}</td>
              <td className="px-3 py-1.5 text-gray-700 truncate" title={it.itemName}>{it.itemName}</td>
              <td className="px-3 py-1.5 text-gray-500 truncate">{CAT_LABEL[it.category ?? ''] ?? it.category ?? '-'}</td>
              <td className="px-3 py-1.5 text-gray-500">{it.unit}</td>
              <td className="px-3 py-1.5 text-right text-gray-700 font-medium">{sys.toLocaleString()}</td>
              <td className="px-3 py-1">
                {readOnly ? (
                  <span className="text-gray-700">{act != null ? act.toLocaleString() : '-'}</span>
                ) : (
                  <input
                    type="number"
                    value={editMap[it.id] ?? ''}
                    onChange={e => onEdit?.(it.id, e.target.value)}
                    placeholder={String(sys)}
                    className="w-full h-7 px-2 text-xs text-right rounded border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                )}
              </td>
              <td className={`px-3 py-1.5 text-right font-medium ${
                diff == null ? 'text-gray-300' :
                diff > 0     ? 'text-green-600' :
                diff < 0     ? 'text-red-500'   : 'text-gray-400'
              }`}>
                {diff == null ? '-' : diff > 0 ? `+${diff.toLocaleString()}` : diff < 0 ? diff.toLocaleString() : '0'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
