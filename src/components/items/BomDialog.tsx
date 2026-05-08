'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ItemFormDialog from '@/components/items/ItemFormDialog'

const CAT_LABEL: Record<string, string> = { PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재' }
const CAT_COLOR: Record<string, string> = {
  PRODUCT:   'bg-blue-100 text-blue-700',
  ASSEMBLY:  'bg-purple-100 text-purple-700',
  COMPONENT: 'bg-emerald-100 text-emerald-700',
}
const SUB_LABEL: Record<string, string> = {
  BP: '배터리팩', BM: 'BMS', PC: 'PCM',
  CL: '셀', EL: '전장/전기부품', ME: '기구/외장부품',
  CD: '도전재', PK: '포장자재', FS: '체결부품',
  SM: '부자재/소모품', RM: '일반자재', OT: '샘플/기타',
  PO: 'Soft pack', CAS: 'Case', PRA: 'Power Relay Assembly',
}

interface BomRow {
  _key: string
  id?: string
  childId?: string
  child?: { id: string; itemCode: string; itemName: string; unit: string; category: string; subCategory?: string | null }
  quantity: string
  unit: string
  memo: string
}

interface SearchState {
  query: string
  results: any[]
  open: boolean
}

let _keyCounter = 0
const newKey = () => `row-${++_keyCounter}`

interface Props {
  open: boolean
  item: any
  onClose: () => void
  onBomChanged?: (count: number) => void
}

export default function BomDialog({ open, item, onClose, onBomChanged }: Props) {
  const [rows, setRows] = useState<BomRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [searches, setSearches] = useState<Record<string, SearchState>>({})
  const [deleting, setDeleting] = useState(false)
  const [viewItem, setViewItem] = useState<any>(null)
  const [isDirty, setIsDirty] = useState(false)

  const searchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const fetchBom = useCallback(async () => {
    if (!item?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/items/${item.id}/bom`)
      const json = await res.json()
      if (json.success) {
        const existingRows: BomRow[] = json.data.map((l: any) => ({
          _key: newKey(),
          id: l.id,
          childId: l.childId,
          child: l.child,
          quantity: String(l.quantity),
          unit: l.unit,
          memo: l.memo ?? '',
        }))
        setRows([...existingRows, { _key: newKey(), quantity: '', unit: '', memo: '' }])
      }
    } finally {
      setLoading(false)
    }
  }, [item?.id])

  useEffect(() => {
    if (open) {
      fetchBom()
      setSelectedKeys(new Set())
      setSearches({})
      setIsDirty(false)
    }
  }, [open, fetchBom])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      Object.entries(dropdownRefs.current).forEach(([key, ref]) => {
        if (ref && !ref.contains(e.target as Node)) {
          setSearches(prev => {
            if (!prev[key]?.open) return prev
            return { ...prev, [key]: { ...prev[key], open: false } }
          })
        }
      })
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const doSearch = useCallback((rowKey: string, q: string, excludeIds: Set<string>, parentId: string) => {
    clearTimeout(searchTimers.current[rowKey])
    searchTimers.current[rowKey] = setTimeout(async () => {
      try {
        const url = q.trim()
          ? `/api/items?search=${encodeURIComponent(q)}&limit=12`
          : `/api/items?limit=12&sortBy=createdAt&sortOrder=desc`
        const res = await fetch(url)
        const json = await res.json()
        if (json.success) {
          const results = json.data.items.filter((i: any) => i.id !== parentId && !excludeIds.has(i.id))
          setSearches(prev => ({ ...prev, [rowKey]: { ...(prev[rowKey] ?? { query: q, results: [], open: true }), results, open: true } }))
        }
      } catch {}
    }, q.trim() ? 250 : 0)
  }, [])

  const handleItemSelect = async (rowKey: string, selectedItem: any) => {
    setSearches(prev => ({ ...prev, [rowKey]: { query: '', results: [], open: false } }))

    setRows(prev => {
      const idx = prev.findIndex(r => r._key === rowKey)
      if (idx === -1) return prev
      const newRows = [...prev]
      newRows[idx] = { ...newRows[idx], childId: selectedItem.id, child: selectedItem, unit: selectedItem.unit || '', quantity: '1' }
      if (idx === prev.length - 1) newRows.push({ _key: newKey(), quantity: '', unit: '', memo: '' })
      return newRows
    })

    try {
      const res = await fetch(`/api/items/${item.id}/bom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: selectedItem.id, quantity: 1, unit: selectedItem.unit || '', memo: '' }),
      })
      const json = await res.json()
      if (json.success) {
        setRows(prev => prev.map(r => r._key === rowKey ? { ...r, id: json.data.id } : r))
        setIsDirty(true)
      } else {
        toast.error(json.message)
        setRows(prev => prev.map(r => r._key === rowKey ? { ...r, childId: undefined, child: undefined, quantity: '', unit: '', memo: '' } : r))
      }
    } catch {
      toast.error('저장에 실패했습니다.')
    }
  }

  const handleFieldBlur = async (rowKey: string) => {
    const row = rows.find(r => r._key === rowKey)
    if (!row?.id) return
    if (!row.quantity || parseFloat(row.quantity) <= 0) return
    try {
      await fetch(`/api/items/${item.id}/bom/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: row.quantity, unit: row.unit, memo: row.memo }),
      })
      setIsDirty(true)
    } catch {}
  }

  const updateField = (rowKey: string, field: 'quantity' | 'unit' | 'memo', value: string) => {
    setRows(prev => prev.map(r => r._key === rowKey ? { ...r, [field]: value } : r))
  }

  const handleCloneRow = (row: BomRow) => {
    const newRow: BomRow = { _key: newKey(), childId: row.childId, child: row.child, quantity: row.quantity, unit: row.unit, memo: row.memo }
    setRows(prev => {
      const idx = prev.findIndex(r => r._key === row._key)
      if (idx === -1) return prev
      const next = [...prev]
      next.splice(idx + 1, 0, newRow)
      return next
    })
  }

  const handleDeleteRow = async (row: BomRow) => {
    if (row.id) {
      try {
        await fetch(`/api/items/${item.id}/bom/${row.id}`, { method: 'DELETE' })
      } catch {}
    }
    setRows(prev => {
      const remaining = prev.filter(r => r._key !== row._key)
      const last = remaining[remaining.length - 1]
      if (!last || last.childId) remaining.push({ _key: newKey(), quantity: '', unit: '', memo: '' })
      return remaining
    })
    if (row.id) {
      setSelectedKeys(prev => { const s = new Set(prev); s.delete(row._key); return s })
      setIsDirty(true)
    }
  }

  const handleDeleteSelected = async () => {
    const toDelete = rows.filter(r => r.id && selectedKeys.has(r._key))
    if (toDelete.length === 0) return
    if (!confirm(`선택한 ${toDelete.length}개 항목을 삭제하시겠습니까?`)) return

    setDeleting(true)
    try {
      for (const row of toDelete) {
        await fetch(`/api/items/${item.id}/bom/${row.id}`, { method: 'DELETE' })
      }
      setRows(prev => {
        const remaining = prev.filter(r => !selectedKeys.has(r._key) || !r.id)
        const last = remaining[remaining.length - 1]
        if (!last || last.childId) remaining.push({ _key: newKey(), quantity: '', unit: '', memo: '' })
        return remaining
      })
      setSelectedKeys(new Set())
      setIsDirty(true)
      toast.success(`${toDelete.length}개 항목이 삭제되었습니다.`)
    } finally {
      setDeleting(false)
    }
  }

  const handlePrint = () => {
    const savedRows = rows.filter(r => r.child)
    const rowsHtml = savedRows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td style="font-family:monospace">${r.child?.itemCode ?? ''}</td>
        <td>${r.child?.itemName ?? ''}</td>
        <td>${CAT_LABEL[r.child?.category ?? ''] ?? ''}</td>
        <td>${r.child?.subCategory ? (SUB_LABEL[r.child.subCategory] ?? r.child.subCategory) : ''}</td>
        <td style="text-align:right">${r.quantity}</td>
        <td>${r.unit}</td>
        <td>${r.memo}</td>
      </tr>
    `).join('')

    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head>
      <title>BOM - ${item?.itemCode ?? ''}</title>
      <style>
        body { font-family: sans-serif; font-size: 12px; padding: 24px; color: #111; }
        h2 { font-size: 15px; margin: 0 0 4px; }
        .sub { font-size: 11px; color: #666; margin-bottom: 18px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 11px; }
        th { background: #f5f5f5; font-weight: 600; }
        tr:nth-child(even) td { background: #fafafa; }
        @media print { body { padding: 12px; } }
      </style>
    </head><body>
      <h2>BOM 구성 관리</h2>
      <div class="sub">${item?.itemCode ?? ''} — ${item?.itemName ?? ''} &nbsp;|&nbsp; 총 ${savedRows.length}개 구성 품목</div>
      <table>
        <thead><tr><th>#</th><th>품번</th><th>품명</th><th>대분류</th><th>중분류</th><th>수량</th><th>단위</th><th>비고</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>`)
    w.document.close()
    w.print()
  }

  const handleViewItem = async (child: any) => {
    try {
      const res = await fetch(`/api/items/${child.id}`)
      const json = await res.json()
      if (json.success) setViewItem(json.data)
      else toast.error('품목 정보를 불러오지 못했습니다.')
    } catch {
      toast.error('품목 정보를 불러오지 못했습니다.')
    }
  }

  const handleClose = () => {
    if (isDirty) onBomChanged?.(rows.filter(r => r.id).length)
    onClose()
  }

  const handleSave = () => {
    const count = rows.filter(r => r.id).length
    onBomChanged?.(count)
    setIsDirty(false)
    toast.success('BOM이 저장되었습니다.')
  }

  if (!open) return null

  const savedRows = rows.filter(r => r.id)
  const selectableRows = savedRows
  const allSelected = selectableRows.length > 0 && selectableRows.every(r => selectedKeys.has(r._key))
  const existingChildIds = new Set(rows.filter(r => r.childId).map(r => r.childId!))

  // precompute display numbers (저장 행 + 복제 미저장 행 모두 포함)
  const displayNums = new Map<string, number>()
  let cnt = 0
  rows.forEach(r => { if (r.child) displayNums.set(r._key, ++cnt) })

  const cell = 'h-7 w-full bg-transparent px-2 text-xs focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none hover:bg-gray-50 transition-colors rounded border-0 disabled:opacity-30 disabled:cursor-not-allowed'

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 1100, height: 720 }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-white shrink-0">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-bold text-gray-900">BOM 구성 관리</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[item?.category] ?? 'bg-gray-100 text-gray-600'}`}>
                {CAT_LABEL[item?.category] ?? item?.category}
              </span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {savedRows.length}개 구성 품목
              </span>
            </div>
            <p className="text-xs text-gray-500 font-mono">
              <span className="font-semibold text-gray-700">{item?.itemCode}</span>
              <span className="mx-1.5 text-gray-300">—</span>
              {item?.itemName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs px-3 gap-1.5" onClick={handlePrint}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              PDF 출력
            </Button>
            <button onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg leading-none">
              ×
            </button>
          </div>
        </div>

        {/* 선택 서브헤더 */}
        {selectedKeys.size > 0 && (
          <div className="flex items-center gap-2.5 px-6 py-2 bg-blue-50 border-b shrink-0">
            <span className="text-xs text-blue-700 font-medium">{selectedKeys.size}개 선택됨</span>
            <Button size="sm" variant="destructive" className="h-6 text-xs px-3" onClick={handleDeleteSelected} disabled={deleting}>
              {deleting ? '삭제 중...' : '선택 삭제'}
            </Button>
            <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setSelectedKeys(new Set())}>
              선택 해제
            </button>
          </div>
        )}

        {/* 테이블 */}
        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-xs gap-2">
              <svg className="animate-spin w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              불러오는 중...
            </div>
          ) : (
            <table className="w-full text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: 36 }} />
                <col style={{ width: 180 }} />
                <col />
                <col style={{ width: 72 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 76 }} />
                <col style={{ width: 60 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 80 }} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-2.5 text-center">
                    <input type="checkbox" checked={allSelected}
                      onChange={() => {
                        if (allSelected) setSelectedKeys(new Set())
                        else setSelectedKeys(new Set(selectableRows.map(r => r._key)))
                      }}
                      className="rounded"
                    />
                  </th>
                  <th className="py-2.5 text-center text-gray-400 font-medium">#</th>
                  <th className="px-2 py-2.5 text-left text-gray-500 font-medium">품번</th>
                  <th className="px-2 py-2.5 text-left text-gray-500 font-medium">품명</th>
                  <th className="px-2 py-2.5 text-left text-gray-500 font-medium">대분류</th>
                  <th className="px-2 py-2.5 text-left text-gray-500 font-medium">중분류</th>
                  <th className="px-2 py-2.5 text-right text-gray-500 font-medium">수량 <span className="text-red-400">*</span></th>
                  <th className="px-2 py-2.5 text-center text-gray-500 font-medium">단위</th>
                  <th className="px-2 py-2.5 text-left text-gray-500 font-medium">비고</th>
                  <th className="py-2.5 text-center text-gray-400 font-medium text-[10px]">작업</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const isSaved = !!row.id
                  const isSel = selectedKeys.has(row._key)
                  const search = searches[row._key]
                  const num = displayNums.get(row._key) ?? ''

                  return (
                    <tr key={row._key}
                      className={`border-b border-gray-100 transition-colors ${isSel ? 'bg-blue-50' : 'hover:bg-gray-50/60'}`}
                    >
                      {/* 체크 */}
                      <td className="py-1 text-center">
                        {row.child && (
                          <input type="checkbox" checked={isSel}
                            onChange={() => setSelectedKeys(prev => {
                              const s = new Set(prev)
                              s.has(row._key) ? s.delete(row._key) : s.add(row._key)
                              return s
                            })}
                            className="rounded"
                          />
                        )}
                      </td>

                      {/* # */}
                      <td className="py-1 text-center text-gray-400 tabular-nums">{num}</td>

                      {/* 품번 (검색 or 표시) */}
                      <td className="px-0.5 py-0.5 border-r border-gray-100">
                        {row.child && isSaved ? (
                          <div className="flex items-center h-7 px-2">
                            <span className="font-mono text-gray-700 truncate text-xs">{row.child.itemCode}</span>
                          </div>
                        ) : row.child && !isSaved ? (
                          <div className="flex items-center h-7 px-2">
                            <span className="font-mono text-gray-700 truncate text-xs">{row.child.itemCode}</span>
                          </div>
                        ) : (
                          <div ref={el => { dropdownRefs.current[row._key] = el }} className="relative">
                            <div className="relative">
                              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 pointer-events-none"
                                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <input
                                value={search?.query ?? ''}
                                onChange={e => {
                                  const q = e.target.value
                                  setSearches(prev => ({ ...prev, [row._key]: { ...(prev[row._key] ?? { query: '', results: [], open: false }), query: q, open: true } }))
                                  doSearch(row._key, q, existingChildIds, item?.id)
                                }}
                                onFocus={() => doSearch(row._key, search?.query ?? '', existingChildIds, item?.id)}
                                placeholder="품번·품명 검색"
                                className={cell + ' pl-6'}
                              />
                            </div>
                            {search?.open && (
                              <div className="absolute top-full left-0 z-50 mt-1 border border-gray-200 rounded-lg bg-white shadow-xl overflow-hidden" style={{ width: 580, maxHeight: 224 }}>
                                {search.results.length === 0 ? (
                                  <div className="px-4 py-3 text-xs text-gray-400 text-center">
                                    {search.query.trim() ? '검색 결과 없음' : '불러오는 중...'}
                                  </div>
                                ) : (
                                  <div className="overflow-y-auto" style={{ maxHeight: 224 }}>
                                    {search.results.map((r: any) => (
                                      <div key={r.id}
                                        onMouseDown={() => handleItemSelect(row._key, r)}
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                                      >
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${CAT_COLOR[r.category] ?? 'bg-gray-100 text-gray-600'}`}>
                                          {CAT_LABEL[r.category]?.[0]}
                                        </span>
                                        <span className="font-mono text-xs text-gray-700 w-52 shrink-0 truncate">{r.itemCode}</span>
                                        <span className="text-xs text-gray-600 flex-1 truncate">{r.itemName}</span>
                                        <span className="text-xs text-gray-400 shrink-0">{r.unit}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 품명 */}
                      <td className="px-2 py-1 text-gray-700 truncate border-r border-gray-100 text-xs">
                        {row.child?.itemName ?? <span className="text-gray-200">—</span>}
                      </td>

                      {/* 대분류 */}
                      <td className="px-2 py-1 border-r border-gray-100">
                        {row.child ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CAT_COLOR[row.child.category] ?? 'bg-gray-100 text-gray-600'}`}>
                            {CAT_LABEL[row.child.category] ?? row.child.category}
                          </span>
                        ) : <span className="text-gray-200">—</span>}
                      </td>

                      {/* 중분류 */}
                      <td className="px-2 py-1 border-r border-gray-100">
                        {row.child?.subCategory ? (
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {SUB_LABEL[row.child.subCategory] ?? row.child.subCategory}
                          </span>
                        ) : <span className="text-gray-200 text-xs">—</span>}
                      </td>

                      {/* 수량 */}
                      <td className="px-0.5 py-0.5 border-r border-gray-100">
                        <input type="number" min="0" step="any"
                          value={row.quantity}
                          onChange={e => updateField(row._key, 'quantity', e.target.value)}
                          onBlur={() => handleFieldBlur(row._key)}
                          placeholder="수량"
                          disabled={!row.child}
                          className={cell + ' text-right'}
                        />
                      </td>

                      {/* 단위 */}
                      <td className="px-0.5 py-0.5 border-r border-gray-100">
                        <input
                          value={row.unit}
                          onChange={e => updateField(row._key, 'unit', e.target.value)}
                          onBlur={() => handleFieldBlur(row._key)}
                          placeholder="단위"
                          disabled={!row.child}
                          className={cell + ' text-center'}
                        />
                      </td>

                      {/* 비고 */}
                      <td className="px-0.5 py-0.5">
                        <input
                          value={row.memo}
                          onChange={e => updateField(row._key, 'memo', e.target.value)}
                          onBlur={() => handleFieldBlur(row._key)}
                          placeholder="비고"
                          disabled={!row.child}
                          className={cell}
                        />
                      </td>

                      {/* 작업 버튼 */}
                      <td className="py-1 px-1">
                        <div className="flex items-center justify-center gap-0.5">
                          {row.child && (
                            <button onClick={() => handleViewItem(row.child!)} title="보기"
                              className="w-6 h-6 flex items-center justify-center rounded text-blue-400 hover:text-blue-600 hover:bg-blue-50">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          )}
                          {row.child && (
                            <button onClick={() => handleCloneRow(row)} title="복제"
                              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          )}
                          {row.child && (
                            <button onClick={() => handleDeleteRow(row)} title="삭제"
                              className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t bg-white shrink-0 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {savedRows.length === 0 ? '구성 품목 없음' : `총 ${savedRows.length}개 구성 품목`}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-xs h-8 rounded-lg px-5" onClick={handleClose}>닫기</Button>
            <Button size="sm" className="text-xs h-8 rounded-lg px-5" onClick={handleSave} disabled={!isDirty}>
              저장
            </Button>
          </div>
        </div>
      </div>
    </div>

    {viewItem && (
      <ItemFormDialog
        open={!!viewItem}
        item={viewItem}
        viewOnly
        onClose={() => setViewItem(null)}
        onSaved={() => {}}
      />
    )}
  </>
  )
}
